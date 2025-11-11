/**
 * Technologies Controller
 * Handles technology-related operations
 */
import { Request, Response } from 'express';
import {
  getTechnologies,
  createTechnology,
  updateTechnology,
  deleteTechnology,
  reorderTechnologies,
  setUserCredentials,
  authenticateUser,
} from '../services/googleSheetsService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError, sendValidationError, sendNotFound } from '../utils/responseHelper';
import { getGoogleTokenFromRequest } from '../utils/googleTokenHelper';

/**
 * Get all technologies
 */
export const getAllTechnologies = asyncHandler(async (req: Request, res: Response) => {
  const googleToken = getGoogleTokenFromRequest(req);
  const technologies = await getTechnologies(googleToken);
  return sendSuccess(res, technologies);
});

/**
 * Create a new technology
 */
export const createTechnologyHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { name } = req.body;

  if (!name) {
    return sendValidationError(res, 'Technology name is required');
  }

  const success = await createTechnology(name);

  if (success) {
    return sendSuccess(res, null, 'Technology created successfully');
  } else {
    return sendError(res, 'Failed to create technology', 500);
  }
});

/**
 * Update a technology
 */
export const updateTechnologyHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { sheetId } = req.params;
  const { oldName, newName } = req.body;

  if (!oldName || !newName) {
    return sendValidationError(res, 'Old name and new name are required');
  }

  const success = await updateTechnology(oldName, newName, parseInt(sheetId));

  if (success) {
    return sendSuccess(res, null, 'Technology updated successfully');
  } else {
    return sendError(res, 'Failed to update technology', 500);
  }
});

/**
 * Delete a technology
 */
export const deleteTechnologyHandler = asyncHandler(async (req: Request, res: Response) => {
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
  const success = await deleteTechnology(parseInt(sheetId));

  if (success) {
    return sendSuccess(res, null, 'Technology deleted successfully');
  } else {
    return sendError(res, 'Failed to delete technology', 500);
  }
});

/**
 * Reorder technologies
 */
export const reorderTechnologiesHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { technologyIds } = req.body;

  if (!Array.isArray(technologyIds)) {
    return sendValidationError(res, 'technologyIds must be an array');
  }

  const success = await reorderTechnologies(technologyIds);

  if (success) {
    return sendSuccess(res, null, 'Technologies reordered successfully');
  } else {
    return sendError(res, 'Failed to reorder technologies', 500);
  }
});

