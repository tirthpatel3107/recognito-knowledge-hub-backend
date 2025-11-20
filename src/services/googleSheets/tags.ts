/**
 * Google Sheets Tags Service
 * Handles tag CRUD operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import type { Tag, TagInput } from "../../types/googleSheets";
import {
  getSheetsClient,
  ensureSheetHeaders,
  updateSerialNumbers,
  getSpreadsheetMetadata,
  clearSpreadsheetMetadataCache,
} from "./utils";

const TAGS_HEADERS = ["No", "Name"];

/**
 * Ensure Tags sheet exists and has correct headers
 */
const ensureTagsSheet = async (
  accessToken: string | null = null,
): Promise<void> => {
  try {
    if (!SPREADSHEET_IDS.TAGS || SPREADSHEET_IDS.TAGS.trim() === "") {
      return;
    }

    const sheetsClient = getSheetsClient(accessToken);
    const sheets = await getSpreadsheetMetadata(
      SPREADSHEET_IDS.TAGS,
      accessToken,
    );
    const tagsSheet = sheets.find(
      (sheet: any) => sheet.properties?.title?.toLowerCase() === "tags",
    );

    if (!tagsSheet) {
      // Create Tags sheet
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.TAGS,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: "Tags",
                },
              },
            },
          ],
        },
      });
    }

    // Ensure headers exist
    await ensureSheetHeaders(
      SPREADSHEET_IDS.TAGS,
      "Tags",
      TAGS_HEADERS,
      "Tags!A1:B1",
      accessToken,
    );

    // Ensure default "Daily" tag exists
    const tagsResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.TAGS,
      range: "Tags!A2:B1000",
    });

    const rows = tagsResponse?.data?.values || [];
    const dailyTagExists = rows.some(
      (row: any[]) => row[1]?.toLowerCase() === "daily",
    );

    if (!dailyTagExists) {
      const rowCount = rows.length + 2;
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_IDS.TAGS,
        range: `Tags!A${rowCount}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[rows.length + 1, "Daily"]],
        },
      });
    }
  } catch (error) {
    // Error ensuring Tags sheet
  }
};

/**
 * Get all tags
 */
export const getTags = async (
  accessToken: string | null = null,
): Promise<Tag[]> => {
  try {
    await ensureTagsSheet(accessToken);
    const sheetsClient = getSheetsClient(accessToken);

    if (!SPREADSHEET_IDS.TAGS || SPREADSHEET_IDS.TAGS.trim() === "") {
      return [];
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.TAGS,
      range: "Tags!A2:B1000",
    });

    const rows = response?.data?.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `tag-${index}`,
      no: row[0]?.toString() || "",
      name: row[1] || "",
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Add a tag
 */
export const addTag = async (
  tagData: TagInput,
  accessToken: string | null = null,
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!SPREADSHEET_IDS.TAGS || SPREADSHEET_IDS.TAGS.trim() === "") {
      return { success: false, error: "TAGS spreadsheet ID is not configured" };
    }

    if (!accessToken) {
      return { success: false, error: "Google access token is required" };
    }

    await ensureTagsSheet(accessToken);
    const sheetsClient = getSheetsClient(accessToken);

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.TAGS,
      range: "Tags!A:A",
    });
    const rowCount = (response?.data?.values?.length || 1) + 1;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.TAGS,
      range: `Tags!A${rowCount}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[rowCount - 1, tagData.name]],
      },
    });
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Unknown error occurred while adding tag",
    };
  }
};

/**
 * Update a tag
 */
export const updateTag = async (
  rowIndex: number,
  tagData: TagInput,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);

    if (!SPREADSHEET_IDS.TAGS || SPREADSHEET_IDS.TAGS.trim() === "") {
      return false;
    }

    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.TAGS,
      range: `Tags!A${actualRow}:B${actualRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[rowIndex + 1, tagData.name]],
      },
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Delete a tag
 */
export const deleteTag = async (
  rowIndex: number,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);

    if (!SPREADSHEET_IDS.TAGS || SPREADSHEET_IDS.TAGS.trim() === "") {
      return false;
    }

    // Get the sheet ID for Tags (using cached metadata)
    const sheets = await getSpreadsheetMetadata(
      SPREADSHEET_IDS.TAGS,
      accessToken,
    );
    const tagsSheet = sheets.find(
      (sheet: any) => sheet.properties?.title?.toLowerCase() === "tags",
    );

    if (!tagsSheet?.properties?.sheetId) {
      return false;
    }

    const sheetId = tagsSheet.properties.sheetId;
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.TAGS,
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

    // Update serial numbers
    const updatedTags = await getTags(accessToken);
    await updateSerialNumbers(SPREADSHEET_IDS.TAGS, "Tags", updatedTags.length);

    // Clear cache after modification
    clearSpreadsheetMetadataCache(SPREADSHEET_IDS.TAGS);

    return true;
  } catch (error) {
    return false;
  }
};
