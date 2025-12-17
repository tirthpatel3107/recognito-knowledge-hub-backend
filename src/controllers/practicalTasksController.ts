/**
 * Practical Tasks Controller
 * Handles practical tasks-related operations
 */
import { Request, Response } from "express";
import {
  getPracticalTasks,
  addPracticalTask,
  updatePracticalTask,
  deletePracticalTask,
  reorderPracticalTasks,
  reorderPracticalTasksByIds,
} from "../services/mongodb/practicalTasks";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";

/**
 * Get all practical tasks (deprecated - use getPracticalTasksByTechnology)
 */
export const getAllPracticalTasks = asyncHandler(
  async (req: Request, res: Response) => {
    return sendError(res, "Please use /practical-tasks/:technologyName endpoint", 400);
  },
);

/**
 * Get practical tasks for a technology
 */
export const getPracticalTasksByTechnologyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName } = req.params;

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

    const tasks = await getPracticalTasks(technologyName, page, limit);
    return sendSuccess(res, tasks);
  },
);

/**
 * Add a practical task
 */
export const addPracticalTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName } = req.params;
    const { question, answer, example, priority } = req.body;

    if (!question || !answer) {
      return sendValidationError(res, "Question and answer are required");
    }

    try {
      const success = await addPracticalTask(technologyName, {
        question,
        answer,
        example,
        priority: priority || "low",
      });

      if (success) {
        return sendSuccess(res, null, "Practical task added successfully");
      } else {
        return sendError(res, "Failed to add practical task", 500);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return sendError(res, errorMessage, 500);
    }
  },
);

/**
 * Update a practical task
 */
export const updatePracticalTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName, rowIndex } = req.params;
    const { question, answer, example, priority } = req.body;

    if (!question || !answer) {
      return sendValidationError(res, "Question and answer are required");
    }

    // Get tasks to find the task ID
    const tasks = await getPracticalTasks(technologyName);
    const taskArray = Array.isArray(tasks) ? tasks : tasks.data;
    const taskToUpdate = taskArray[parseInt(rowIndex)];

    if (!taskToUpdate) {
      return sendError(res, "Practical task not found", 404);
    }

    const success = await updatePracticalTask(
      technologyName,
      taskToUpdate.id,
      { question, answer, example, priority: priority || "low" },
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
    const { technologyName, rowIndex } = req.params;

    // Get tasks to find the task ID
    const tasks = await getPracticalTasks(technologyName);
    const taskArray = Array.isArray(tasks) ? tasks : tasks.data;
    const taskToDelete = taskArray[parseInt(rowIndex)];

    if (!taskToDelete) {
      return sendError(res, "Practical task not found", 404);
    }

    const success = await deletePracticalTask(technologyName, taskToDelete.id);

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
    const { technologyName } = req.params;
    const { oldIndex, newIndex, taskIds } = req.body;

    // Support both formats: { oldIndex, newIndex } or { taskIds: [] }
    if (oldIndex !== undefined && newIndex !== undefined) {
      // Handle oldIndex/newIndex format
      if (typeof oldIndex !== "number" || typeof newIndex !== "number") {
        return sendValidationError(
          res,
          "oldIndex and newIndex must be numbers",
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
    } else if (Array.isArray(taskIds)) {
      // Handle taskIds array format (backward compatibility)
      const success = await reorderPracticalTasksByIds(
        technologyName,
        taskIds,
      );

      if (success) {
        return sendSuccess(res, null, "Practical tasks reordered successfully");
      } else {
        return sendError(res, "Failed to reorder practical tasks", 500);
      }
    } else {
      return sendValidationError(
        res,
        "Either oldIndex/newIndex or taskIds array is required",
      );
    }
  },
);
