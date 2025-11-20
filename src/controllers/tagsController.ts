/**
 * Tags Controller
 * Handles tag-related operations
 */
import { Request, Response } from "express";
import {
  getTags,
  addTag,
  updateTag,
  deleteTag,
  setUserCredentials,
} from "../services/googleSheets";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";
import { getGoogleTokenFromRequest } from "../utils/googleTokenHelper";

/**
 * Get all tags
 */
export const getAllTags = asyncHandler(async (req: Request, res: Response) => {
  const googleToken = getGoogleTokenFromRequest(req);
  const tags = await getTags(googleToken);
  return sendSuccess(res, tags);
});

/**
 * Add a tag
 */
export const addTagHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const googleToken = getGoogleTokenFromRequest(req);

    if (!googleToken) {
      return sendError(res, "Google access token is required", 401);
    }

    setUserCredentials(googleToken);
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return sendValidationError(res, "Tag name is required");
    }

    const result = await addTag({ name: name.trim() }, googleToken);

    if (result.success) {
      return sendSuccess(res, null, "Tag added successfully");
    } else {
      return sendError(res, result.error || "Failed to add tag", 500);
    }
  },
);

/**
 * Update a tag
 */
export const updateTagHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const googleToken = getGoogleTokenFromRequest(req);

    if (!googleToken) {
      return sendError(res, "Google access token is required", 401);
    }

    setUserCredentials(googleToken);
    const { rowIndex } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return sendValidationError(res, "Tag name is required");
    }

    const success = await updateTag(
      parseInt(rowIndex),
      {
        name: name.trim(),
      },
      googleToken,
    );

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
    const googleToken = getGoogleTokenFromRequest(req);

    if (!googleToken) {
      return sendError(res, "Google access token is required", 401);
    }

    setUserCredentials(googleToken);
    const { rowIndex } = req.params;

    const success = await deleteTag(parseInt(rowIndex), googleToken);

    if (success) {
      return sendSuccess(res, null, "Tag deleted successfully");
    } else {
      return sendError(res, "Failed to delete tag", 500);
    }
  },
);
