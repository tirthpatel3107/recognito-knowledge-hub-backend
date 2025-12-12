/**
 * Tags Controller
 * Handles tag-related operations
 */
import { Request, Response } from "express";
import { getTags, addTag, updateTag, deleteTag } from "../services/mongodb/tags";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";

/**
 * Get all tags for the authenticated user
 */
export const getAllTags = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const tags = await getTags(userId);
  return sendSuccess(res, tags);
});

/**
 * Add a tag
 */
export const addTagHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return sendValidationError(res, "Tag name is required");
    }

    const userId = req.user!.userId;
    const success = await addTag(name.trim(), userId);

    if (success) {
      return sendSuccess(res, null, "Tag added successfully");
    } else {
      return sendError(res, "Failed to add tag", 500);
    }
  },
);

/**
 * Update a tag
 */
export const updateTagHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rowIndex } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return sendValidationError(res, "Tag name is required");
    }

    // Get tags to find the tag ID
    const userId = req.user!.userId;
    const tags = await getTags(userId);
    const tagToUpdate = tags[parseInt(rowIndex)];

    if (!tagToUpdate) {
      return sendError(res, "Tag not found", 404);
    }

    const success = await updateTag(tagToUpdate.id, name.trim(), userId);

    if (success) {
      return sendSuccess(res, null, "Tag updated successfully");
    } else {
      return sendError(res, "Failed to update tag", 500);
    }
  },
);

/**
 * Delete a tag
 */
export const deleteTagHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rowIndex } = req.params;

    // Get tags to find the tag ID
    const userId = req.user!.userId;
    const tags = await getTags(userId);
    const tagToDelete = tags[parseInt(rowIndex)];

    if (!tagToDelete) {
      return sendError(res, "Tag not found", 404);
    }

    const success = await deleteTag(tagToDelete.id, userId);

    if (success) {
      return sendSuccess(res, null, "Tag deleted successfully");
    } else {
      return sendError(res, "Failed to delete tag", 500);
    }
  },
);
