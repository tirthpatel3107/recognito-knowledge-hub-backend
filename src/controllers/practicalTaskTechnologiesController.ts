/**
 * Practical Task Technologies Controller
 * Handles practical task technology-related operations
 */
import { Request, Response } from 'express';
import {
  getPracticalTaskTechnologies,
  createPracticalTaskTechnology,
  updatePracticalTaskTechnology,
  deletePracticalTaskTechnology,
  reorderPracticalTaskTechnologies,
  setUserCredentials,
  authenticateUser,
} from '../services/googleSheetsService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError, sendValidationError, sendNotFound } from '../utils/responseHelper';
import { getGoogleTokenFromRequest } from '../utils/googleTokenHelper';

/**
 * Get all practical task technologies
 */
export const getAllPracticalTaskTechnologies = asyncHandler(async (req: Request, res: Response) => {
  try {
    const googleToken = getGoogleTokenFromRequest(req);
    const technologies = await getPracticalTaskTechnologies(googleToken);
    return sendSuccess(res, technologies);
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.message && error.message.includes('PRACTICAL_TASKS_SPREADSHEET_ID is not configured')) {
      return sendError(res, 'Configuration not loaded. Please authenticate first to load configuration from Google Sheets.', 503);
    }
    if (error.message && error.message.includes('Google API key is not configured')) {
      return sendError(res, 'Google API key is not configured. Please authenticate to load configuration.', 503);
    }
    // Re-throw to let asyncHandler handle it
    throw error;
  }
});

/**
 * Create a new practical task technology
 */
export const createPracticalTaskTechnologyHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { name } = req.body;

  if (!name) {
    return sendValidationError(res, 'Technology name is required');
  }

  const success = await createPracticalTaskTechnology(name);

  if (success) {
    return sendSuccess(res, null, 'Technology created successfully');
  } else {
    return sendError(res, 'Failed to create technology', 500);
  }
});

/**
 * Update a practical task technology
 */
export const updatePracticalTaskTechnologyHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { sheetId } = req.params;
  const { oldName, newName } = req.body;

  if (!oldName || !newName) {
    return sendValidationError(res, 'Old name and new name are required');
  }

  const success = await updatePracticalTaskTechnology(oldName, newName, parseInt(sheetId));

  if (success) {
    return sendSuccess(res, null, 'Technology updated successfully');
  } else {
    return sendError(res, 'Failed to update technology', 500);
  }
});

/**
 * Delete a practical task technology
 */
export const deletePracticalTaskTechnologyHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user!.email;
  const googleToken = getGoogleTokenFromRequest(req);
  const { sheetId } = req.params;
  const { password } = req.body;

  // Validate password is provided
  if (!password) {
    return sendValidationError(res, 'Password is required to delete technology');
  }

  // Validate Google token is available
  if (!googleToken) {
    return sendError(res, 'Google access token is required', 401);
  }

  // Verify password before allowing deletion
  const isPasswordValid = await authenticateUser(email, password, googleToken);
  if (!isPasswordValid) {
    return sendError(res, 'Incorrect password', 401);
  }

  // Set user credentials and proceed with deletion
  setUserCredentials(googleToken);
  const result = await deletePracticalTaskTechnology(parseInt(sheetId));

  if (result.success) {
    return sendSuccess(res, null, 'Technology deleted successfully');
  } else {
    return sendError(res, result.error || 'Failed to delete technology', 400);
  }
});

/**
 * Reorder practical task technologies
 */
export const reorderPracticalTaskTechnologiesHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { technologyIds } = req.body;

  if (!Array.isArray(technologyIds)) {
    return sendValidationError(res, 'technologyIds must be an array');
  }

  const success = await reorderPracticalTaskTechnologies(technologyIds);

  if (success) {
    return sendSuccess(res, null, 'Technologies reordered successfully');
  } else {
    return sendError(res, 'Failed to reorder technologies', 500);
  }
});

