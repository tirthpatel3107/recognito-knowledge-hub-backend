/**
 * Google API configuration populated from the secured Google Sheet.
 * The only environment variable read at runtime is LOGIN_SPREADSHEET_ID.
 */

import { dirname } from 'path';
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
  JWT_EXPIRES_IN: string;
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

  configLoaded = true;
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

