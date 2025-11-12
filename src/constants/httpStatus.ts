/**
 * HTTP Status Codes Constants (Backend)
 * Centralized HTTP status codes for consistency
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  NOT_MODIFIED: 304,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Response Keys Constants
 */
export const RESPONSE_KEYS = {
  SUCCESS: "success",
  ERROR: "error",
  MESSAGE: "message",
  DATA: "data",
} as const;
