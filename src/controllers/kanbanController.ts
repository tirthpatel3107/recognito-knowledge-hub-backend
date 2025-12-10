/**
 * Kanban Board Controller
 * Handles kanban board API requests
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";
import { getKanbanTasks, saveKanbanTasks, type KanbanTask } from "../services/googleSheets/kanban";
import { getGoogleTokenFromRequest } from "../utils/googleTokenHelper";

/**
 * Get all kanban tasks grouped by column
 */
export const getTasks = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const email = req.user?.email || null;
      const googleToken = getGoogleTokenFromRequest(req);
      const tasksByColumn = await getKanbanTasks(email, googleToken);
      return sendSuccess(res, tasksByColumn, "Tasks retrieved successfully");
    } catch (error: any) {
      return sendError(
        res,
        error?.message || "Failed to retrieve tasks",
        500,
      );
    }
  },
);

/**
 * Save all kanban tasks
 */
export const saveTasks = asyncHandler(
  async (req: Request, res: Response) => {
    const { tasks } = req.body;

    if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) {
      return sendValidationError(res, "Tasks must be an object with column keys");
    }

    try {
      const email = req.user?.email || null;
      const googleToken = getGoogleTokenFromRequest(req);

      // Flatten tasks from all columns
      const allTasks: KanbanTask[] = [];
      if (tasks) {
        Object.values(tasks).forEach((columnTasks: any) => {
          if (Array.isArray(columnTasks)) {
            allTasks.push(...columnTasks);
          }
        });
      }

      const success = await saveKanbanTasks(allTasks, email, googleToken);
      if (success) {
        return sendSuccess(res, null, "Tasks saved successfully");
      } else {
        return sendError(res, "Failed to save tasks", 500);
      }
    } catch (error: any) {
      return sendError(
        res,
        error?.message || "Failed to save tasks",
        500,
      );
    }
  },
);

