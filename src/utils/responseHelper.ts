/**
 * Response Helper Utility
 * Provides standardized response methods for controllers
 */
import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Send a successful response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  if (message) {
    response.message = message;
  }
  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 */
export const sendError = (
  res: Response,
  error: string,
  statusCode: number = 500,
  details?: any
): Response => {
  const response: ApiResponse = {
    success: false,
    error,
  };
  if (details) {
    response.data = details;
  }
  return res.status(statusCode).json(response);
};

/**
 * Send a validation error response
 */
export const sendValidationError = (
  res: Response,
  error: string,
  details?: any
): Response => {
  return sendError(res, error, 400, details);
};

/**
 * Send a not found error response
 */
export const sendNotFound = (res: Response, resource: string = 'Resource'): Response => {
  return sendError(res, `${resource} not found`, 404);
};

/**
 * Send an unauthorized error response
 */
export const sendUnauthorized = (res: Response, message: string = 'Unauthorized'): Response => {
  return sendError(res, message, 401);
};

