/**
 * Practical Tasks Controller
 * Handles practical tasks-related operations
 */
import { Request, Response } from "express";
import {
  getPracticalTasks,
  getPracticalTasksByTechnology,
  addPracticalTask,
  updatePracticalTask,
  deletePracticalTask,
  reorderPracticalTasks,
  getPracticalTaskTechnologies,
  setUserCredentials,
} from "../services/googleSheets";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} from "../utils/responseHelper";
import { getGoogleTokenFromRequest } from "../utils/googleTokenHelper";

/**
 * Get all practical tasks
 */
export const getAllPracticalTasks = asyncHandler(
  async (req: Request, res: Response) => {
    const googleToken = getGoogleTokenFromRequest(req);
    const tasks = await getPracticalTasks(googleToken);
    return sendSuccess(res, tasks);
  },
);

/**
 * Get practical tasks for a technology
 */
export const getPracticalTasksByTechnologyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName } = req.params;
    const googleToken = getGoogleTokenFromRequest(req);

    // Parse pagination parameters from query string
    const page = req.query.page
      ? parseInt(req.query.page as string, 10)
      : undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;

    // Validate pagination parameters
    if (page !== undefined && (isNaN(page) || page < 1)) {
      return sendValidationError(res, "Page must be a positive integer");
    }
    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return sendValidationError(res, "Limit must be a positive integer");
    }

    const tasks = await getPracticalTasksByTechnology(
      technologyName,
      googleToken,
      page,
      limit,
    );
    return sendSuccess(res, tasks);
  },
);

/**
 * Add a practical task
 */
export const addPracticalTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { technologyName } = req.params;
    const { question, answer, image } = req.body;

    if (!question || !answer) {
      return sendValidationError(res, "Question and answer are required");
    }

    const success = await addPracticalTask(technologyName, {
      question,
      answer,
      image,
    });

    if (success) {
      return sendSuccess(res, null, "Practical task added successfully");
    } else {
      return sendError(res, "Failed to add practical task", 500);
    }
  },
);

/**
 * Update a practical task
 */
export const updatePracticalTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { technologyName, rowIndex } = req.params;
    const { question, answer, image } = req.body;

    if (!question || !answer) {
      return sendValidationError(res, "Question and answer are required");
    }

    const success = await updatePracticalTask(
      technologyName,
      parseInt(rowIndex),
      { question, answer, image },
    );

    if (success) {
      return sendSuccess(res, null, "Practical task updated successfully");
    } else {
      return sendError(res, "Failed to update practical task", 500);
    }
  },
);

/**
 * Delete a practical task
 */
export const deletePracticalTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { technologyName, rowIndex } = req.params;

    // Get sheet ID for the technology
    const technologies = await getPracticalTaskTechnologies(req.googleToken!);
    const tech = technologies.find((t) => t.name === technologyName);

    if (!tech || tech.sheetId === undefined) {
      return sendNotFound(res, "Technology");
    }

    const success = await deletePracticalTask(
      technologyName,
      parseInt(rowIndex),
      req.googleToken!,
    );

    if (success) {
      return sendSuccess(res, null, "Practical task deleted successfully");
    } else {
      return sendError(res, "Failed to delete practical task", 500);
    }
  },
);

/**
 * Reorder practical tasks
 */
export const reorderPracticalTasksHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { technologyName } = req.params;
    const { oldIndex, newIndex } = req.body;

    if (typeof oldIndex !== "number" || typeof newIndex !== "number") {
      return sendValidationError(
        res,
        "oldIndex and newIndex are required and must be numbers",
      );
    }

    const success = await reorderPracticalTasks(
      technologyName,
      oldIndex,
      newIndex,
    );

    if (success) {
      return sendSuccess(res, null, "Practical tasks reordered successfully");
    } else {
      return sendError(res, "Failed to reorder practical tasks", 500);
    }
  },
);
