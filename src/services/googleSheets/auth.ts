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
 * Normalize Gmail addresses for comparison
 * Gmail treats dots as equivalent and ignores everything after +
 * Examples:
 * - "user.name@gmail.com" === "username@gmail.com"
 * - "user+tag@gmail.com" === "user@gmail.com"
 */
export const normalizeGmailAddress = (email: string): string => {
  if (!email || typeof email !== "string") {
    return email;
  }

  const lowerEmail = email.toLowerCase().trim();
  const [localPart, domain] = lowerEmail.split("@");

  // Only normalize if it's a Gmail domain
  if (domain === "gmail.com" || domain === "googlemail.com") {
    // Remove dots from local part
    const normalizedLocal = localPart.replace(/\./g, "");
    // Remove everything after + (plus aliases)
    const withoutPlus = normalizedLocal.split("+")[0];
    return `${withoutPlus}@${domain}`;
  }

  // For non-Gmail addresses, just return lowercase
  return lowerEmail;
};

/**
 * Authenticate user with email and password
 * Returns an object with success status and error message if failed
 */
export const authenticateUser = async (
  email: string,
  password: string,
  accessToken: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:B100",
    });

    const rows = response?.data?.values || [];
    const normalizedEmail = normalizeGmailAddress(email);

    // Use some() for early exit optimization
    const isValid = rows.some(
      (row: string[]) =>
        row?.length >= 2 &&
        normalizeGmailAddress(row[0]) === normalizedEmail &&
        row[1] === password,
    );

    return { success: isValid };
  } catch (error: any) {
    // Check if it's a permission error
    const errorMessage = error?.message || String(error);
    const isPermissionError =
      errorMessage.includes("PERMISSION_DENIED") ||
      errorMessage.includes("permission") ||
      error?.code === 403 ||
      error?.status === "PERMISSION_DENIED";

    if (isPermissionError) {
      return {
        success: false,
        error:
          "Access denied to login sheet. Please ensure your Google account has been granted access to the login spreadsheet.",
      };
    }

    return {
      success: false,
      error:
        "Failed to authenticate. Please check your credentials and try again.",
    };
  }
};

/**
 * Check if email exists in the login sheet
 * Used to verify Google SSO email matches a registered user
 * Returns an object with success status and error message if failed
 */
export const emailExistsInLoginSheet = async (
  email: string,
  accessToken: string,
): Promise<{ exists: boolean; error?: string }> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: "UserDetail!A2:A100",
    });

    const rows = response?.data?.values || [];
    const normalizedEmail = normalizeGmailAddress(email);

    // Check if email exists in the sheet
    const exists = rows.some(
      (row: string[]) =>
        row?.length >= 1 && normalizeGmailAddress(row[0]) === normalizedEmail,
    );

    return { exists };
  } catch (error: any) {
    // Check if it's a permission error
    const errorMessage = error?.message || String(error);
    const isPermissionError =
      errorMessage.includes("PERMISSION_DENIED") ||
      errorMessage.includes("permission") ||
      error?.code === 403 ||
      error?.status === "PERMISSION_DENIED";

    if (isPermissionError) {
      return {
        exists: false,
        error:
          "Access denied to login sheet. Please ensure your Google account has been granted access to the login spreadsheet.",
      };
    }

    return {
      exists: false,
      error: "Failed to check email in login sheet.",
    };
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
