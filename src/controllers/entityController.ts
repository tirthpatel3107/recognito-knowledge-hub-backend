/**
 * Entity Controller
 * Handles entity-related operations
 */
import { Request, Response } from "express";
import { getEntities, addEntity, updateEntity, deleteEntity } from "../services/mongodb/entity";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";

/**
 * Get all entities for the authenticated user
 */
export const getAllEntities = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const entities = await getEntities(userId);
  return sendSuccess(res, entities);
});

/**
 * Add an entity
 */
export const addEntityHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return sendValidationError(res, "Entity name is required");
    }

    const userId = req.user!.userId;
    const success = await addEntity(name.trim(), userId);

    if (success) {
      return sendSuccess(res, null, "Entity added successfully");
    } else {
      return sendError(res, "Failed to add entity (entity may already exist)", 500);
    }
  },
);

/**
 * Update an entity
 */
export const updateEntityHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rowIndex } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return sendValidationError(res, "Entity name is required");
    }

    // Get entities to find the entity ID
    const userId = req.user!.userId;
    const entities = await getEntities(userId);
    const entityToUpdate = entities[parseInt(rowIndex)];

    if (!entityToUpdate) {
      return sendError(res, "Entity not found", 404);
    }

    const success = await updateEntity(entityToUpdate.id, name.trim(), userId);

    if (success) {
      return sendSuccess(res, null, "Entity updated successfully");
    } else {
      return sendError(res, "Failed to update entity", 500);
    }
  },
);

/**
 * Delete an entity
 */
export const deleteEntityHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rowIndex } = req.params;

    // Get entities to find the entity ID
    const userId = req.user!.userId;
    const entities = await getEntities(userId);
    const entityToDelete = entities[parseInt(rowIndex)];

    if (!entityToDelete) {
      return sendError(res, "Entity not found", 404);
    }

    const success = await deleteEntity(entityToDelete.id, userId);

    if (success) {
      return sendSuccess(res, null, "Entity deleted successfully");
    } else {
      return sendError(res, "Failed to delete entity", 500);
    }
  },
);

