/**
 * Google Sheets Dashboard Service
 * Handles dashboard card order operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import { getSheetsClient, upsertRowByEmail } from "./utils";
import { syncCardIdsToUserDetail } from "./userProfile";

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
 * Ensure DashboardOrder sheet exists
 */
const ensureDashboardOrderSheetExists = async (
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);

    try {
      // Try to read from the sheet to check if it exists
      await sheetsClient.spreadsheets.values.get({
        spreadsheetId: loginSpreadsheetId,
        range: "DashboardOrder!A1",
      });
      return true;
    } catch (error: any) {
      // If sheet doesn't exist (400 error or "Unable to parse range"), create it
      if (
        error.code === 400 ||
        error.message?.includes("Unable to parse range") ||
        error.message?.includes("not found")
      ) {
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: loginSpreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: "DashboardOrder",
                  },
                },
              },
            ],
          },
        });
        return true;
      }
      throw error;
    }
  } catch (error) {
    console.error("Error ensuring DashboardOrder sheet exists:", error);
    return false;
  }
};

/**
 * Get dashboard card order
 * Automatically populates DashboardOrder based on configured spreadsheet IDs in UserDetail
 */
export const getDashboardCardOrder = async (
  email: string,
  accessToken: string | null = null,
): Promise<string[]> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    
    // First, try to get existing order from DashboardOrder
    let existingOrder: string[] = [];
    let hasDashboardOrderEntry = false;
    
    try {
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: loginSpreadsheetId,
        range: "DashboardOrder!A:Z",
      });

      const rows = response?.data?.values || [];

      // Check if user already has an entry in DashboardOrder
      for (const row of rows) {
        if (row.length > 0 && row[0]?.toLowerCase() === email.toLowerCase()) {
          hasDashboardOrderEntry = true;
          existingOrder = row.slice(1).filter((id: string) => id && id.trim() !== "");
          break;
        }
      }
    } catch (error: any) {
      // If DashboardOrder sheet doesn't exist, that's okay - we'll create it
      if (!error.message?.includes("Unable to parse range") && !error.message?.includes("not found")) {
        console.error("Error reading DashboardOrder:", error);
      }
    }

    // If user has a non-empty existing order, return it
    if (existingOrder.length > 0) {
      console.log(`[getDashboardCardOrder] Returning existing order for ${email}:`, existingOrder);
      return existingOrder;
    }

    // If no existing order (or empty order), auto-populate based on UserDetail spreadsheet IDs
    console.log(`[getDashboardCardOrder] No existing order found for ${email}, checking UserDetail...`);
    const { getUserSpreadsheetIds } = await import("./userProfile");
    const userSheetIds = await getUserSpreadsheetIds(email, accessToken);
    
    console.log(`[getDashboardCardOrder] User spreadsheet IDs for ${email}:`, {
      questionBank: userSheetIds.questionBank ? "✓" : "✗",
      practicalTasks: userSheetIds.practicalTasks ? "✓" : "✗",
      workSummary: userSheetIds.workSummary ? "✓" : "✗",
      kanbanBoard: userSheetIds.kanbanBoard ? "✓" : "✗",
      notes: userSheetIds.notes ? "✓" : "✗",
    });

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

    console.log(`[getDashboardCardOrder] Mapped card IDs for ${email}:`, cardIds);

    // If we found any cards based on spreadsheet IDs, save them to DashboardOrder
    if (cardIds.length > 0) {
      console.log(`[getDashboardCardOrder] Saving card order to DashboardOrder for ${email}...`);
      const saved = await saveDashboardCardOrder(email, cardIds, accessToken);
      if (saved) {
        console.log(`[getDashboardCardOrder] Successfully saved card order for ${email}`);
        return cardIds;
      } else {
        console.error(`[getDashboardCardOrder] Failed to save card order for ${email}`);
      }
    } else {
      console.log(`[getDashboardCardOrder] No spreadsheet IDs found in UserDetail for ${email}`);
    }

    return [];
  } catch (error) {
    console.error(`[getDashboardCardOrder] Error getting dashboard card order for ${email}:`, error);
    if (error instanceof Error) {
      console.error(`[getDashboardCardOrder] Error message:`, error.message);
      console.error(`[getDashboardCardOrder] Error stack:`, error.stack);
    }
    return [];
  }
};

/**
 * Save dashboard card order
 */
export const saveDashboardCardOrder = async (
  email: string,
  cardOrder: string[],
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    // Ensure the DashboardOrder sheet exists before trying to save
    const sheetExists = await ensureDashboardOrderSheetExists(accessToken);
    if (!sheetExists) {
      console.error(
        `[saveDashboardCardOrder] Failed to ensure DashboardOrder sheet exists`,
      );
      return false;
    }

    const loginSpreadsheetId = getLoginSpreadsheetId();
    const success = await upsertRowByEmail(
      loginSpreadsheetId,
      "DashboardOrder",
      email,
      [email, ...cardOrder],
      accessToken,
    );

    // Also sync Card IDs to UserDetail tab
    if (success) {
      await syncCardIdsToUserDetail(email, cardOrder, accessToken);
    }

    return success;
  } catch (error) {
    console.error(
      `[saveDashboardCardOrder] Error saving dashboard card order for ${email}:`,
      error,
    );
    if (error instanceof Error) {
      console.error(
        `[saveDashboardCardOrder] Error message: ${error.message}`,
      );
      console.error(`[saveDashboardCardOrder] Error stack: ${error.stack}`);
    }
    return false;
  }
};
