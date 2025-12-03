/**
 * Notes Controller
 * Handles notes API requests
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";
import {
  getTabsFromSheet,
  getAllNotesFromSheet,
  getNotesByTab,
  getNotesByColumn,
  getTabHeadings,
  type NotesTab,
  type Note,
} from "../services/googleSheets/notes";

/**
 * Get all tabs from "Tabs" sheet
 */
export const getTabs = asyncHandler(async (req: Request, res: Response) => {
  try {
    const tabs = await getTabsFromSheet();
    return sendSuccess(res, tabs, "Tabs retrieved successfully");
  } catch (error: any) {
    return sendError(
      res,
      error?.message || "Failed to retrieve tabs",
      500,
    );
  }
});

/**
 * Get all notes from "All Notes" sheet
 */
export const getAllNotes = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const notes = await getAllNotesFromSheet();
      return sendSuccess(res, notes, "Notes retrieved successfully");
    } catch (error: any) {
      return sendError(
        res,
        error?.message || "Failed to retrieve notes",
        500,
      );
    }
  },
);

/**
 * Get notes for a specific tab
 */
export const getNotes = asyncHandler(async (req: Request, res: Response) => {
  const { tabName } = req.params;

  if (!tabName) {
    return sendValidationError(res, "Tab name is required");
  }

  try {
    const notes = await getNotesByTab(tabName);
    return sendSuccess(res, notes, "Notes retrieved successfully");
  } catch (error: any) {
    return sendError(
      res,
      error?.message || "Failed to retrieve notes",
      500,
    );
  }
});

/**
 * Get notes organized by column for a specific tab
 */
export const getNotesByColumnForTab = asyncHandler(
  async (req: Request, res: Response) => {
    const { tabName } = req.params;

    if (!tabName) {
      return sendValidationError(res, "Tab name is required");
    }

    try {
      const notesByColumn = await getNotesByColumn(tabName);
      return sendSuccess(
        res,
        notesByColumn,
        "Notes by column retrieved successfully",
      );
    } catch (error: any) {
      return sendError(
        res,
        error?.message || "Failed to retrieve notes by column",
        500,
      );
    }
  },
);

/**
 * Get headings for a specific tab
 */
export const getHeadings = asyncHandler(
  async (req: Request, res: Response) => {
    const { tabName } = req.params;

    if (!tabName) {
      return sendValidationError(res, "Tab name is required");
    }

    try {
      const headings = await getTabHeadings(tabName);
      return sendSuccess(
        res,
        headings,
        "Headings retrieved successfully",
      );
    } catch (error: any) {
      return sendError(
        res,
        error?.message || "Failed to retrieve headings",
        500,
      );
    }
  },
);

