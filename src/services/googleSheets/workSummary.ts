/**
 * Google Sheets Work Summary Service
 * Handles work summary entries and month sheet operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import type {
  WorkSummaryEntry,
  WorkSummaryEntryInput,
} from "../../types/googleSheets";
import {
  getSheetsClient,
  ensureSheetHeaders,
  formatDateForGoogleSheets,
  parseDateFromGoogleSheets,
  convertHtmlToFormattedText,
  parseMonthNameToDate,
  getMonthNameFromDate,
  getSpreadsheetMetadata,
  clearSpreadsheetMetadataCache,
} from "./utils";

const WORK_SUMMARY_HEADERS = ["No", "ProjectName", "WorkSummary", "Date"];

/**
 * Ensure Work Summary sheet has correct headers
 */
const ensureWorkSummaryHeaders = async (
  monthSheet: string,
  accessToken: string | null = null,
): Promise<void> => {
  await ensureSheetHeaders(
    SPREADSHEET_IDS.WORK_SUMMARY,
    monthSheet,
    WORK_SUMMARY_HEADERS,
    `${monthSheet}!A1:D1`,
    accessToken,
  );
};

/**
 * Get all month sheets
 */
export const getWorkSummaryMonthSheets = async (
  accessToken: string | null = null,
): Promise<string[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });

    const sheets = response?.data?.sheets || [];
    // Filter out Sheet1 and Project List
    return sheets
      .map((sheet: any) => sheet.properties.title)
      .filter((title: string) => {
        const lowerTitle = title?.toLowerCase().trim();
        return lowerTitle !== "sheet1" && lowerTitle !== "project list";
      });
  } catch (error) {
    return [];
  }
};

/**
 * Reorder Work Summary sheets in descending order (newest first)
 */
const reorderWorkSummarySheets = async (
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const sheets = await getSpreadsheetMetadata(
      SPREADSHEET_IDS.WORK_SUMMARY,
      accessToken,
    );

    // Categorize sheets
    const projectListSheet = sheets.find((sheet: any) => {
      const title = sheet.properties.title?.toLowerCase().trim();
      return title === "project list";
    });

    const monthSheets: any[] = [];
    const otherSheets: any[] = [];

    sheets.forEach((sheet: any) => {
      const title = sheet.properties.title?.toLowerCase().trim();
      if (title === "project list") {
        return;
      } else if (parseMonthNameToDate(sheet.properties.title) > 0) {
        monthSheets.push(sheet);
      } else {
        otherSheets.push(sheet);
      }
    });

    // Sort month sheets by date in descending order
    monthSheets.sort((a: any, b: any) => {
      const dateA = parseMonthNameToDate(a.properties.title);
      const dateB = parseMonthNameToDate(b.properties.title);
      return dateB - dateA;
    });

    // Build ordered sheets
    const orderedSheets: any[] = [];
    let currentIndex = 0;

    if (projectListSheet) {
      orderedSheets.push({
        sheetId: projectListSheet.properties.sheetId,
        index: currentIndex++,
      });
    }

    monthSheets.forEach((sheet: any) => {
      orderedSheets.push({
        sheetId: sheet.properties.sheetId,
        index: currentIndex++,
      });
    });

    otherSheets.forEach((sheet: any) => {
      orderedSheets.push({
        sheetId: sheet.properties.sheetId,
        index: currentIndex++,
      });
    });

    // Update sheet positions
    const requests = orderedSheets.map((sheet) => ({
      updateSheetProperties: {
        properties: {
          sheetId: sheet.sheetId,
          index: sheet.index,
        },
        fields: "index",
      },
    }));

    if (requests.length > 0) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
        requestBody: { requests },
      });
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Create a new month sheet
 */
export const createWorkSummaryMonthSheet = async (
  monthName: string,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: monthName,
              },
            },
          },
        ],
      },
    });

    // Add header row to the new sheet
    const newSheetId =
      response.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (newSheetId !== undefined) {
      await ensureWorkSummaryHeaders(monthName);
    }

    // Reorder sheets in descending order after creating new sheet
    await reorderWorkSummarySheets();

    // Clear cache after modification
    clearSpreadsheetMetadataCache(SPREADSHEET_IDS.WORK_SUMMARY);

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get work summary entries for a month
 */
export const getWorkSummaryEntriesByMonth = async (
  monthSheet: string,
  accessToken: string | null = null,
): Promise<WorkSummaryEntry[]> => {
  await ensureWorkSummaryHeaders(monthSheet, accessToken);

  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A2:E1000`,
    });

    const rows = response?.data?.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `ws-${index}`,
      no: row[0]?.toString() || "",
      projectName: row[1] || "",
      workSummary: row[2] || "",
      date: parseDateFromGoogleSheets(row[3] || ""),
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Add a work summary entry (inserts in ascending date order)
 */
export const addWorkSummaryEntry = async (
  monthSheet: string,
  entryData: WorkSummaryEntryInput,
): Promise<boolean> => {
  try {
    await ensureWorkSummaryHeaders(monthSheet);

    const sheetsClient = getSheetsClient();
    const spreadsheetResponse = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });

    const sheets = spreadsheetResponse.data.sheets || [];
    const targetSheet = sheets.find(
      (sheet: any) => sheet.properties.title === monthSheet,
    );

    if (!targetSheet) {
      return false;
    }

    const sheetId = targetSheet.properties.sheetId;

    // Get all existing entries
    const entriesResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A2:D1000`,
    });

    const existingRows = entriesResponse.data.values || [];
    const newEntryDate = new Date(entryData.date).getTime();

    // Find the insertion point (ascending date order)
    let insertIndex = existingRows.length;
    for (let i = 0; i < existingRows.length; i++) {
      const rowDate = existingRows[i][3];
      if (rowDate) {
        try {
          const rowDateValue = new Date(rowDate).getTime();
          if (!isNaN(rowDateValue) && newEntryDate < rowDateValue) {
            insertIndex = i;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    const insertRowNumber = insertIndex + 2;

    // Prepare batch update requests
    const requests: any[] = [];

    // 1. Insert a new row
    requests.push({
      insertDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: insertRowNumber - 1,
          endIndex: insertRowNumber,
        },
      },
    });

    // 2. Update the new row with entry data
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: insertRowNumber - 1,
          endRowIndex: insertRowNumber,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        rows: [
          {
            values: [
              { userEnteredValue: { numberValue: insertIndex + 1 } },
              { userEnteredValue: { stringValue: entryData.projectName } },
              {
                userEnteredValue: {
                  stringValue: convertHtmlToFormattedText(
                    entryData.workSummary,
                  ),
                },
              },
              {
                userEnteredValue: {
                  stringValue: formatDateForGoogleSheets(entryData.date),
                },
              },
            ],
          },
        ],
        fields: "userEnteredValue",
      },
    });

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests,
      },
    });

    // 3. Update serial numbers for rows after insertion
    if (insertIndex < existingRows.length) {
      const serialNumberUpdates = [];
      for (
        let originalIndex = insertIndex;
        originalIndex < existingRows.length;
        originalIndex++
      ) {
        const newRowNumber = originalIndex + 3;
        const newSerialNumber = originalIndex + 2;
        serialNumberUpdates.push({
          range: `${monthSheet}!A${newRowNumber}`,
          values: [[newSerialNumber]],
        });
      }

      if (serialNumberUpdates.length > 0) {
        await sheetsClient.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
          requestBody: {
            valueInputOption: "RAW",
            data: serialNumberUpdates,
          },
        });
      }
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Update a work summary entry
 */
export const updateWorkSummaryEntry = async (
  monthSheet: string,
  rowIndex: number,
  entryData: WorkSummaryEntryInput,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const sheets = await getSpreadsheetMetadata(SPREADSHEET_IDS.WORK_SUMMARY);
    const targetSheet = sheets.find(
      (sheet: any) => sheet.properties.title === monthSheet,
    );

    if (!targetSheet) {
      return false;
    }

    const sheetId = targetSheet.properties.sheetId;
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId,
                startRowIndex: actualRow - 1,
                endRowIndex: actualRow,
                startColumnIndex: 0,
                endColumnIndex: 4,
              },
              rows: [
                {
                  values: [
                    { userEnteredValue: { numberValue: rowIndex + 1 } },
                    {
                      userEnteredValue: { stringValue: entryData.projectName },
                    },
                    {
                      userEnteredValue: {
                        stringValue: convertHtmlToFormattedText(
                          entryData.workSummary,
                        ),
                      },
                    },
                    {
                      userEnteredValue: {
                        stringValue: formatDateForGoogleSheets(entryData.date),
                      },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue",
            },
          },
        ],
      },
    });

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Delete a work summary entry
 */
export const deleteWorkSummaryEntry = async (
  monthSheet: string,
  rowIndex: number,
  sheetId: number,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: actualRow - 1,
                endIndex: actualRow,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    return false;
  }
};

// Re-export getMonthNameFromDate from utils
export { getMonthNameFromDate };
