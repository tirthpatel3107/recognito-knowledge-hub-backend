/**
 * Error Messages Constants (Backend)
 * Centralized error messages for consistency
 */

export const ERROR_MESSAGES = {
  // Authentication errors
  AUTH: {
    REQUIRED: "Authentication required",
    TOKEN_INVALID: "Invalid or expired token",
    TOKEN_REQUIRED: "Access token required",
    TOKEN_VERIFICATION_FAILED: "Token verification failed",
    GOOGLE_TOKEN_REQUIRED: "Google OAuth token required",
    LOGIN_FAILED: "Invalid email or password",
    EMAIL_MISMATCH: "Email mismatch between login and Google account",
  },

  // Validation errors
  VALIDATION: {
    REQUIRED: "Required field is missing",
    INVALID_FORMAT: "Invalid format",
    INVALID_EMAIL: "Invalid email format",
    INVALID_PASSWORD: "Invalid password",
  },

  // Resource errors
  RESOURCE: {
    NOT_FOUND: "Resource not found",
    ALREADY_EXISTS: "Resource already exists",
    DELETE_FAILED: "Failed to delete resource",
    UPDATE_FAILED: "Failed to update resource",
    CREATE_FAILED: "Failed to create resource",
  },

  // Google Sheets errors
  GOOGLE_SHEETS: {
    CONFIG_ERROR: "Google Sheets configuration error",
    API_ERROR: "Google Sheets API error",
    PERMISSION_DENIED: "Permission denied to access Google Sheets",
    SHEET_NOT_FOUND: "Sheet not found",
    SPREADSHEET_NOT_FOUND: "Spreadsheet not found",
  },

  // Server errors
  SERVER: {
    INTERNAL_ERROR: "Internal server error",
    CONFIGURATION_ERROR: "Server configuration error",
    DATABASE_ERROR: "Database error",
  },
} as const;
