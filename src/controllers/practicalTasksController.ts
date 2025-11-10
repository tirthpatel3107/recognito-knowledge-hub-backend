/**
 * Practical Tasks Controller
 * Handles practical tasks-related operations
 */
import { Request, Response } from 'express';
import { getPracticalTasks } from '../services/googleSheetsService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { getGoogleTokenFromRequest } from '../utils/googleTokenHelper';

/**
 * Get all practical tasks
 */
export const getAllPracticalTasks = asyncHandler(async (req: Request, res: Response) => {
  const googleToken = getGoogleTokenFromRequest(req);
  const tasks = await getPracticalTasks(googleToken);
  return sendSuccess(res, tasks);
});

