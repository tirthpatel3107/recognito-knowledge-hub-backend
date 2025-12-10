/**
 * Google Sheets Dashboard Service
 * Handles dashboard card order operations
 * Card order is stored in UserDetail sheet, column F
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import { getSheetsClient, findRowIndexByEmail } from "./utils";

/**
 * Get login spreadsheet ID with fallback to environment variable
 */
const getLoginSpreadsheetId = (): string => {
  const id = SPREADSHEET_IDS.LOGIN || process.env.LOGIN_SPREADSHEET_ID;
  if (!id || id.trim() === "") {
    throw new Error(
      "LOGIN_SPREADSHEET_ID is not configured. Set it in the .env file.",
    );
  }
  return id;
};

/**
 * Get dashboard card order from UserDetail column F
 */
export const getDashboardCardOrder = async (
  email: string,
  accessToken: string | null = null,
): Promise<string[]> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:F100",
    });

    const rows = response?.data?.values || [];

    // Find the row for the current user's email
    for (const row of rows) {
      if (row.length > 0 && row[0]?.toLowerCase() === email.toLowerCase()) {
        // Column F (index 5) contains card IDs separated by newlines
        const cardIdsString = row[5] || "";
        if (cardIdsString.trim() !== "") {
          // Split by newlines and filter out empty strings
          const cardIds = cardIdsString
            .split("\n")
            .map((id: string) => id.trim())
            .filter((id: string) => id !== "");

          return cardIds;
        }
        break;
      }
    }

    // If no card order found, try to auto-populate based on UserDetail spreadsheet IDs
    const { getUserSpreadsheetIds } = await import("./userProfile");
    const userSheetIds = await getUserSpreadsheetIds(email, accessToken);

    // Map spreadsheet IDs to card IDs
    const cardIds: string[] = [];
    if (userSheetIds.questionBank) {
      cardIds.push("question-bank");
    }
    if (userSheetIds.practicalTasks) {
      cardIds.push("practical-task");
    }
    if (userSheetIds.workSummary) {
      cardIds.push("work-summary");
    }
    if (userSheetIds.kanbanBoard) {
      cardIds.push("kanban-board");
    }
    if (userSheetIds.notes) {
      cardIds.push("notes");
    }

    // If we found any cards based on spreadsheet IDs, save them to UserDetail
    if (cardIds.length > 0) {
      const saved = await saveDashboardCardOrder(email, cardIds, accessToken);
      if (saved) {
        return cardIds;
      }
    }

    return [];
  } catch (error) {
    console.error(
      `[getDashboardCardOrder] Error getting dashboard card order for ${email}:`,
      error,
    );
    if (error instanceof Error) {
      console.error(`[getDashboardCardOrder] Error message:`, error.message);
      console.error(`[getDashboardCardOrder] Error stack:`, error.stack);
    }
    return [];
  }
};

/**
 * Save dashboard card order to UserDetail column F
 */
export const saveDashboardCardOrder = async (
  email: string,
  cardOrder: string[],
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:F100",
    });

    const rows = response?.data?.values || [];
    const rowIndex = findRowIndexByEmail(rows, email);

    if (rowIndex === -1) {
      console.error(
        `[saveDashboardCardOrder] User not found in UserDetail: ${email}`,
      );
      return false;
    }

    // Join card IDs with newlines for single field storage
    const cardIdsString = cardOrder.join("\n");

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!F${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[cardIdsString]],
      },
    });

    return true;
  } catch (error) {
    console.error(
      `[saveDashboardCardOrder] Error saving dashboard card order for ${email}:`,
      error,
    );
    if (error instanceof Error) {
      console.error(`[saveDashboardCardOrder] Error message: ${error.message}`);
      console.error(`[saveDashboardCardOrder] Error stack: ${error.stack}`);
    }
    return false;
  }
};
