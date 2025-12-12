/**
 * MongoDB Notes Service
 */
import { Note } from "../../models/Note.js";
import { NotesTab } from "../../models/NotesTab.js";

export interface NotesTabResult {
  id: string;
  name: string;
  sheetId?: number;
  pinned?: boolean;
}

export interface NoteResult {
  id: string;
  columnIndex: number;
  columnLetter: string;
  heading: string;
  content: string;
  imageUrls?: string[];
  rowIndex: number;
  tabId?: string;
  title?: string;
  description?: string;
  description2?: string;
  description3?: string;
  starred?: boolean;
}

/**
 * Get all tabs for a specific user
 */
export const getTabs = async (
  userId: string,
): Promise<NotesTabResult[]> => {
  // Return tabs from this user only
  const tabs = await NotesTab.find({ 
    userId,
    deletedAt: null,
  }).sort({
    pinned: -1,
    order: 1,
  });

  return tabs.map((tab, index) => ({
    id: tab._id.toString(),
    name: tab.name,
    sheetId: index, // For backward compatibility
    pinned: tab.pinned,
  }));
};

/**
 * Get all notes from "All Notes" for a specific user
 */
export const getAllNotes = async (
  userId: string,
): Promise<NoteResult[]> => {
  // Return notes from this user only
  const notes = await Note.find({ 
    userId,
    deletedAt: null,
  }).sort({
    createdAt: 1,
  });

  return notes.map((note, index) => ({
    id: note._id.toString(),
    tabId: note.tabId,
    title: note.title || "",
    description: note.description || "",
    description2: note.description2 || "",
    description3: note.description3 || "",
    starred: note.starred || false,
    columnIndex: note.columnIndex ?? 0,
    columnLetter: note.columnLetter || "A",
    heading: note.heading || note.title || "",
    content: note.content || note.description || "",
    imageUrls: note.imageUrls,
    rowIndex: note.rowIndex ?? index,
  }));
};

/**
 * Get notes for a specific tab for a specific user
 */
export const getNotesByTab = async (
  tabName: string,
  userId: string,
): Promise<NoteResult[]> => {
  // Find tab from this user only
  const tab = await NotesTab.findOne({
    userId,
    name: tabName,
    deletedAt: null,
  });

  if (!tab) {
    return [];
  }

  // Return notes from this user for this tab only
  const notes = await Note.find({
    userId,
    tabId: tab._id.toString(),
    deletedAt: null,
  }).sort({ createdAt: 1 });

  return notes.map((note, index) => ({
    id: note._id.toString(),
    tabId: note.tabId,
    title: note.title || "",
    description: note.description || "",
    description2: note.description2 || "",
    description3: note.description3 || "",
    starred: note.starred || false,
    columnIndex: note.columnIndex ?? 0,
    columnLetter: note.columnLetter || "A",
    heading: note.heading || note.title || "",
    content: note.content || note.description || "",
    imageUrls: note.imageUrls,
    rowIndex: note.rowIndex ?? index,
  }));
};

/**
 * Get headings for a specific tab (not applicable in MongoDB, return empty)
 * Note: Works with user-specific tabs
 */
export const getTabHeadings = async (
  tabName: string,
  userId: string,
): Promise<string[]> => {
  // In MongoDB, we don't have column-based structure
  // Return empty array for backward compatibility
  return [];
};

/**
 * Get notes organized by column for a specific tab for a specific user
 */
export const getNotesByColumn = async (
  tabName: string,
  userId: string,
): Promise<Record<string, NoteResult[]>> => {
  const notes = await getNotesByTab(tabName, userId);
  const notesByColumn: Record<string, NoteResult[]> = {};

  notes.forEach((note) => {
    const columnLetter = note.columnLetter || "A";
    if (!notesByColumn[columnLetter]) {
      notesByColumn[columnLetter] = [];
    }
    notesByColumn[columnLetter].push(note);
  });

  return notesByColumn;
};

/**
 * Add a note to "All Notes"
 */
export const addNoteToAllNotes = async (
  noteData: {
    tabId: string;
    title: string;
    description?: string;
    description2?: string;
    description3?: string;
    starred?: boolean;
  },
  userId: string,
): Promise<boolean> => {
  try {
    await Note.create({
      userId,
      tabId: noteData.tabId,
      title: noteData.title,
      description: noteData.description || "",
      description2: noteData.description2 || "",
      description3: noteData.description3 || "",
      starred: noteData.starred || false,
    });
    return true;
  } catch (error) {
    console.error("Error adding note:", error);
    return false;
  }
};

/**
 * Delete a note from "All Notes"
 */
export const deleteNoteFromAllNotes = async (
  noteId: string,
  userId: string,
): Promise<boolean> => {
  try {
    await Note.findOneAndUpdate(
      { _id: noteId, userId, deletedAt: null },
      { deletedAt: new Date() },
    );
    return true;
  } catch (error) {
    console.error("Error deleting note:", error);
    return false;
  }
};

/**
 * Update a note in "All Notes"
 */
export const updateNoteInAllNotes = async (
  noteId: string,
  noteData: {
    title: string;
    description: string;
    description2?: string;
    description3?: string;
    starred?: boolean;
  },
  userId: string,
): Promise<boolean> => {
  try {
    await Note.findOneAndUpdate(
      { _id: noteId, userId, deletedAt: null },
      noteData,
    );
    return true;
  } catch (error) {
    console.error("Error updating note:", error);
    return false;
  }
};

/**
 * Update note tag (ID in column A) in "All Notes"
 */
export const updateNoteTag = async (
  noteId: string,
  newTabId: string,
  userId: string,
): Promise<boolean> => {
  try {
    await Note.findOneAndUpdate(
      { _id: noteId, userId, deletedAt: null },
      { tabId: newTabId },
    );
    return true;
  } catch (error) {
    console.error("Error updating note tag:", error);
    return false;
  }
};

/**
 * Create a new tab
 */
export const createTab = async (
  name: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if tab with same name already exists
    const existingTab = await NotesTab.findOne({
      userId,
      name: name.trim(),
      deletedAt: null,
    });
    
    if (existingTab) {
      return {
        success: false,
        error: `A tab with the name "${name}" already exists. Please enter another name.`,
      };
    }
    
    // Get the max order value to add new tab at the end
    const maxOrderTab = await NotesTab.findOne({ 
      userId,
      deletedAt: null,
    })
      .sort({ order: -1 })
      .limit(1);
    
    const newOrder = maxOrderTab ? maxOrderTab.order + 1 : 0;
    
    await NotesTab.create({
      userId,
      name: name.trim(),
      pinned: false,
      order: newOrder,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("Error creating tab:", error);
    
    // Handle duplicate key error (unique constraint)
    if (error.code === 11000) {
      return {
        success: false,
        error: `A tab with the name "${name}" already exists. Please enter another name.`,
      };
    }
    
    return {
      success: false,
      error: error.message || "Failed to create tab",
    };
  }
};

/**
 * Update a tab (rename)
 */
export const updateTab = async (
  tabId: string,
  newName: string,
  userId: string,
): Promise<boolean> => {
  try {
    // Check if another tab with the same name exists
    const existingTab = await NotesTab.findOne({
      userId,
      name: newName.trim(),
      _id: { $ne: tabId },
      deletedAt: null,
    });
    
    if (existingTab) {
      return false;
    }
    
    await NotesTab.findOneAndUpdate(
      { _id: tabId, userId, deletedAt: null },
      { name: newName.trim() },
    );
    
    return true;
  } catch (error) {
    console.error("Error updating tab:", error);
    return false;
  }
};

/**
 * Delete a tab
 */
export const deleteTab = async (
  tabId: string,
  userId: string,
): Promise<boolean> => {
  try {
    const deletedAt = new Date();
    
    // Soft delete all notes associated with this tab
    await Note.updateMany(
      {
        userId,
        tabId: tabId,
        deletedAt: null,
      },
      { deletedAt },
    );
    
    // Soft delete the tab itself
    await NotesTab.findOneAndUpdate(
      {
        _id: tabId,
        userId,
        deletedAt: null,
      },
      { deletedAt },
    );
    
    return true;
  } catch (error) {
    console.error("Error deleting tab:", error);
    return false;
  }
};

/**
 * Reorder tabs
 */
export const reorderTabs = async (
  tabIds: string[],
  userId: string,
): Promise<boolean> => {
  try {
    // Update order for each tab
    const updatePromises = tabIds.map((tabId, index) => {
      return NotesTab.findOneAndUpdate(
        { _id: tabId, userId, deletedAt: null },
        { order: index },
      );
    });
    
    await Promise.all(updatePromises);
    
    return true;
  } catch (error) {
    console.error("Error reordering tabs:", error);
    return false;
  }
};

/**
 * Toggle tab pin status
 * Ensures only one tab is pinned at a time
 */
export const toggleTabPin = async (
  tabId: string,
  userId: string,
): Promise<boolean> => {
  try {
    const tab = await NotesTab.findOne({
      _id: tabId,
      userId,
      deletedAt: null,
    });
    
    if (!tab) {
      return false;
    }
    
    const newPinStatus = !tab.pinned;
    
    // If pinning this tab, unpin all other tabs first
    if (newPinStatus) {
      await NotesTab.updateMany(
        { userId, _id: { $ne: tabId }, deletedAt: null },
        { pinned: false },
      );
    }
    
    // Update the current tab's pin status
    await NotesTab.findOneAndUpdate(
      { _id: tabId, userId, deletedAt: null },
      { pinned: newPinStatus },
    );
    
    return true;
  } catch (error) {
    console.error("Error toggling tab pin:", error);
    return false;
  }
};

