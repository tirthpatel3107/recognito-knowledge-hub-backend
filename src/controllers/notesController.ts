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
  getTabs,
  getAllNotes,
  getNotesByTab,
  getNotesByColumn,
  getTabHeadings,
  addNoteToAllNotes,
  updateNoteInAllNotes,
  updateNoteTag,
  deleteNoteFromAllNotes,
  createTab,
  updateTab,
  deleteTab,
  reorderTabs,
  reorderNotes,
  toggleTabPin,
} from "../services/mongodb/notes";

/**
 * Get all tabs
 */
export const getTabsHandler = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const tabs = await getTabs(userId);
    return sendSuccess(res, tabs, "Tabs retrieved successfully");
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to retrieve tabs", 500);
  }
});

/**
 * Get all notes from "All Notes"
 */
export const getAllNotesHandler = asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notes = await getAllNotes(userId);
    return sendSuccess(res, notes, "Notes retrieved successfully");
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to retrieve notes", 500);
  }
});

/**
 * Get notes for a specific tab
 */
export const getNotes = asyncHandler(async (req: Request, res: Response) => {
  const { tabName } = req.params;

  if (!tabName) {
    return sendValidationError(res, "Tab name is required");
  }

  try {
    const userId = req.user!.userId;
    const notes = await getNotesByTab(tabName, userId);
    return sendSuccess(res, notes, "Notes retrieved successfully");
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to retrieve notes", 500);
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
      const userId = req.user!.userId;
      const notesByColumn = await getNotesByColumn(tabName, userId);
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
export const getHeadings = asyncHandler(async (req: Request, res: Response) => {
  const { tabName } = req.params;

  if (!tabName) {
    return sendValidationError(res, "Tab name is required");
  }

  try {
    const userId = req.user!.userId;
    const headings = await getTabHeadings(tabName, userId);
    return sendSuccess(res, headings, "Headings retrieved successfully");
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to retrieve headings", 500);
  }
});

/**
 * Add a note to "All Notes" sheet
 */
export const addNote = asyncHandler(async (req: Request, res: Response) => {
  const { tabId, title, description, description2, description3, starred } =
    req.body;

  if (!tabId || !title) {
    return sendValidationError(res, "Tab ID and title are required");
  }

  try {
    const userId = req.user!.userId;
    const success = await addNoteToAllNotes(
      {
        tabId,
        title,
        description,
        description2,
        description3,
        starred,
      },
      userId,
    );

    if (success) {
      return sendSuccess(res, null, "Note added successfully");
    } else {
      return sendError(res, "Failed to add note", 500);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to add note", 500);
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
    const userId = req.user!.userId;
    // Get notes to find the note ID
    const notes = await getAllNotes(userId);
    const noteToUpdate = notes[rowIndexNum];
    
    if (!noteToUpdate) {
      return sendError(res, "Note not found", 404);
    }

    const success = await updateNoteInAllNotes(
      noteToUpdate.id,
      {
        title,
        description,
        description2,
        description3,
        starred,
      },
      userId,
    );

    if (success) {
      return sendSuccess(res, null, "Note updated successfully");
    } else {
      return sendError(res, "Failed to update note", 500);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to update note", 500);
  }
});

/**
 * Update note tag (ID in column A) in "All Notes" sheet
 */
export const updateNoteTagHandler = asyncHandler(
  async (req: Request, res: Response) => {
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
      const userId = req.user!.userId;
      // Get notes to find the note ID
      const notes = await getAllNotes(userId);
      const noteToUpdate = notes[rowIndexNum];
      
      if (!noteToUpdate) {
        return sendError(res, "Note not found", 404);
      }

      const success = await updateNoteTag(
        noteToUpdate.id,
        newTabId.trim(),
        userId,
      );

      if (success) {
        return sendSuccess(res, null, "Note tag updated successfully");
      } else {
        return sendError(res, "Failed to update note tag", 500);
      }
    } catch (error: any) {
      return sendError(res, error?.message || "Failed to update note tag", 500);
    }
  },
);

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
    const userId = req.user!.userId;
    // Get notes to find the note ID
    const notes = await getAllNotes(userId);
    const noteToDelete = notes[rowIndexNum];
    
    if (!noteToDelete) {
      return sendError(res, "Note not found", 404);
    }

    const success = await deleteNoteFromAllNotes(noteToDelete.id, userId);

    if (success) {
      return sendSuccess(res, null, "Note deleted successfully");
    } else {
      return sendError(res, "Failed to delete note", 500);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to delete note", 500);
  }
});

/**
 * Create a new tab
 */
export const createTabHandler = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return sendValidationError(res, "Tab name is required");
  }

  try {
    const userId = req.user!.userId;
    const result = await createTab(name.trim(), userId);

    if (result.success) {
      return sendSuccess(res, null, "Tab created successfully");
    } else {
      return sendError(res, result.error || "Failed to create tab", 400);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to create tab", 500);
  }
});

/**
 * Update a tab (rename)
 */
export const updateTabHandler = asyncHandler(async (req: Request, res: Response) => {
  const { tabId } = req.params;
  const { newName } = req.body;

  if (!tabId) {
    return sendValidationError(res, "Tab ID is required");
  }

  if (!newName || typeof newName !== "string" || newName.trim() === "") {
    return sendValidationError(res, "New name is required");
  }

  try {
    const userId = req.user!.userId;
    const success = await updateTab(tabId, newName.trim(), userId);

    if (success) {
      return sendSuccess(res, null, "Tab updated successfully");
    } else {
      return sendError(res, "Failed to update tab (may already exist)", 400);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to update tab", 500);
  }
});

/**
 * Delete a tab
 */
export const deleteTabHandler = asyncHandler(async (req: Request, res: Response) => {
  const { tabId } = req.params;

  if (!tabId) {
    return sendValidationError(res, "Tab ID is required");
  }

  try {
    const userId = req.user!.userId;
    const success = await deleteTab(tabId, userId);

    if (success) {
      return sendSuccess(res, null, "Tab deleted successfully");
    } else {
      return sendError(res, "Failed to delete tab", 500);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to delete tab", 500);
  }
});

/**
 * Reorder tabs
 */
export const reorderTabsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { tabIds } = req.body;

  if (!Array.isArray(tabIds)) {
    return sendValidationError(res, "tabIds must be an array");
  }

  try {
    const userId = req.user!.userId;
    const success = await reorderTabs(tabIds, userId);

    if (success) {
      return sendSuccess(res, null, "Tabs reordered successfully");
    } else {
      return sendError(res, "Failed to reorder tabs", 500);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to reorder tabs", 500);
  }
});

/**
 * Reorder notes
 */
export const reorderNotesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { noteIds, viewType } = req.body;

  if (!Array.isArray(noteIds)) {
    return sendValidationError(res, "noteIds must be an array");
  }

  // Validate viewType if provided
  const validViewType = viewType === "all" || viewType === "starred" ? viewType : "tab";

  try {
    const userId = req.user!.userId;
    const success = await reorderNotes(noteIds, userId, validViewType);

    if (success) {
      return sendSuccess(res, null, "Notes reordered successfully");
    } else {
      return sendError(res, "Failed to reorder notes", 500);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to reorder notes", 500);
  }
});

/**
 * Toggle tab pin status
 */
export const toggleTabPinHandler = asyncHandler(async (req: Request, res: Response) => {
  const { tabId } = req.params;

  if (!tabId) {
    return sendValidationError(res, "Tab ID is required");
  }

  try {
    const userId = req.user!.userId;
    const success = await toggleTabPin(tabId, userId);

    if (success) {
      return sendSuccess(res, null, "Tab pin status toggled successfully");
    } else {
      return sendError(res, "Failed to toggle tab pin status", 500);
    }
  } catch (error: any) {
    return sendError(res, error?.message || "Failed to toggle tab pin status", 500);
  }
});
