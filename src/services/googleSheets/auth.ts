/**
 * Google Sheets Authentication Service
 * Handles user authentication and login operations
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
 * Authenticate user with email and password
 */
export const authenticateUser = async (
  email: string,
  password: string,
  accessToken: string,
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:B100",
    });

    const rows = response?.data?.values || [];
    const normalizedEmail = email.toLowerCase();

    // Use some() for early exit optimization
    return rows.some(
      (row: string[]) =>
        row?.length >= 2 &&
        row[0]?.toLowerCase() === normalizedEmail &&
        row[1] === password,
    );
  } catch (error) {
    return false;
  }
};

/**
 * Update user photo from Google
 */
export const updateUserPhotoFromGoogle = async (
  email: string,
  photoUrl: string,
  accessToken: string,
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

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!D${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[photoUrl]],
      },
    });

    return true;
  } catch (error: any) {
    return false;
  }
};
