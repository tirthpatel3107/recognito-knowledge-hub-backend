/**
 * Google Sheets User Profile Service
 * Handles user profile, mode, color palette, tabs, and password operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import type { UserProfile, ColorPalette } from "../../types/googleSheets";
import {
  getSheetsClient,
  findRowIndexByEmail,
  upsertRowByEmail,
} from "./utils";

export interface UserSpreadsheetIds {
  questionBank?: string;
  practicalTasks?: string;
  workSummary?: string;
  kanbanBoard?: string;
  notes?: string;
}

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
 * Get user profile
 */
export const getUserProfile = async (
  email: string,
  accessToken: string | null = null,
): Promise<UserProfile | null> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:D100",
    });

    const rows = response?.data?.values || [];
    for (const row of rows) {
      if (row[0]?.toLowerCase() === email.toLowerCase()) {
        return {
          email: row[0] || "",
          password: "", // Don't return password
          username: row[2] || "",
          photo: row[3] || "",
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  email: string,
  username?: string,
  photo?: string | null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:D100",
    });

    const rows = response?.data?.values || [];
    const rowIndex = findRowIndexByEmail(rows, email);

    if (rowIndex === -1) {
      return false;
    }

    // Validate photo size (Google Sheets cell limit is 50,000 characters)
    if (photo !== undefined && photo !== null && photo.length > 50000) {
      throw new Error(
        "Photo is too large. Please use a smaller image (max size: ~37KB when base64 encoded)",
      );
    }

    const updates: any[] = [];
    if (username !== undefined) {
      updates.push({
        range: `UserDetail!C${rowIndex}`,
        values: [[username]],
      });
    }
    if (photo !== undefined) {
      updates.push({
        range: `UserDetail!D${rowIndex}`,
        values: [[photo || ""]],
      });
    }

    if (updates.length > 0) {
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId: loginSpreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates,
        },
      });
    }
    return true;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return false;
  }
};

/**
 * Update user password
 */
export const updateUserPassword = async (
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:B100",
    });

    const rows = response?.data?.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0]?.toLowerCase() === email.toLowerCase()) {
        if (rows[i][1] !== currentPassword) {
          throw new Error("Current password is incorrect");
        }
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) {
      return false;
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!B${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newPassword]],
      },
    });
    return true;
  } catch (error) {
    throw error;
  }
};


/**
 * Get user-specific spreadsheet IDs from UserDetail
 * Columns: H=QUESTION_BANK, I=PRACTICAL_TASKS, J=WORK_SUMMARY, K=KANBAN_BOARD, L=NOTES
 */
export const getUserSpreadsheetIds = async (
  email: string,
  accessToken: string | null = null,
): Promise<UserSpreadsheetIds> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:L100",
    });

    const rows = response?.data?.values || [];
    
    for (const row of rows) {
      if (row.length > 0 && row[0]?.toLowerCase() === email.toLowerCase()) {
        const result = {
          questionBank: row[7] && row[7].trim() !== "" ? row[7].trim() : undefined,
          practicalTasks: row[8] && row[8].trim() !== "" ? row[8].trim() : undefined,
          workSummary: row[9] && row[9].trim() !== "" ? row[9].trim() : undefined,
          kanbanBoard: row[10] && row[10].trim() !== "" ? row[10].trim() : undefined,
          notes: row[11] && row[11].trim() !== "" ? row[11].trim() : undefined,
        };
        
        return result;
      }
    }
    return {};
  } catch (error) {
    console.error(`[getUserSpreadsheetIds] Error getting user spreadsheet IDs for ${email}:`, error);
    if (error instanceof Error) {
      console.error(`[getUserSpreadsheetIds] Error message:`, error.message);
      console.error(`[getUserSpreadsheetIds] Error stack:`, error.stack);
    }
    return {};
  }
};

/**
 * Helper functions to get specific spreadsheet IDs from UserDetail tab
 * Spreadsheet IDs should be configured per-user in the UserDetail tab (columns H, I, J, K, L)
 */
export const getUserQuestionBankSpreadsheetId = async (
  email: string | null,
  accessToken: string | null = null,
): Promise<string> => {
  if (email) {
    const userSheetIds = await getUserSpreadsheetIds(email, accessToken);
    if (userSheetIds.questionBank) {
      return userSheetIds.questionBank;
    }
  }
  // Fallback to environment variable only (no longer from Config tab)
  const envSpreadsheetId = process.env.QUESTION_BANK_SPREADSHEET_ID;
  if (envSpreadsheetId && envSpreadsheetId.trim() !== "") {
    return envSpreadsheetId;
  }
  throw new Error("QUESTION_BANK_SPREADSHEET_ID is not configured. Please set it in the UserDetail tab (column H) for your user.");
};

export const getUserPracticalTasksSpreadsheetId = async (
  email: string | null,
  accessToken: string | null = null,
): Promise<string> => {
  if (email) {
    const userSheetIds = await getUserSpreadsheetIds(email, accessToken);
    if (userSheetIds.practicalTasks) {
      return userSheetIds.practicalTasks;
    }
  }
  // Fallback to environment variable only (no longer from Config tab)
  const envSpreadsheetId = process.env.PRACTICAL_TASKS_SPREADSHEET_ID;
  if (envSpreadsheetId && envSpreadsheetId.trim() !== "") {
    return envSpreadsheetId;
  }
  throw new Error("PRACTICAL_TASKS_SPREADSHEET_ID is not configured. Please set it in the UserDetail tab (column I) for your user.");
};

export const getUserWorkSummarySpreadsheetId = async (
  email: string | null,
  accessToken: string | null = null,
): Promise<string> => {
  if (email) {
    const userSheetIds = await getUserSpreadsheetIds(email, accessToken);
    if (userSheetIds.workSummary) {
      return userSheetIds.workSummary;
    }
  }
  // Fallback to environment variable only (no longer from Config tab)
  const envSpreadsheetId = process.env.WORK_SUMMARY_SPREADSHEET_ID;
  if (envSpreadsheetId && envSpreadsheetId.trim() !== "") {
    return envSpreadsheetId;
  }
  throw new Error("WORK_SUMMARY_SPREADSHEET_ID is not configured. Please set it in the UserDetail tab (column J) for your user.");
};

export const getUserKanbanBoardSpreadsheetId = async (
  email: string | null,
  accessToken: string | null = null,
): Promise<string> => {
  if (email) {
    const userSheetIds = await getUserSpreadsheetIds(email, accessToken);
    if (userSheetIds.kanbanBoard) {
      return userSheetIds.kanbanBoard;
    }
  }
  // Fallback to environment variable only (no longer from Config tab)
  const envSpreadsheetId = process.env.KANBAN_BOARD_SPREADSHEET_ID;
  if (envSpreadsheetId && envSpreadsheetId.trim() !== "") {
    return envSpreadsheetId;
  }
  throw new Error("KANBAN_BOARD_SPREADSHEET_ID is not configured. Please set it in the UserDetail tab (column K) for your user.");
};

export const getUserNotesSpreadsheetId = async (
  email: string | null,
  accessToken: string | null = null,
): Promise<string> => {
  if (email) {
    const userSheetIds = await getUserSpreadsheetIds(email, accessToken);
    if (userSheetIds.notes) {
      return userSheetIds.notes;
    }
  }
  // Fallback to environment variable only (no longer from Config tab)
  const envSpreadsheetId = process.env.NOTES_SPREADSHEET_ID;
  if (envSpreadsheetId && envSpreadsheetId.trim() !== "") {
    return envSpreadsheetId;
  }
  throw new Error("NOTES_SPREADSHEET_ID is not configured. Please set it in the UserDetail tab (column L) for your user.");
};

/**
 * Get tags spreadsheet ID
 * Tags default to the same spreadsheet as the kanban board (in a "Tags" sheet)
 */
export const getUserTagsSpreadsheetId = async (
  email: string | null,
  accessToken: string | null = null,
): Promise<string> => {
  // Tags are stored in the same spreadsheet as the kanban board
  // So we use the kanban board spreadsheet ID
  return getUserKanbanBoardSpreadsheetId(email, accessToken);
};

/**
 * Get user color palette
 */
export const getUserColorPalette = async (
  email: string,
  accessToken: string | null = null,
): Promise<ColorPalette> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:L100",
    });

    const rows = response?.data?.values || [];
    for (const row of rows) {
      if (row[0]?.toLowerCase() === email.toLowerCase()) {
        // DarkModeColor is now in column G (index 6)
        const darkColor = row[6] && row[6].trim() !== "" ? row[6] : null;
        return {
          lightModeColor: null,
          darkModeColor: darkColor,
        };
      }
    }
    return {
      lightModeColor: null,
      darkModeColor: null,
    };
  } catch (error) {
    return {
      lightModeColor: null,
      darkModeColor: null,
    };
  }
};

/**
 * Update user color palette
 */
export const updateUserColorPalette = async (
  email: string,
  lightModeColor: string | null,
  darkModeColor: string | null,
  accessToken: string,
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:L100",
    });

    const rows = response?.data?.values || [];
    const rowIndex = findRowIndexByEmail(rows, email);

    if (rowIndex === -1) {
      return false;
    }

    // Only update darkModeColor (column G, index 6)
    const darkColorValue = darkModeColor === null ? "" : darkModeColor || "";

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!G${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[darkColorValue]],
      },
    });

    return true;
  } catch (error) {
    return false;
  }
};

