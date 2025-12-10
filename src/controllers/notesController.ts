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
  updateNoteInAllNotes,
  type NotesTab,
  type Note,
} from "../services/googleSheets/notes";
import { getGoogleTokenFromRequest } from "../utils/googleTokenHelper";

/**
 * Get all tabs from "Tabs" sheet
 */
export const getTabs = asyncHandler(async (req: Request, res: Response) => {
  try {
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const tabs = await getTabsFromSheet(email, googleToken);
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
      const email = req.user?.email || null;
      const googleToken = getGoogleTokenFromRequest(req);
      const notes = await getAllNotesFromSheet(email, googleToken);
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
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const notes = await getNotesByTab(tabName, email, googleToken);
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
      const email = req.user?.email || null;
      const googleToken = getGoogleTokenFromRequest(req);
      const notesByColumn = await getNotesByColumn(tabName, email, googleToken);
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
      const email = req.user?.email || null;
      const googleToken = getGoogleTokenFromRequest(req);
      const headings = await getTabHeadings(tabName, email, googleToken);
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

/**
 * Update a note in "All Notes" sheet
 */
export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const { rowIndex } = req.params;
  const { title, description, description2, description3, starred } = req.body;

  if (!rowIndex) {
    return sendValidationError(res, "Row index is required");
  }

  const rowIndexNum = parseInt(rowIndex, 10);
  if (isNaN(rowIndexNum)) {
    return sendValidationError(res, "Row index must be a valid number");
  }

  if (!title || !description) {
    return sendValidationError(res, "Title and description are required");
  }

  try {
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const success = await updateNoteInAllNotes(
      rowIndexNum,
      {
        title,
        description,
        description2,
        description3,
        starred,
      },
      email,
      googleToken,
    );

    if (success) {
      return sendSuccess(res, null, "Note updated successfully");
    } else {
      return sendError(res, "Failed to update note", 500);
    }
  } catch (error: any) {
    return sendError(
      res,
      error?.message || "Failed to update note",
      500,
    );
  }
});

