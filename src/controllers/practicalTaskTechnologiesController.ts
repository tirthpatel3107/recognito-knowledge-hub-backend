/**
 * Practical Task Technologies Controller
 * Handles practical task technology-related operations
 */
import { Request, Response } from "express";
import { getPracticalTaskTechnologies } from "../services/mongodb/practicalTaskTechnologies";
import { getTechnologies, createTechnology, updateTechnology, deleteTechnology, reorderTechnologies } from "../services/mongodb/technologies";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";

/**
 * Get all practical task technologies
 */
export const getAllPracticalTaskTechnologies = asyncHandler(
  async (req: Request, res: Response) => {
    const technologies = await getPracticalTaskTechnologies();
    return sendSuccess(res, technologies);
  },
);

/**
 * Create a new practical task technology
 */
export const createPracticalTaskTechnologyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { name } = req.body;

    if (!name) {
      return sendValidationError(res, "Technology name is required");
    }

    const result = await createTechnology(name);

    if (result.success) {
      return sendSuccess(res, null, "Technology created successfully");
    } else {
      return sendError(res, result.error || "Failed to create technology", 500);
    }
  },
);

/**
 * Update a practical task technology
 */
export const updatePracticalTaskTechnologyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { sheetId } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return sendValidationError(res, "New name is required");
    }

    const success = await updateTechnology(sheetId, newName);

    if (success) {
      return sendSuccess(res, null, "Technology updated successfully");
    } else {
      return sendError(res, "Failed to update technology", 500);
    }
  },
);

/**
 * Delete a practical task technology
 */
export const deletePracticalTaskTechnologyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { sheetId } = req.params;

    const result = await deleteTechnology(sheetId);

    if (result.success) {
      return sendSuccess(res, null, "Technology deleted successfully");
    } else {
      return sendError(res, result.error || "Failed to delete technology", 400);
    }
  },
);

/**
 * Reorder practical task technologies
 */
export const reorderPracticalTaskTechnologiesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyIds } = req.body;

    if (!Array.isArray(technologyIds)) {
      return sendValidationError(res, "technologyIds must be an array");
    }

    if (technologyIds.length === 0) {
      return sendValidationError(res, "technologyIds array cannot be empty");
    }

    const success = await reorderTechnologies(technologyIds);

    if (success) {
      return sendSuccess(res, null, "Technologies reordered successfully");
    } else {
      return sendError(res, "Failed to reorder technologies", 500);
    }
  },
);
