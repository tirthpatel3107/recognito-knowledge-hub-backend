/**
 * Loads backend configuration from the secured Google Sheet's Config tab.
 */

import {
  applySheetConfig,
  isConfigLoaded,
  SPREADSHEET_IDS,
} from "./googleConfig";

const CONFIG_RANGE = encodeURIComponent("Config!A:B");

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

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${loginSpreadsheetId}/values/${CONFIG_RANGE}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to load configuration from sheet (status ${response.status}): ${errorBody}`,
    );
  }

  const payload = (await response.json()) as { values?: string[][] };
  const rows = payload.values || [];

  if (rows.length < 2) {
    throw new Error("Config sheet is empty or missing key/value rows.");
  }

  const configMap: Record<string, string> = {};

  for (let i = 1; i < rows.length; i += 1) {
    const [rawKey, rawValue] = rows[i];
    if (!rawKey) {
      continue;
    }
    configMap[rawKey] = rawValue ?? "";
  }

  applySheetConfig(configMap);
  cachedConfig = { ...configMap };
  lastLoadedAt = new Date();

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
