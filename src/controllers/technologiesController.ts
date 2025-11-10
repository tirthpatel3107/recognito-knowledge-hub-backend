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
  setUserCredentials(req.googleToken!);
  const { sheetId } = req.params;

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

