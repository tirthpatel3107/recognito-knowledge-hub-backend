/**
 * Google Sheets Practical Task Technologies Service
 * Handles practical task technology (sheet) CRUD operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import type { Technology } from "../../types/googleSheets";
import { getSheetsClient, ensureSheetHeaders } from "./utils";

const PRACTICAL_TASK_HEADERS = ["No", "Question", "Answer", "Image"];

/**
 * Get all practical task technologies
 */
export const getPracticalTaskTechnologies = async (
  accessToken: string | null = null,
): Promise<Technology[]> => {
  if (
    !SPREADSHEET_IDS.PRACTICAL_TASKS ||
    SPREADSHEET_IDS.PRACTICAL_TASKS.trim() === ""
  ) {
    throw new Error(
      "PRACTICAL_TASKS_SPREADSHEET_ID is not configured. Please authenticate to load configuration.",
    );
  }

  const sheetsClient = getSheetsClient(
    accessToken,
    null,
    SPREADSHEET_IDS.PRACTICAL_TASKS,
  );
  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.PRACTICAL_TASKS,
    );
    const response = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
        SPREADSHEET_IDS.PRACTICAL_TASKS,
        name,
        PRACTICAL_TASK_HEADERS,
        `${name}!A1:D1`,
      );
    }

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
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.PRACTICAL_TASKS,
    );
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
): Promise<{ success: boolean; error?: string }> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.PRACTICAL_TASKS,
    );

    // First, check how many sheets exist
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.PRACTICAL_TASKS,
    );
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
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      requestBody: { requests },
    });
    return true;
  } catch (error) {
    return false;
  }
};
