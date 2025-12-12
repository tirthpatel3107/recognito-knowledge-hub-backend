/**
 * Google Sheets Utilities
 * Minimal utilities for Google Sheets service account initialization
 * Used only for configuration loading from Google Sheets
 */
import { google } from "googleapis";
import type { JWT } from "google-auth-library";

// Service account client for accessing Google Sheets
let serviceAccountClient: JWT | null = null;

/**
 * Initialize service account for accessing Google Sheets
 * Service account credentials should be in JSON format (from config sheet or env)
 */
export const initializeServiceAccount = (serviceAccountKey: string): void => {
  try {
    const key =
      typeof serviceAccountKey === "string"
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
