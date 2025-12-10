/**
 * Loads backend configuration from the secured Google Sheet's Config or UserDetail tab.
 */

import {
  applySheetConfig,
  isConfigLoaded,
  SPREADSHEET_IDS,
  GOOGLE_CONFIG,
} from "./googleConfig";
import { initializeServiceAccount } from "../services/googleSheets/utils";

// Try Config tab first (standard location), fallback to UserDetail tab
const CONFIG_SHEET_NAMES = ["Config", "UserDetail"];
const CONFIG_RANGE_VERTICAL = "!A:B"; // Key-value pairs in columns A and B
const CONFIG_RANGE_HORIZONTAL = "!A1:Z100"; // Headers in row 1, values in rows below

let cachedConfig: Record<string, string> | null = null;
let lastLoadedAt: Date | null = null;

const ensureFetchAvailable = (): void => {
  if (typeof fetch !== "function") {
    throw new Error(
      "Global fetch API is not available. Please run on Node.js 18+ or provide a fetch polyfill.",
    );
  }
};

interface LoadConfigOptions {
  forceReload?: boolean;
}

export const loadConfigFromSheet = async (
  accessToken: string,
  { forceReload = false }: LoadConfigOptions = {},
): Promise<Record<string, string>> => {
  if (!forceReload && isConfigLoaded() && cachedConfig) {
    return cachedConfig;
  }

  if (!accessToken) {
    throw new Error("Google access token is required to load configuration.");
  }

  // Get LOGIN_SPREADSHEET_ID from environment variable directly
  // This is set in .env file and loaded by dotenv.config() in index.ts
  const loginSpreadsheetId =
    process.env.LOGIN_SPREADSHEET_ID || SPREADSHEET_IDS.LOGIN;

  if (!loginSpreadsheetId || loginSpreadsheetId.trim() === "") {
    throw new Error(
      "LOGIN_SPREADSHEET_ID is not configured. Set it in the .env file and restart the server.",
    );
  }

  ensureFetchAvailable();

  let configMap: Record<string, string> = {};
  let lastError: Error | null = null;

  // Try each sheet name
  for (const sheetName of CONFIG_SHEET_NAMES) {
    try {
      // First try vertical format (A:B - key in column A, value in column B)
      let response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${loginSpreadsheetId}/values/${encodeURIComponent(sheetName + CONFIG_RANGE_VERTICAL)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const payload = (await response.json()) as { values?: string[][] };
        const rows = payload.values || [];

        if (rows.length >= 2) {
          // Parse vertical format (key-value pairs)
          // Exclude spreadsheet IDs - they should come from UserDetail tab per-user
          const excludedKeys = [
            "QUESTION_BANK_SPREADSHEET_ID",
            "PRACTICAL_TASKS_SPREADSHEET_ID",
            "WORK_SUMMARY_SPREADSHEET_ID",
            "KANBAN_BOARD_SPREADSHEET_ID",
            "NOTES_SPREADSHEET_ID",
            "PROJECT_LISTING_SPREADSHEET_ID",
            "TAGS_SPREADSHEET_ID",
          ];
          for (let i = 1; i < rows.length; i += 1) {
            const [rawKey, rawValue] = rows[i];
            if (!rawKey) {
              continue;
            }
            const normalizedKey = rawKey.trim().toUpperCase();
            // Skip spreadsheet ID keys
            if (
              excludedKeys.some(
                (key) => normalizedKey === key || normalizedKey.includes(key),
              )
            ) {
              continue;
            }
            configMap[rawKey.trim()] = (rawValue ?? "").trim();
          }

          // If we got valid config, break out of the loop
          if (Object.keys(configMap).length > 0) {
            break;
          }
        }
      }

      // If vertical format didn't work, try horizontal format (headers in row 1)
      response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${loginSpreadsheetId}/values/${encodeURIComponent(sheetName + CONFIG_RANGE_HORIZONTAL)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const payload = (await response.json()) as { values?: string[][] };
        const rows = payload.values || [];

        if (rows.length >= 2) {
          // Find header row (row 0) - look for spreadsheet ID headers
          const headers = rows[0] || [];
          const headerIndices: Record<string, number> = {};

          headers.forEach((header, index) => {
            if (header && typeof header === "string") {
              const normalizedHeader = header.trim().toUpperCase();
              // Map headers to config keys - check exact matches first, then partial matches
              // NOTE: Spreadsheet IDs are now loaded from UserDetail tab per-user, not from Config tab
              const configKeyMap: Record<string, string> = {
                // Spreadsheet IDs excluded - these should come from UserDetail tab per-user
                // "KANBAN_BOARD_SPREADSHEET_ID": "KANBAN_BOARD_SPREADSHEET_ID",
                // "QUESTION_BANK_SPREADSHEET_ID": "QUESTION_BANK_SPREADSHEET_ID",
                // "PRACTICAL_TASKS_SPREADSHEET_ID": "PRACTICAL_TASKS_SPREADSHEET_ID",
                // "WORK_SUMMARY_SPREADSHEET_ID": "WORK_SUMMARY_SPREADSHEET_ID",
                // "PROJECT_LISTING_SPREADSHEET_ID": "PROJECT_LISTING_SPREADSHEET_ID",
                // "NOTES_SPREADSHEET_ID": "NOTES_SPREADSHEET_ID",
                // "TAGS_SPREADSHEET_ID": "TAGS_SPREADSHEET_ID",
                GOOGLE_API_KEY: "GOOGLE_API_KEY",
                GOOGLE_CLIENT_ID: "GOOGLE_CLIENT_ID",
                CLIENT_ID: "GOOGLE_CLIENT_ID",
                GOOGLE_CLIENT_SECRET: "GOOGLE_CLIENT_SECRET",
                CLIENT_SECRET: "GOOGLE_CLIENT_SECRET",
                SERVICE_ACCOUNT_KEY: "SERVICE_ACCOUNT_KEY",
                JWT_SECRET: "JWT_SECRET",
              };

              // Check for exact match first
              if (configKeyMap[normalizedHeader]) {
                headerIndices[configKeyMap[normalizedHeader]] = index;
              } else {
                // Fall back to partial matches
                // NOTE: Spreadsheet IDs are excluded - they come from UserDetail tab per-user
                // if (normalizedHeader.includes("KANBAN_BOARD") && !headerIndices["KANBAN_BOARD_SPREADSHEET_ID"]) {
                //   headerIndices["KANBAN_BOARD_SPREADSHEET_ID"] = index;
                // } else if (normalizedHeader.includes("QUESTION_BANK") && !headerIndices["QUESTION_BANK_SPREADSHEET_ID"]) {
                //   headerIndices["QUESTION_BANK_SPREADSHEET_ID"] = index;
                // } else if (normalizedHeader.includes("PRACTICAL_TASKS") && !headerIndices["PRACTICAL_TASKS_SPREADSHEET_ID"]) {
                //   headerIndices["PRACTICAL_TASKS_SPREADSHEET_ID"] = index;
                // } else if (normalizedHeader.includes("WORK_SUMMARY") && !headerIndices["WORK_SUMMARY_SPREADSHEET_ID"]) {
                //   headerIndices["WORK_SUMMARY_SPREADSHEET_ID"] = index;
                // } else if (normalizedHeader.includes("PROJECT_LISTING") && !headerIndices["PROJECT_LISTING_SPREADSHEET_ID"]) {
                //   headerIndices["PROJECT_LISTING_SPREADSHEET_ID"] = index;
                // } else if (normalizedHeader.includes("NOTES") && normalizedHeader.includes("SPREADSHEET") && !headerIndices["NOTES_SPREADSHEET_ID"]) {
                //   headerIndices["NOTES_SPREADSHEET_ID"] = index;
                // } else if (normalizedHeader.includes("TAGS") && normalizedHeader.includes("SPREADSHEET") && !headerIndices["TAGS_SPREADSHEET_ID"]) {
                //   headerIndices["TAGS_SPREADSHEET_ID"] = index;
                // } else
                if (
                  normalizedHeader.includes("GOOGLE_API_KEY") &&
                  !headerIndices["GOOGLE_API_KEY"]
                ) {
                  headerIndices["GOOGLE_API_KEY"] = index;
                } else if (
                  normalizedHeader.includes("CLIENT_ID") &&
                  !normalizedHeader.includes("SECRET") &&
                  !headerIndices["GOOGLE_CLIENT_ID"]
                ) {
                  headerIndices["GOOGLE_CLIENT_ID"] = index;
                } else if (
                  normalizedHeader.includes("CLIENT_SECRET") &&
                  !headerIndices["GOOGLE_CLIENT_SECRET"]
                ) {
                  headerIndices["GOOGLE_CLIENT_SECRET"] = index;
                } else if (
                  normalizedHeader.includes("SERVICE_ACCOUNT") &&
                  !headerIndices["SERVICE_ACCOUNT_KEY"]
                ) {
                  headerIndices["SERVICE_ACCOUNT_KEY"] = index;
                } else if (
                  normalizedHeader.includes("JWT_SECRET") &&
                  !headerIndices["JWT_SECRET"]
                ) {
                  headerIndices["JWT_SECRET"] = index;
                }
              }
            }
          });

          // Extract values from data rows (rows 1+)
          // Use the first non-empty value for each config key
          for (let i = 1; i < rows.length; i += 1) {
            const row = rows[i] || [];
            Object.entries(headerIndices).forEach(([key, colIndex]) => {
              // Only set if not already set (use first non-empty value)
              if (!configMap[key]) {
                const value = row[colIndex];
                if (value && typeof value === "string" && value.trim()) {
                  configMap[key] = value.trim();
                }
              }
            });
          }

          // If we got valid config, break out of the loop
          if (Object.keys(configMap).length > 0) {
            break;
          }
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next sheet name
      continue;
    }
  }

  if (Object.keys(configMap).length === 0) {
    throw new Error(
      `Failed to load configuration from sheet. Tried sheets: ${CONFIG_SHEET_NAMES.join(", ")}. ${lastError ? lastError.message : "No valid configuration found."}`,
    );
  }

  applySheetConfig(configMap);
  cachedConfig = { ...configMap };
  lastLoadedAt = new Date();

  // Initialize service account if configured
  if (GOOGLE_CONFIG.SERVICE_ACCOUNT_KEY) {
    try {
      initializeServiceAccount(GOOGLE_CONFIG.SERVICE_ACCOUNT_KEY);
    } catch (error) {
      // Log error but don't fail config loading
      console.error("Failed to initialize service account:", error);
    }
  }

  return cachedConfig;
};

export const getCachedConfig = (): {
  loadedAt: Date;
  values: Record<string, string>;
} | null => {
  if (!cachedConfig) {
    return null;
  }
  return {
    loadedAt: lastLoadedAt!,
    values: { ...cachedConfig },
  };
};
