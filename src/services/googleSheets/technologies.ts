/**
 * Google Sheets Technologies Service
 * Handles technology (sheet) CRUD operations for Question Bank
 */
import type { Technology } from "../../types/googleSheets";
import { getSheetsClient, ensureSheetHeaders } from "./utils";
import { getUserQuestionBankSpreadsheetId } from "./userProfile";

const QUESTION_BANK_HEADERS = ["No", "Question", "Answer", "Example"];

/**
 * Get all technologies
 */
export const getTechnologies = async (
  accessToken: string | null = null,
  email: string | null = null,
): Promise<Technology[]> => {
  const spreadsheetId = await getUserQuestionBankSpreadsheetId(
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
 * Create a new technology (sheet)
 */
export const createTechnology = async (
  name: string,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserQuestionBankSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const response = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
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
        QUESTION_BANK_HEADERS,
        `${name}!A1:D1`,
        accessToken,
      );
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Update technology name
 */
export const updateTechnology = async (
  oldName: string,
  newName: string,
  sheetId: number,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserQuestionBankSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
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
 * Delete technology (sheet)
 */
export const deleteTechnology = async (
  sheetId: number,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const spreadsheetId = await getUserQuestionBankSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);

    // First, check how many sheets exist
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId,
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
      spreadsheetId,
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
      error: error?.message || "Failed to delete technology",
    };
  }
};

/**
 * Reorder technologies
 */
export const reorderTechnologies = async (
  technologyIds: number[],
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserQuestionBankSpreadsheetId(
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
      spreadsheetId,
      requestBody: { requests },
    });
    return true;
  } catch (error) {
    return false;
  }
};
