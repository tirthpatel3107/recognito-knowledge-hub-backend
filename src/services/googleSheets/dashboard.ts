/**
 * Google Sheets Dashboard Service
 * Handles dashboard card order operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import { getSheetsClient, upsertRowByEmail } from "./utils";

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
 * Get dashboard card order
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
      range: "DashboardOrder!A:Z",
    });

    const rows = response?.data?.values || [];

    for (const row of rows) {
      if (row.length > 0 && row[0]?.toLowerCase() === email.toLowerCase()) {
        return row.slice(1).filter((id: string) => id && id.trim() !== "");
      }
    }

    return [];
  } catch (error) {
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
    const loginSpreadsheetId = getLoginSpreadsheetId();
    return await upsertRowByEmail(
      loginSpreadsheetId,
      "DashboardOrder",
      email,
      [email, ...cardOrder],
      accessToken,
    );
  } catch (error) {
    return false;
  }
};
