/**
 * Google Sheets Work Summary Service
 * Handles work summary entries and month sheet operations
 */
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
  isServiceAccountInitialized,
} from "./utils";
import { getUserWorkSummarySpreadsheetId } from "./userProfile";

const WORK_SUMMARY_HEADERS = ["No", "ProjectName", "WorkSummary", "Date"];

/**
 * Ensure Work Summary sheet has correct headers
 */
const ensureWorkSummaryHeaders = async (
  monthSheet: string,
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<void> => {
  await ensureSheetHeaders(
    spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<string[]> => {
  try {
    // Get user-specific spreadsheet ID from UserDetail tab
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);

    // Check if service account is initialized (required for WORK_SUMMARY spreadsheet)
    if (!isServiceAccountInitialized()) {
      console.error(
        "Service account is not initialized. Cannot access Work Summary spreadsheet.",
      );
      throw new Error(
        "Service account is not initialized. Please configure SERVICE_ACCOUNT_KEY in your config sheet.",
      );
    }

    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const sheets = response?.data?.sheets || [];
    // Filter out Sheet1 and Project List
    return sheets
      .map((sheet: any) => sheet.properties.title)
      .filter((title: string) => {
        const lowerTitle = title?.toLowerCase().trim();
        return lowerTitle !== "sheet1" && lowerTitle !== "project list";
      });
  } catch (error: any) {
    console.error("Error getting work summary month sheets:", error);
    
    // Provide more specific error messages for common issues
    if (error?.response?.status === 404) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || "";
      if (errorMessage.includes("spreadsheet") || errorMessage.includes("404")) {
        throw new Error(
          `Work Summary spreadsheet not found. Please verify that WORK_SUMMARY_SPREADSHEET_ID is set in the UserDetail tab (column J) for your user and the service account has access to it.`,
        );
      }
    }
    
    // Re-throw the error so the API can return a proper error response
    throw error;
  }
};

/**
 * Reorder Work Summary sheets in descending order (newest first)
 */
const reorderWorkSummarySheets = async (
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const sheets = await getSpreadsheetMetadata(
      spreadsheetId,
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
        spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    // Get user-specific spreadsheet ID from UserDetail tab
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
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
      await ensureWorkSummaryHeaders(monthName, spreadsheetId, accessToken);
    }

    // Reorder sheets in descending order after creating new sheet
    await reorderWorkSummarySheets(spreadsheetId, accessToken);

    // Clear cache after modification
    clearSpreadsheetMetadataCache(spreadsheetId);

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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<WorkSummaryEntry[]> => {
  // Get user-specific spreadsheet ID from UserDetail tab
  const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
  await ensureWorkSummaryHeaders(monthSheet, spreadsheetId, accessToken);

  try {
    // Check if service account is initialized (required for WORK_SUMMARY spreadsheet)
    if (!isServiceAccountInitialized()) {
      console.error(
        "Service account is not initialized. Cannot access Work Summary spreadsheet.",
      );
      throw new Error(
        "Service account is not initialized. Please configure SERVICE_ACCOUNT_KEY in your config sheet.",
      );
    }

    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
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
  } catch (error: any) {
    console.error(
      `Error getting work summary entries for month ${monthSheet}:`,
      error,
    );
    
    // Provide more specific error messages for common issues
    if (error?.response?.status === 404) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || "";
      if (errorMessage.includes("spreadsheet") || errorMessage.includes("404")) {
        throw new Error(
          `Work Summary spreadsheet not found. Please verify that WORK_SUMMARY_SPREADSHEET_ID is set in the UserDetail tab (column J) for your user and the service account has access to it.`,
        );
      }
    }
    
    // Re-throw the error so the API can return a proper error response
    throw error;
  }
};

/**
 * Add a work summary entry (inserts in ascending date order)
 */
export const addWorkSummaryEntry = async (
  monthSheet: string,
  entryData: WorkSummaryEntryInput,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    // Get user-specific spreadsheet ID from UserDetail tab
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    await ensureWorkSummaryHeaders(monthSheet, spreadsheetId, accessToken);

    const sheetsClient = getSheetsClient(accessToken);
    const spreadsheetResponse = await sheetsClient.spreadsheets.get({
      spreadsheetId: spreadsheetId,
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
      spreadsheetId: spreadsheetId,
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
      spreadsheetId: spreadsheetId,
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
          spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    // Get user-specific spreadsheet ID from UserDetail tab
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(accessToken);
    const sheets = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const targetSheet = sheets.find(
      (sheet: any) => sheet.properties.title === monthSheet,
    );

    if (!targetSheet) {
      return false;
    }

    const sheetId = targetSheet.properties.sheetId;
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    // Get user-specific spreadsheet ID from UserDetail tab
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(accessToken);
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
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

/**
 * Update project names in all work summary sheets
 */
export const updateProjectNameInWorkSummary = async (
  oldProjectName: string,
  newProjectName: string,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    // Get user-specific spreadsheet ID from UserDetail tab
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);

    // Check if service account is initialized
    if (!isServiceAccountInitialized()) {
      console.error(
        "Service account is not initialized. Cannot update project names in work summary.",
      );
      return false;
    }

    // Get all month sheets
    const monthSheets = await getWorkSummaryMonthSheets(email, accessToken);

    // Collect all updates across all sheets
    const batchUpdates: any[] = [];
    let totalUpdates = 0;

    const sheetsClient = getSheetsClient(accessToken);

    // Iterate through each month sheet
    for (const monthSheet of monthSheets) {
      // Get all entries from this sheet
      const entries = await getWorkSummaryEntriesByMonth(monthSheet, email, accessToken);

      // Find entries with matching project name
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].projectName === oldProjectName) {
          const rowNumber = i + 2; // +2 for header and 1-based index

          batchUpdates.push({
            range: `${monthSheet}!B${rowNumber}`, // Column B is ProjectName
            values: [[newProjectName]],
          });
          totalUpdates++;
        }
      }
    }

    // If there are updates, batch update them
    if (batchUpdates.length > 0) {
      // Batch update can only handle 100 requests at a time, so split if needed
      const BATCH_SIZE = 100;
      for (let i = 0; i < batchUpdates.length; i += BATCH_SIZE) {
        const batch = batchUpdates.slice(i, i + BATCH_SIZE);

        await sheetsClient.spreadsheets.values.batchUpdate({
          spreadsheetId: spreadsheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: batch,
          },
        });
      }

      console.log(
        `Updated ${totalUpdates} work summary entries with new project name: ${newProjectName}`,
      );
      return true;
    } else {
      // No work summary entries found with old project name
      console.log(
        `No work summary entries found with project name: ${oldProjectName}`,
      );
      return true; // No updates needed, but not an error
    }
  } catch (error) {
    console.error("Error updating project names in work summary:", error);
    return false;
  }
};

// Re-export getMonthNameFromDate from utils
export { getMonthNameFromDate };
