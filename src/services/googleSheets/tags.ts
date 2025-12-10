/**
 * Google Sheets Tags Service
 * Handles tag CRUD operations
 */
import type { Tag, TagInput } from "../../types/googleSheets";
import {
  getSheetsClient,
  ensureSheetHeaders,
  updateSerialNumbers,
  getSpreadsheetMetadata,
  clearSpreadsheetMetadataCache,
} from "./utils";
import { getUserTagsSpreadsheetId } from "./userProfile";

const TAGS_HEADERS = ["No", "Name"];

/**
 * Ensure Tags sheet exists and has correct headers
 */
const ensureTagsSheet = async (
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<void> => {
  try {
    if (!spreadsheetId || spreadsheetId.trim() === "") {
      return;
    }

    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const sheets = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const tagsSheet = sheets.find(
      (sheet: any) => sheet.properties?.title?.toLowerCase() === "tags",
    );

    if (!tagsSheet) {
      // Create Tags sheet
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
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
      spreadsheetId,
      "Tags",
      TAGS_HEADERS,
      "Tags!A1:B1",
      accessToken,
    );

    // Ensure default "Daily" tag exists
    const tagsResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: "Tags!A2:B1000",
    });

    const rows = tagsResponse?.data?.values || [];
    const dailyTagExists = rows.some(
      (row: any[]) => row[1]?.toLowerCase() === "daily",
    );

    if (!dailyTagExists) {
      const rowCount = rows.length + 2;
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<Tag[]> => {
  try {
    // Get user-specific spreadsheet ID (tags are in the same spreadsheet as kanban board)
    const spreadsheetId = await getUserTagsSpreadsheetId(email, accessToken);

    await ensureTagsSheet(spreadsheetId, accessToken);
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);

    if (!spreadsheetId || spreadsheetId.trim() === "") {
      return [];
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!accessToken) {
      return { success: false, error: "Google access token is required" };
    }

    // Get user-specific spreadsheet ID (tags are in the same spreadsheet as kanban board)
    const spreadsheetId = await getUserTagsSpreadsheetId(email, accessToken);

    if (!spreadsheetId || spreadsheetId.trim() === "") {
      return { success: false, error: "TAGS spreadsheet ID is not configured" };
    }

    await ensureTagsSheet(spreadsheetId, accessToken);
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: "Tags!A:A",
    });
    const rowCount = (response?.data?.values?.length || 1) + 1;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    // Get user-specific spreadsheet ID (tags are in the same spreadsheet as kanban board)
    const spreadsheetId = await getUserTagsSpreadsheetId(email, accessToken);

    if (!spreadsheetId || spreadsheetId.trim() === "") {
      return false;
    }

    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);

    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    // Get user-specific spreadsheet ID (tags are in the same spreadsheet as kanban board)
    const spreadsheetId = await getUserTagsSpreadsheetId(email, accessToken);

    if (!spreadsheetId || spreadsheetId.trim() === "") {
      return false;
    }

    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);

    // Get the sheet ID for Tags (using cached metadata)
    const sheets = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const tagsSheet = sheets.find(
      (sheet: any) => sheet.properties?.title?.toLowerCase() === "tags",
    );

    if (!tagsSheet?.properties?.sheetId) {
      return false;
    }

    const sheetId = tagsSheet.properties.sheetId;
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

    // Update serial numbers
    const updatedTags = await getTags(email, accessToken);
    await updateSerialNumbers(spreadsheetId, "Tags", updatedTags.length);

    // Clear cache after modification
    clearSpreadsheetMetadataCache(spreadsheetId);

    return true;
  } catch (error) {
    return false;
  }
};
