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
  addNoteToAllNotes,
  updateNoteInAllNotes,
  updateNoteTag,
  deleteNoteFromAllNotes,
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
 * Add a note to "All Notes" sheet
 */
export const addNote = asyncHandler(async (req: Request, res: Response) => {
  const { tabId, title, description, description2, description3, starred } = req.body;

  if (!tabId || !title) {
    return sendValidationError(res, "Tab ID and title are required");
  }

  try {
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const success = await addNoteToAllNotes(
      {
        tabId,
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
      return sendSuccess(res, null, "Note added successfully");
    } else {
      return sendError(res, "Failed to add note", 500);
    }
  } catch (error: any) {
    return sendError(
      res,
      error?.message || "Failed to add note",
      500,
    );
  }
});

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

/**
 * Update note tag (ID in column A) in "All Notes" sheet
 */
export const updateNoteTagHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rowIndex } = req.params;
  const { newTabId } = req.body;

  if (!rowIndex) {
    return sendValidationError(res, "Row index is required");
  }

  const rowIndexNum = parseInt(rowIndex, 10);
  if (isNaN(rowIndexNum)) {
    return sendValidationError(res, "Row index must be a valid number");
  }

  if (!newTabId || typeof newTabId !== "string" || newTabId.trim() === "") {
    return sendValidationError(res, "New tab ID is required");
  }

  try {
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const success = await updateNoteTag(
      rowIndexNum,
      newTabId.trim(),
      email,
      googleToken,
    );

    if (success) {
      return sendSuccess(res, null, "Note tag updated successfully");
    } else {
      return sendError(res, "Failed to update note tag", 500);
    }
  } catch (error: any) {
    return sendError(
      res,
      error?.message || "Failed to update note tag",
      500,
    );
  }
});

/**
 * Delete a note from "All Notes" sheet
 */
export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const { rowIndex } = req.params;

  if (!rowIndex) {
    return sendValidationError(res, "Row index is required");
  }

  const rowIndexNum = parseInt(rowIndex, 10);
  if (isNaN(rowIndexNum)) {
    return sendValidationError(res, "Row index must be a valid number");
  }

  try {
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const success = await deleteNoteFromAllNotes(
      rowIndexNum,
      email,
      googleToken,
    );

    if (success) {
      return sendSuccess(res, null, "Note deleted successfully");
    } else {
      return sendError(res, "Failed to delete note", 500);
    }
  } catch (error: any) {
    return sendError(
      res,
      error?.message || "Failed to delete note",
      500,
    );
  }
});

