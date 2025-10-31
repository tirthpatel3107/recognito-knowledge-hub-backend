/**
 * Google API Configuration
 * Loads configuration from environment variables
 */
import dotenv from 'dotenv';

dotenv.config();

export const GOOGLE_CONFIG = {
  API_KEY: process.env.GOOGLE_API_KEY || '',
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

export const SPREADSHEET_IDS = {
  LOGIN: process.env.LOGIN_SPREADSHEET_ID || '',
  QUESTION_BANK: process.env.QUESTION_BANK_SPREADSHEET_ID || '',
  PRACTICAL_TASKS: process.env.PRACTICAL_TASKS_SPREADSHEET_ID || '',
  WORK_SUMMARY: process.env.WORK_SUMMARY_SPREADSHEET_ID || '',
  PROJECT_LISTING: process.env.PROJECT_LISTING_SPREADSHEET_ID || '',
};

export const DOC_IDS = {
  TODO: process.env.TODO_DOC_ID || '',
  CREDENTIAL: process.env.CREDENTIAL_DOC_ID || '',
  WORK_SUMMARY: process.env.WORK_SUMMARY_DOC_ID || '',
  PROJECT: process.env.PROJECT_DOC_ID || '',
};

// Validate required environment variables
const requiredVars = [
  'GOOGLE_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'LOGIN_SPREADSHEET_ID',
  'QUESTION_BANK_SPREADSHEET_ID',
];

const missingVars = requiredVars.filter(
  (varName) => !process.env[varName]
);

if (missingVars.length > 0) {
  console.warn(
    `Warning: Missing required environment variables: ${missingVars.join(', ')}`
  );
}
