/**
 * Google API configuration populated from the secured Google Sheet.
 * The only environment variable read at runtime is LOGIN_SPREADSHEET_ID.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface GoogleConfig {
  API_KEY: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  SCOPES: string[];
}

export interface SpreadsheetIds {
  LOGIN: string;
  QUESTION_BANK: string;
  PRACTICAL_TASKS: string;
  WORK_SUMMARY: string;
  PROJECT_LISTING: string;
}

export interface DocIds {
  TODO: string;
  CREDENTIAL: string;
  WORK_SUMMARY: string;
  PROJECT: string;
}

export interface ServiceConfig {
  JWT_SECRET: string;
  FRONTEND_URL: string;
  PORT: number;
  NODE_ENV: string;
  JWT_EXPIRES_IN: string;
}

interface PersistedConfig {
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  savedAt: number;
}

export const GOOGLE_CONFIG: GoogleConfig = {
  API_KEY: '',
  CLIENT_ID: '',
  CLIENT_SECRET: '',
  REDIRECT_URI: '',
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

export const SPREADSHEET_IDS: SpreadsheetIds = {
  LOGIN: process.env.LOGIN_SPREADSHEET_ID || '',
  QUESTION_BANK: '',
  PRACTICAL_TASKS: '',
  WORK_SUMMARY: '',
  PROJECT_LISTING: '',
};

export const DOC_IDS: DocIds = {
  TODO: '',
  CREDENTIAL: '',
  WORK_SUMMARY: '',
  PROJECT: '',
};

const SERVICE_CONFIG: ServiceConfig = {
  JWT_SECRET: '',
  FRONTEND_URL: 'http://localhost:5173',
  PORT: 3001,
  NODE_ENV: 'development',
  JWT_EXPIRES_IN: '24h',
};

let configLoaded = false;

const normalizeKey = (key: string = ''): string => key.trim().toUpperCase();

export const applySheetConfig = (configMap: Record<string, string> = {}): void => {
  const normalizedEntries = Object.entries(configMap)
    .filter(([key]) => typeof key === 'string' && key.trim() !== '')
    .map(([key, value]) => [normalizeKey(key), value?.toString() ?? '']);

  const normalizedConfig = Object.fromEntries(normalizedEntries) as Record<string, string>;

  GOOGLE_CONFIG.API_KEY = normalizedConfig.GOOGLE_API_KEY ?? GOOGLE_CONFIG.API_KEY;
  GOOGLE_CONFIG.CLIENT_ID = normalizedConfig.GOOGLE_CLIENT_ID ?? GOOGLE_CONFIG.CLIENT_ID;
  GOOGLE_CONFIG.CLIENT_SECRET =
    normalizedConfig.GOOGLE_CLIENT_SECRET ?? GOOGLE_CONFIG.CLIENT_SECRET;
  GOOGLE_CONFIG.REDIRECT_URI =
    normalizedConfig.GOOGLE_REDIRECT_URI ?? GOOGLE_CONFIG.REDIRECT_URI;

  SPREADSHEET_IDS.QUESTION_BANK =
    normalizedConfig.QUESTION_BANK_SPREADSHEET_ID ?? SPREADSHEET_IDS.QUESTION_BANK;
  SPREADSHEET_IDS.PRACTICAL_TASKS =
    normalizedConfig.PRACTICAL_TASKS_SPREADSHEET_ID ?? SPREADSHEET_IDS.PRACTICAL_TASKS;
  SPREADSHEET_IDS.WORK_SUMMARY =
    normalizedConfig.WORK_SUMMARY_SPREADSHEET_ID ?? SPREADSHEET_IDS.WORK_SUMMARY;
  SPREADSHEET_IDS.PROJECT_LISTING =
    normalizedConfig.PROJECT_LISTING_SPREADSHEET_ID ?? SPREADSHEET_IDS.PROJECT_LISTING;

  DOC_IDS.TODO = normalizedConfig.TODO_DOC_ID ?? DOC_IDS.TODO;
  DOC_IDS.CREDENTIAL = normalizedConfig.CREDENTIAL_DOC_ID ?? DOC_IDS.CREDENTIAL;
  DOC_IDS.WORK_SUMMARY = normalizedConfig.WORK_SUMMARY_DOC_ID ?? DOC_IDS.WORK_SUMMARY;
  DOC_IDS.PROJECT = normalizedConfig.PROJECT_DOC_ID ?? DOC_IDS.PROJECT;

  SERVICE_CONFIG.JWT_SECRET =
    normalizedConfig.JWT_SECRET ?? SERVICE_CONFIG.JWT_SECRET;
  SERVICE_CONFIG.FRONTEND_URL =
    normalizedConfig.FRONTEND_URL ?? SERVICE_CONFIG.FRONTEND_URL;
  SERVICE_CONFIG.JWT_EXPIRES_IN =
    normalizedConfig.JWT_EXPIRES_IN ?? SERVICE_CONFIG.JWT_EXPIRES_IN;

  if (normalizedConfig.PORT) {
    const parsedPort = Number(normalizedConfig.PORT);
    if (!Number.isNaN(parsedPort) && parsedPort > 0) {
      SERVICE_CONFIG.PORT = parsedPort;
    }
  }

  if (normalizedConfig.NODE_ENV) {
    SERVICE_CONFIG.NODE_ENV = normalizedConfig.NODE_ENV;
  }

  configLoaded = true;

  // Persist critical config to disk so it survives server restarts
  persistServiceConfig().catch((error) => {
    console.warn('Failed to persist config after update:', error);
  });
};

export const isConfigLoaded = (): boolean => configLoaded;

export const getServiceConfigValue = (key: string): string | number | null => {
  const normalized = normalizeKey(key);
  return (SERVICE_CONFIG as any)[normalized] ?? null;
};

export const requireServiceConfigValue = (key: string): string | number => {
  const value = getServiceConfigValue(key);
  if (value === null || value === undefined || value === '') {
    throw new Error(`Missing required configuration value: ${normalizeKey(key)}`);
  }
  return value;
};

export const getAllServiceConfig = (): ServiceConfig => ({ ...SERVICE_CONFIG });

// Config persistence to survive server restarts
const CONFIG_CACHE_DIR = join(__dirname, '..', '..', '.config-cache');
const CONFIG_CACHE_FILE = join(CONFIG_CACHE_DIR, 'service-config.json');

/**
 * Save critical config values to disk so they persist across server restarts
 * Only saves non-sensitive service config (JWT_SECRET, JWT_EXPIRES_IN)
 */
export const persistServiceConfig = async (): Promise<void> => {
  try {
    // Only persist critical config that's needed for token verification
    const configToSave: PersistedConfig = {
      JWT_SECRET: SERVICE_CONFIG.JWT_SECRET,
      JWT_EXPIRES_IN: SERVICE_CONFIG.JWT_EXPIRES_IN,
      savedAt: Date.now(),
    };

    // Skip if JWT_SECRET is empty (nothing to persist)
    if (!configToSave.JWT_SECRET) {
      return;
    }

    // Ensure cache directory exists
    if (!existsSync(CONFIG_CACHE_DIR)) {
      await mkdir(CONFIG_CACHE_DIR, { recursive: true });
    }

    // Write config to file
    await writeFile(CONFIG_CACHE_FILE, JSON.stringify(configToSave, null, 2), 'utf-8');
    console.log('✅ Service config persisted to disk');
  } catch (error) {
    // Don't throw - persistence is optional, just log the error
    console.warn('⚠️  Failed to persist service config:', error instanceof Error ? error.message : String(error));
  }
};

/**
 * Load persisted config from disk on server startup
 * This ensures JWT_SECRET is available even after server restarts
 */
export const loadPersistedConfig = async (): Promise<boolean> => {
  try {
    if (!existsSync(CONFIG_CACHE_FILE)) {
      return false;
    }

    const fileContent = await readFile(CONFIG_CACHE_FILE, 'utf-8');
    const persisted: PersistedConfig = JSON.parse(fileContent);

    // Validate persisted config
    if (!persisted.JWT_SECRET || typeof persisted.JWT_SECRET !== 'string') {
      console.warn('⚠️  Invalid persisted config, ignoring');
      return false;
    }

    // Restore critical config values
    SERVICE_CONFIG.JWT_SECRET = persisted.JWT_SECRET;
    if (persisted.JWT_EXPIRES_IN) {
      SERVICE_CONFIG.JWT_EXPIRES_IN = persisted.JWT_EXPIRES_IN;
    }

    const ageMinutes = Math.floor((Date.now() - (persisted.savedAt || 0)) / (1000 * 60));
    console.log(`✅ Loaded persisted service config (saved ${ageMinutes} minutes ago)`);
    configLoaded = true;
    return true;
  } catch (error) {
    // Don't throw - if we can't load persisted config, we'll load from Google Sheets on next login
    console.warn('⚠️  Failed to load persisted config:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

