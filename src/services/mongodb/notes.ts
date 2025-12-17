/**
 * MongoDB Notes Service
 */
import mongoose from "mongoose";
import { Note } from "../../models/Note.js";
import { NotesTab } from "../../models/NotesTab.js";

export interface NotesTabResult {
  id: string;
  name: string;
  sheetId?: number;
  pinned?: boolean;
  order?: number;
}

export interface NoteResult {
  id: string;
  columnIndex: number;
  columnLetter: string;
  heading: string;
  content: string;
  rowIndex: number;
  tabId?: string;
  title?: string;
  description?: string;
  description2?: string;
  description3?: string;
  starred?: boolean;
  order?: number; // Sequence/order field for tracking note order within a tab
  allOrder?: number; // Sequence/order field for tracking note order in "All" view
  starredOrder?: number; // Sequence/order field for tracking note order in "Starred" view
}

/**
 * Get all tabs for a specific user
 * Also ensures all tabs have order values set (migration for existing tabs)
 */
export const getTabs = async (
  userId: string,
): Promise<NotesTabResult[]> => {
  // Return tabs from this user only
  let tabs = await NotesTab.find({ 
    userId,
    deletedAt: null,
  }).sort({
    pinned: -1,
    order: 1,
    createdAt: 1, // Secondary sort for stability when order values are the same
  });

  // Migration: Ensure all tabs have order values
  // Separate pinned and unpinned tabs
  const pinnedTabs = tabs.filter((tab) => tab.pinned);
  const unpinnedTabs = tabs.filter((tab) => !tab.pinned);
  
  // Check if any tabs are missing order values
  const needsMigration = tabs.some((tab) => tab.order === undefined || tab.order === null);
  
  if (needsMigration) {
    // Update order for pinned tabs (0, 1, 2...)
    const pinnedUpdates = pinnedTabs.map((tab, index) => {
      if (tab.order === undefined || tab.order === null) {
        return NotesTab.findByIdAndUpdate(tab._id, { order: index }, { new: true });
      }
      return Promise.resolve(tab);
    });
    
    // Update order for unpinned tabs (0, 1, 2...)
    const unpinnedUpdates = unpinnedTabs.map((tab, index) => {
      if (tab.order === undefined || tab.order === null) {
        return NotesTab.findByIdAndUpdate(tab._id, { order: index }, { new: true });
      }
      return Promise.resolve(tab);
    });
    
    await Promise.all([...pinnedUpdates, ...unpinnedUpdates]);
    
    // Reload tabs after migration
    tabs = await NotesTab.find({ 
      userId,
      deletedAt: null,
    }).sort({
      pinned: -1,
      order: 1,
      createdAt: 1,
    });
  }

  return tabs.map((tab, index) => ({
    id: tab._id.toString(),
    name: tab.name,
    sheetId: index, // For backward compatibility
    pinned: tab.pinned,
    order: tab.order ?? index, // Include order field for frontend sorting
  }));
};

/**
 * Get all notes from "All Notes" for a specific user
 * Sorted by: tab order (pinned first, then order), then note order within tab, then createdAt
 */
export const getAllNotes = async (
  userId: string,
): Promise<NoteResult[]> => {
  // Get all tabs with their order for sorting
  const tabs = await NotesTab.find({
    userId,
    deletedAt: null,
  }).sort({
    pinned: -1,
    order: 1,
    createdAt: 1,
  });

  // Create a map of tabId to tab order for efficient lookup
  const tabOrderMap = new Map<string, { order: number; pinned: boolean }>();
  tabs.forEach((tab, index) => {
    tabOrderMap.set(tab._id.toString(), {
      order: tab.order ?? index,
      pinned: tab.pinned ?? false,
    });
  });

  // Get all notes from this user
  const notes = await Note.find({
    userId,
    deletedAt: null,
  });

  // Sort notes: first by tab order (pinned tabs first), then by allOrder, then by createdAt
  const sortedNotes = notes.sort((a, b) => {
    const tabA = tabOrderMap.get(a.tabId);
    const tabB = tabOrderMap.get(b.tabId);

    // If tab info not found, put at end
    if (!tabA && !tabB) return a.createdAt.getTime() - b.createdAt.getTime();
    if (!tabA) return 1;
    if (!tabB) return -1;

    // First sort by pinned status (pinned tabs first)
    if (tabA.pinned !== tabB.pinned) {
      return tabA.pinned ? -1 : 1;
    }

    // Then sort by tab order
    if (tabA.order !== tabB.order) {
      return tabA.order - tabB.order;
    }

    // Then sort by allOrder (order in "All" view)
    const allOrderA = a.allOrder ?? 0;
    const allOrderB = b.allOrder ?? 0;
    if (allOrderA !== allOrderB) {
      return allOrderA - allOrderB;
    }

    // Finally sort by createdAt as fallback
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return sortedNotes.map((note, index) => ({
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
    rowIndex: note.rowIndex ?? index,
    order: note.order ?? 0,
    allOrder: note.allOrder ?? 0,
    starredOrder: note.starredOrder ?? 0,
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
  // Sort by: note order first, then createdAt as fallback
  const notes = await Note.find({
    userId,
    tabId: tab._id.toString(),
    deletedAt: null,
  }).sort({
    order: 1,
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
    rowIndex: note.rowIndex ?? index,
    order: note.order ?? 0,
    allOrder: note.allOrder ?? 0,
    starredOrder: note.starredOrder ?? 0,
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
    // If unstarring (starred is explicitly false), reset starredOrder to 0
    const updateData: any = { ...noteData };
    if (noteData.starred === false) {
      updateData.starredOrder = 0;
    }

    await Note.findOneAndUpdate(
      { _id: noteId, userId, deletedAt: null },
      updateData,
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
 * Assigns order values separately for pinned and unpinned tabs
 * since backend sorts by pinned first, then order
 */
export const reorderTabs = async (
  tabIds: string[],
  userId: string,
): Promise<boolean> => {
  try {
    // First, fetch all tabs to get their pinned status
    const allTabs = await NotesTab.find({
      _id: { $in: tabIds },
      userId,
      deletedAt: null,
    });

    // Create a map of tabId to tab for quick lookup
    const tabMap = new Map(
      allTabs.map((tab) => [tab._id.toString(), tab])
    );

    // Separate tabs into pinned and unpinned based on the order in tabIds
    const pinnedTabs: string[] = [];
    const unpinnedTabs: string[] = [];

    for (const tabId of tabIds) {
      const tab = tabMap.get(tabId);
      if (tab?.pinned) {
        pinnedTabs.push(tabId);
      } else {
        unpinnedTabs.push(tabId);
      }
    }

    // Update order for pinned tabs (0, 1, 2...)
    const pinnedPromises = pinnedTabs.map((tabId, index) => {
      return NotesTab.updateOne(
        { _id: tabId, userId, deletedAt: null },
        { $set: { order: index } },
        { runValidators: true },
      );
    });

    // Update order for unpinned tabs (0, 1, 2...)
    const unpinnedPromises = unpinnedTabs.map((tabId, index) => {
      return NotesTab.updateOne(
        { _id: tabId, userId, deletedAt: null },
        { $set: { order: index } },
        { runValidators: true },
      );
    });

    await Promise.all([...pinnedPromises, ...unpinnedPromises]);
    
    return true;
  } catch (error) {
    console.error("Error reordering tabs:", error);
    return false;
  }
};

/**
 * Reorder notes
 * Updates the appropriate order field based on viewType:
 * - "tab": Updates order field (per-tab ordering)
 * - "all": Updates allOrder field (global ordering in "All" view)
 * - "starred": Updates starredOrder field (ordering in "Starred" view)
 */
export const reorderNotes = async (
  noteIds: string[],
  userId: string,
  viewType: "tab" | "all" | "starred" = "tab",
): Promise<boolean> => {
  try {
    if (!noteIds || noteIds.length === 0) {
      console.error("reorderNotes: noteIds array is empty or invalid");
      return false;
    }

    // Convert userId to ObjectId for proper querying
    const userIdObjectId = new mongoose.Types.ObjectId(userId);

    // Determine which order field to update based on viewType
    // Each view type has its own order field that should be updated independently
    let orderField: "order" | "allOrder" | "starredOrder" = "order";
    if (viewType === "all") {
      orderField = "allOrder";
    } else if (viewType === "starred") {
      orderField = "starredOrder";
    }

    console.log(`reorderNotes: Updating ${orderField} for ${noteIds.length} notes, viewType: ${viewType}, userId: ${userId}`);

    // Validate noteIds are valid ObjectIds
    const validNoteIds = noteIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validNoteIds.length !== noteIds.length) {
      console.error(`reorderNotes: Some noteIds are invalid. Valid: ${validNoteIds.length}/${noteIds.length}`);
      return false;
    }

    // Use bulkWrite for atomic updates
    const bulkOps = noteIds.map((noteId, index) => {
      return {
        updateOne: {
          filter: {
            _id: new mongoose.Types.ObjectId(noteId),
            userId: userIdObjectId,
            deletedAt: null as any,
          },
          update: {
            $set: { [orderField]: index },
          },
        },
      } as any;
    });

    const result = await Note.bulkWrite(bulkOps, { ordered: false });

    const totalMatched = result.matchedCount;
    const totalModified = result.modifiedCount;

    console.log(`reorderNotes (${viewType}): Matched ${totalMatched}/${noteIds.length}, Modified ${totalModified}/${noteIds.length}`);

    if (totalMatched !== noteIds.length) {
      console.error(`reorderNotes (${viewType}): Some notes were not found. Expected ${noteIds.length}, matched ${totalMatched}`);
      return false;
    }

    if (totalModified !== noteIds.length) {
      console.warn(`reorderNotes (${viewType}): Some notes were not modified (may already have correct order). Expected ${noteIds.length}, modified ${totalModified}`);
      // Still return true if matched, as the order might already be correct
    }

    return true;
  } catch (error) {
    console.error("Error reordering notes:", error);
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

