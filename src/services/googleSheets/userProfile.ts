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
 * Ensure Tabs sheet exists with headers
 */
const ensureTabsSheetExists = async (
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);

    try {
      await sheetsClient.spreadsheets.values.get({
        spreadsheetId: loginSpreadsheetId,
        range: "Tabs!A1:C1",
      });
      const headerResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: loginSpreadsheetId,
        range: "Tabs!A1:C1",
      });
      const headers = headerResponse?.data?.values?.[0];

      if (!headers || headers.length === 0) {
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId: loginSpreadsheetId,
          range: "Tabs!A1:C1",
          valueInputOption: "RAW",
          requestBody: {
            values: [["Email", "Tabs", "ActiveTabId"]],
          },
        });
      }
      return true;
    } catch (error: any) {
      if (
        error.code === 400 ||
        error.message?.includes("Unable to parse range")
      ) {
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: loginSpreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: "Tabs",
                  },
                },
              },
            ],
          },
        });

        await sheetsClient.spreadsheets.values.update({
          spreadsheetId: loginSpreadsheetId,
          range: "Tabs!A1:C1",
          valueInputOption: "RAW",
          requestBody: {
            values: [["Email", "Tabs", "ActiveTabId"]],
          },
        });
        return true;
      }
      throw error;
    }
  } catch (error) {
    console.error("Error ensuring Tabs sheet exists:", error);
    return false;
  }
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
 * Get user mode
 */
export const getUserMode = async (
  email: string,
  accessToken: string | null = null,
): Promise<string | null> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:E100",
    });

    const rows = response?.data?.values || [];
    for (const row of rows) {
      if (row[0]?.toLowerCase() === email.toLowerCase()) {
        return row[4] || "Light";
      }
    }
    return "Light";
  } catch (error) {
    return "Light";
  }
};

/**
 * Update user mode
 */
export const updateUserMode = async (
  email: string,
  mode: string,
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:E100",
    });

    const rows = response?.data?.values || [];
    const rowIndex = findRowIndexByEmail(rows, email);

    if (rowIndex === -1) {
      return false;
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!E${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[mode]],
      },
    });
    return true;
  } catch (error) {
    return false;
  }
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
      range: "UserDetail!A2:G100",
    });

    const rows = response?.data?.values || [];
    for (const row of rows) {
      if (row[0]?.toLowerCase() === email.toLowerCase()) {
        const lightColor = row[5] && row[5].trim() !== "" ? row[5] : null;
        const darkColor = row[6] && row[6].trim() !== "" ? row[6] : null;
        return {
          lightModeColor: lightColor,
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
      range: "UserDetail!A2:G100",
    });

    const rows = response?.data?.values || [];
    const rowIndex = findRowIndexByEmail(rows, email);

    if (rowIndex === -1) {
      return false;
    }

    const lightColorValue = lightModeColor === null ? "" : lightModeColor || "";
    const darkColorValue = darkModeColor === null ? "" : darkModeColor || "";

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!F${rowIndex}:G${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[lightColorValue, darkColorValue]],
      },
    });

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get user tabs
 */
export const getTabs = async (
  email: string,
  accessToken: string | null = null,
): Promise<{ tabs: any[]; activeTabId: string | null } | null> => {
  try {
    await ensureTabsSheetExists(accessToken);

    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "Tabs!A:C",
    });

    const rows = response?.data?.values || [];

    for (const row of rows) {
      if (row.length > 0 && row[0]?.toLowerCase() === email.toLowerCase()) {
        try {
          const tabsJson = row[1] || "[]";
          const tabs = JSON.parse(tabsJson);
          const activeTabId = row[2] && row[2].trim() !== "" ? row[2] : null;

          return {
            tabs: Array.isArray(tabs) ? tabs : [],
            activeTabId: activeTabId,
          };
        } catch (parseError) {
          console.error("Error parsing tabs JSON:", parseError);
          return null;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting tabs:", error);
    return null;
  }
};

/**
 * Save user tabs
 */
export const saveTabs = async (
  email: string,
  tabs: any[],
  activeTabId: string | null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    await ensureTabsSheetExists(accessToken);

    const loginSpreadsheetId = getLoginSpreadsheetId();
    const tabsJson = JSON.stringify(tabs);
    const values = [email, tabsJson, activeTabId || ""];

    return await upsertRowByEmail(
      loginSpreadsheetId,
      "Tabs",
      email,
      values,
      accessToken,
    );
  } catch (error) {
    console.error("Error saving tabs:", error);
    return false;
  }
};
