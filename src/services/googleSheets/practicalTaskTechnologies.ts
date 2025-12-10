/**
 * Google Sheets Practical Task Technologies Service
 * Handles practical task technology (sheet) CRUD operations
 */
import type { Technology } from "../../types/googleSheets";
import {
  getSheetsClient,
  ensureSheetHeaders,
  clearSpreadsheetMetadataCache,
} from "./utils";
import { getUserPracticalTasksSpreadsheetId } from "./userProfile";

const PRACTICAL_TASK_HEADERS = ["No", "Question", "Answer", "Image"];

/**
 * Get all practical task technologies
 */
export const getPracticalTaskTechnologies = async (
  accessToken: string | null = null,
  email: string | null = null,
): Promise<Technology[]> => {
  const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
    email,
    accessToken,
  );

  const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId,
  });

  const sheets = response?.data?.sheets || [];
  return sheets.map((sheet: any) => ({
    id: `tech-${sheet.properties.sheetId}`,
    name: sheet.properties.title,
    sheetId: sheet.properties.sheetId,
  }));
};

/**
 * Create a new practical task technology (sheet)
 */
export const createPracticalTaskTechnology = async (
  name: string,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const response = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: name,
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
      await ensureSheetHeaders(
        spreadsheetId,
        name,
        PRACTICAL_TASK_HEADERS,
        `${name}!A1:D1`,
        accessToken,
      );
    }

    // Clear cache after creating new sheet
    clearSpreadsheetMetadataCache(spreadsheetId);

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Update practical task technology name
 */
export const updatePracticalTaskTechnology = async (
  oldName: string,
  newName: string,
  sheetId: number,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                title: newName,
              },
              fields: "title",
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
 * Delete practical task technology (sheet)
 */
export const deletePracticalTaskTechnology = async (
  sheetId: number,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);

    // First, check how many sheets exist
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const sheets = spreadsheet.data.sheets || [];

    // Google Sheets requires at least one sheet
    if (sheets.length <= 1) {
      return {
        success: false,
        error:
          "Cannot delete the last sheet. A spreadsheet must have at least one sheet.",
      };
    }

    // Proceed with deletion
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId,
            },
          },
        ],
      },
    });

    // Clear cache after deletion
    clearSpreadsheetMetadataCache(spreadsheetId);
    return { success: true };
  } catch (error: any) {
    if (error?.message?.includes("You can't remove all the sheets")) {
      return {
        success: false,
        error:
          "Cannot delete the last sheet. A spreadsheet must have at least one sheet.",
      };
    }

    return {
      success: false,
      error: error?.message || "Failed to delete practical task technology",
    };
  }
};

/**
 * Reorder practical task technologies
 */
export const reorderPracticalTaskTechnologies = async (
  technologyIds: number[],
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const requests = technologyIds.map((sheetId, index) => ({
      updateSheetProperties: {
        properties: {
          sheetId,
          index,
        },
        fields: "index",
      },
    }));

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: { requests },
    });
    return true;
  } catch (error) {
    return false;
  }
};
