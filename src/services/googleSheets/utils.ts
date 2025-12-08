/**
 * Google Sheets Common Utilities
 * Shared utilities used across all Google Sheets service modules
 */
import { google } from "googleapis";
import { GOOGLE_CONFIG, SPREADSHEET_IDS } from "../../config/googleConfig";
import type { OAuth2Client } from "google-auth-library";
import type { JWT } from "google-auth-library";

// Global OAuth2 client instance
let oauth2Client: OAuth2Client | null = null;
let currentAccessToken: string | null = null;

// Service account client for accessing all sheets (except login sheet)
let serviceAccountClient: JWT | null = null;

// Cache for sheets clients per access token
const sheetsClientCache = new Map<string | null, any>();

// Service account client cache
let serviceAccountSheetsClient: any = null;

/**
 * Initialize Google Sheets service
 */
export const initializeGoogleSheets = (): void => {
  if (!GOOGLE_CONFIG.CLIENT_ID || !GOOGLE_CONFIG.CLIENT_SECRET) {
    return;
  }

  oauth2Client = new google.auth.OAuth2(
    GOOGLE_CONFIG.CLIENT_ID,
    GOOGLE_CONFIG.CLIENT_SECRET,
    GOOGLE_CONFIG.REDIRECT_URI,
  );
  // Clear cache on re-initialization
  sheetsClientCache.clear();
};

/**
 * Initialize service account for accessing all sheets
 * Service account credentials should be in JSON format (from config sheet or env)
 */
export const initializeServiceAccount = (serviceAccountKey: string): void => {
  try {
    const key = typeof serviceAccountKey === "string"
      ? JSON.parse(serviceAccountKey)
      : serviceAccountKey;

    serviceAccountClient = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/documents",
      ],
    });

    // Clear service account client cache
    serviceAccountSheetsClient = null;
  } catch (error) {
    throw new Error(
      "Failed to initialize service account. Invalid service account key format.",
    );
  }
};

/**
 * Check if service account is initialized
 */
export const isServiceAccountInitialized = (): boolean => {
  return serviceAccountClient !== null;
};

/**
 * Set user credentials for API calls
 */
export const setUserCredentials = (accessToken: string): void => {
  currentAccessToken = accessToken;
  if (oauth2Client) {
    oauth2Client.setCredentials({ access_token: accessToken });
  }
  // Clear cache when credentials change
  sheetsClientCache.clear();
};

/**
 * Get current access token (for internal use)
 */
export const getCurrentAccessToken = (): string | null => {
  return currentAccessToken;
};

/**
 * Get Google Sheets client
 * For login sheet: uses user's OAuth token (they need access to login sheet)
 * For all other sheets: uses service account (which has access to all sheets)
 * 
 * @param accessToken - User's OAuth token (required for login sheet operations)
 * @param useServiceAccount - Force use of service account (default: auto-detect based on spreadsheet)
 * @param spreadsheetId - Optional spreadsheet ID to determine which auth to use
 */
export const getSheetsClient = (
  accessToken: string | null = null,
  useServiceAccount: boolean | null = null,
  spreadsheetId?: string,
): any => {
  // Determine if we should use service account
  // Use service account for all sheets except login sheet
  const loginSpreadsheetId =
    SPREADSHEET_IDS.LOGIN || process.env.LOGIN_SPREADSHEET_ID || "";
  const shouldUseServiceAccount =
    useServiceAccount !== null
      ? useServiceAccount
      : spreadsheetId
        ? spreadsheetId !== loginSpreadsheetId
        : true; // Default to service account if no spreadsheet ID provided

  if (shouldUseServiceAccount) {
    // Use service account for all non-login sheets
    if (!serviceAccountClient) {
      throw new Error(
        "Service account is not initialized. Please configure SERVICE_ACCOUNT_KEY in your config sheet.",
      );
    }

    // Return cached service account client if available
    if (serviceAccountSheetsClient) {
      return serviceAccountSheetsClient;
    }

    // Create client with service account
    serviceAccountSheetsClient = google.sheets({
      version: "v4",
      auth: serviceAccountClient,
    });

    return serviceAccountSheetsClient;
  }

  // Use user's OAuth token for login sheet operations
  const token = accessToken || currentAccessToken;

  if (!token) {
    throw new Error(
      "OAuth access token is required for login sheet operations.",
    );
  }

  if (!oauth2Client) {
    throw new Error(
      "Google OAuth client is not initialized. Please ensure OAuth credentials are configured.",
    );
  }

  const cacheKey = token;

  // Return cached client if available
  if (sheetsClientCache.has(cacheKey)) {
    return sheetsClientCache.get(cacheKey);
  }

  // Create client with OAuth token
  oauth2Client.setCredentials({ access_token: token });
  const client = google.sheets({ version: "v4", auth: oauth2Client });

  // Cache the client
  sheetsClientCache.set(cacheKey, client);
  return client;
};

/**
 * Split text into chunks of max 50,000 characters (Google Sheets cell limit)
 */
export const splitTextIntoChunks = (
  text: string,
  maxLength: number = 50000,
): string[] => {
  if (text.length <= maxLength) {
    return [text];
  }
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.substring(i, i + maxLength));
  }
  return chunks;
};

/**
 * Convert column index (0-based) to column letter (A, B, ..., Z, AA, AB, ...)
 */
export const getColumnLetter = (colIndex: number): string => {
  let result = "";
  let num = colIndex;
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
};

// Cache month names array to avoid recreation
const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/**
 * Format date from YYYY-MM-DD to DD MMM YYYY format (e.g., "11 NOV 2025")
 * Optimized with cached month names
 */
export const formatDateForGoogleSheets = (dateString: string): string => {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  } catch (error) {
    return dateString;
  }
};

/**
 * Parse date from DD MMM YYYY format (e.g., "11 NOV 2025") or YYYY-MM-DD format to YYYY-MM-DD
 */
export const parseDateFromGoogleSheets = (dateString: string): string => {
  if (!dateString) return "";

  // Check if it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Try to parse DD MMM YYYY format
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    // If parsing fails, return original string
  }

  return dateString;
};

/**
 * Convert HTML to formatted plain text while preserving line breaks and structure
 * Optimized with single-pass regex replacements
 */
export const convertHtmlToFormattedText = (html: string): string => {
  if (!html) return "";

  // Single-pass replacement for block-level closing tags
  let text = html.replace(
    /<\/?(?:li|p|div|h[1-6]|ul|ol|blockquote|br)[^>]*>/gi,
    "\n",
  );

  // Remove all remaining HTML tags in one pass
  text = text.replace(/<[^>]+>/g, "");

  // HTML entity map for faster lookups
  const entityMap: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&rdquo;": '"',
    "&ldquo;": '"',
    "&rsquo;": "'",
    "&lsquo;": "'",
    "&mdash;": "—",
    "&ndash;": "–",
  };

  // Replace named entities
  for (const [entity, replacement] of Object.entries(entityMap)) {
    text = text.replace(new RegExp(entity, "g"), replacement);
  }

  // Handle numeric entity codes
  text = text.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCharCode(parseInt(dec, 10)),
  );
  text = text.replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

  // Process lines efficiently
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
};

/**
 * Parse month name (e.g., "JAN 25") to date for sorting
 * Optimized with cached month names
 */
export const parseMonthNameToDate = (monthName: string): number => {
  try {
    const parts = monthName.trim().toUpperCase().split(/\s+/);
    if (parts.length !== 2) return 0;

    const month = MONTH_NAMES.indexOf(parts[0]);
    const year = parseInt(parts[1]);

    if (month === -1 || isNaN(year)) return 0;

    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    return new Date(fullYear, month, 1).getTime();
  } catch (error) {
    return 0;
  }
};

/**
 * Get month name from date
 * Optimized with cached month names
 */
export const getMonthNameFromDate = (dateString: string): string | null => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
  } catch (error) {
    return null;
  }
};

// Cache for verified sheet headers to avoid redundant API calls
const verifiedHeadersCache = new Set<string>();

/**
 * Get cache key for header verification
 */
const getHeaderCacheKey = (
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
): string => {
  return `${spreadsheetId}:${sheetName}:${headers.join(",")}`;
};

/**
 * Ensure sheet headers exist (with caching to avoid redundant checks)
 */
export const ensureSheetHeaders = async (
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  range: string,
  accessToken: string | null = null,
): Promise<void> => {
  const cacheKey = getHeaderCacheKey(spreadsheetId, sheetName, headers);

  // Return early if headers are already verified
  if (verifiedHeadersCache.has(cacheKey)) {
    return;
  }

  try {
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const headerResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const headerRow = headerResponse.data.values?.[0] || [];
    const headersMatch =
      headerRow.length >= headers.length &&
      headers.every((header, index) => headerRow[index] === header);

    if (!headersMatch) {
      const updateClient = getSheetsClient(accessToken, null, spreadsheetId);
      await updateClient.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values: [headers],
        },
      });
    }

    // Cache successful verification
    verifiedHeadersCache.add(cacheKey);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Unable to parse range") ||
        error.message.includes("does not exist"))
    ) {
      try {
        const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: {
            values: [headers],
          },
        });
        // Cache successful creation
        verifiedHeadersCache.add(cacheKey);
      } catch (updateError) {
        // Error creating headers
      }
    }
  }
};

/**
 * Update serial numbers for rows (optimized with batch updates)
 */
export const updateSerialNumbers = async (
  spreadsheetId: string,
  sheetName: string,
  rowCount: number,
  startRow: number = 2,
  accessToken: string | null = null,
): Promise<void> => {
  if (rowCount === 0) return;

  const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);

  // Google Sheets API batchUpdate has a limit of 100 requests per batch
  const BATCH_SIZE = 100;
  const updates = [];

  for (let i = 0; i < rowCount; i++) {
    updates.push({
      range: `${sheetName}!A${startRow + i}`,
      values: [[i + 1]],
    });
  }

  // Process in batches to respect API limits
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await sheetsClient.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: batch,
      },
    });
  }
};

/**
 * Find row index by email in a sheet
 */
export const findRowIndexByEmail = (rows: any[][], email: string): number => {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.toLowerCase() === email.toLowerCase()) {
      return i + 2; // +2 because sheets are 1-indexed and we start from row 2
    }
  }
  return -1;
};

// Cache for spreadsheet metadata to avoid redundant API calls
const spreadsheetMetadataCache = new Map<
  string,
  {
    sheets: any[];
    timestamp: number;
  }
>();

const METADATA_CACHE_TTL = 60000; // 60 seconds

/**
 * Get spreadsheet metadata (with caching)
 */
export const getSpreadsheetMetadata = async (
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<any[]> => {
  const cacheKey = `${spreadsheetId}:${accessToken || "api_key"}`;
  const cached = spreadsheetMetadataCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < METADATA_CACHE_TTL) {
    return cached.sheets;
  }

  const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId,
  });

  const sheets = response.data.sheets || [];
  spreadsheetMetadataCache.set(cacheKey, { sheets, timestamp: now });

  return sheets;
};

/**
 * Clear spreadsheet metadata cache (useful when sheets are modified)
 */
export const clearSpreadsheetMetadataCache = (spreadsheetId?: string): void => {
  if (spreadsheetId) {
    // Clear specific spreadsheet cache
    for (const key of spreadsheetMetadataCache.keys()) {
      if (key.startsWith(spreadsheetId)) {
        spreadsheetMetadataCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    spreadsheetMetadataCache.clear();
  }
};

/**
 * Find sheet by name (case-insensitive with fallbacks, optimized with caching)
 */
export const findSheetByName = async (
  spreadsheetId: string,
  sheetName: string,
  accessToken: string | null = null,
): Promise<{
  sheetName: string;
  sheetId?: number;
  availableSheets: string[];
}> => {
  try {
    const sheetsList = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const availableSheets = sheetsList
      .map((sheet: any) => sheet.properties?.title)
      .filter(Boolean);

    const normalizedTarget = sheetName
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    // Try exact match (case-insensitive, normalized)
    let foundSheet = sheetsList.find((sheet: any) => {
      const title = sheet.properties?.title || "";
      const normalized = title.replace(/\s+/g, " ").trim().toLowerCase();
      return normalized === normalizedTarget;
    });

    // Try partial match if exact match fails
    if (!foundSheet) {
      const targetWords = normalizedTarget.split(/\s+/);
      foundSheet = sheetsList.find((sheet: any) => {
        const title = (sheet.properties?.title || "").toLowerCase();
        return targetWords.every((word) => title.includes(word));
      });
    }

    // Try exact case-sensitive match
    if (!foundSheet) {
      foundSheet = sheetsList.find((sheet: any) => {
        return sheet.properties?.title === sheetName;
      });
    }

    if (!foundSheet?.properties?.title) {
      return { sheetName, availableSheets };
    }

    return {
      sheetName: foundSheet.properties.title,
      sheetId: foundSheet.properties?.sheetId,
      availableSheets,
    };
  } catch (error) {
    return { sheetName, availableSheets: [] };
  }
};

/**
 * Common helper: Update or append row by email
 * Used for user-specific data like dashboard order, tabs, etc.
 */
export const upsertRowByEmail = async (
  spreadsheetId: string,
  sheetName: string,
  email: string,
  values: any[],
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response?.data?.values || [];
    const rowIndex = findRowIndexByEmail(rows, email);

    if (rowIndex > 0) {
      // Update existing row
      const endColumn = getColumnLetter(values.length - 1);
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowIndex}:${endColumn}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [values],
        },
      });
    } else {
      // Append new row
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: "RAW",
        requestBody: {
          values: [values],
        },
      });
    }

    return true;
  } catch (error) {
    console.error(
      `[upsertRowByEmail] Error upserting row for email ${email} in sheet ${sheetName}:`,
      error,
    );
    if (error instanceof Error) {
      console.error(`[upsertRowByEmail] Error message: ${error.message}`);
      console.error(`[upsertRowByEmail] Error stack: ${error.stack}`);
    }
    return false;
  }
};
