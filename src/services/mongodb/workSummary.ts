/**
 * MongoDB Work Summary Service
 */
import { WorkSummary } from "../../models/WorkSummary.js";

export interface WorkSummaryEntryResult {
  id: string;
  no: string;
  projectName: string;
  workSummary: string;
  date: string;
}

/**
 * Get all month sheets for a specific user
 */
export const getMonthSheets = async (
  userId: string,
): Promise<string[]> => {
  // Return months from this user only
  const entries = await WorkSummary.find({ 
    userId,
    deletedAt: null,
  }).select(
    "monthSheet",
  );
  const months = new Set(entries.map((e) => e.monthSheet));
  return Array.from(months).sort().reverse();
};

/**
 * Get work summary entries by month for a specific user
 */
export const getWorkSummaryEntriesByMonth = async (
  monthSheet: string,
  userId: string,
): Promise<WorkSummaryEntryResult[]> => {
  // Return entries from this user only
  const entries = await WorkSummary.find({
    userId,
    monthSheet,
    deletedAt: null,
  }).sort({ date: 1, order: 1 });

  return entries.map((entry, index) => ({
    id: entry._id.toString(),
    no: (index + 1).toString(),
    projectName: entry.projectName,
    workSummary: entry.workSummary,
    date: entry.date.toISOString().split("T")[0],
  }));
};

/**
 * Add a work summary entry
 */
export const addWorkSummaryEntry = async (
  monthSheet: string,
  entryData: {
    projectName: string;
    workSummary: string;
    date: string;
  },
  userId: string,
): Promise<boolean> => {
  try {
    const entryDate = new Date(entryData.date);

    // Get max order for this month
    const maxOrder = await WorkSummary.findOne({
      userId,
      monthSheet,
      deletedAt: null,
    })
      .sort({ order: -1 })
      .select("order");
    const newOrder = maxOrder ? maxOrder.order + 1 : 0;

    await WorkSummary.create({
      userId,
      monthSheet,
      projectName: entryData.projectName,
      workSummary: entryData.workSummary,
      date: entryDate,
      order: newOrder,
    });
    return true;
  } catch (error) {
    console.error("Error adding work summary entry:", error);
    return false;
  }
};

/**
 * Update a work summary entry
 */
export const updateWorkSummaryEntry = async (
  monthSheet: string,
  entryId: string,
  entryData: {
    projectName: string;
    workSummary: string;
    date: string;
  },
  userId: string,
): Promise<boolean> => {
  try {
    await WorkSummary.findOneAndUpdate(
      { _id: entryId, userId, monthSheet, deletedAt: null },
      {
        projectName: entryData.projectName,
        workSummary: entryData.workSummary,
        date: new Date(entryData.date),
      },
    );
    return true;
  } catch (error) {
    console.error("Error updating work summary entry:", error);
    return false;
  }
};

/**
 * Delete a work summary entry
 */
export const deleteWorkSummaryEntry = async (
  monthSheet: string,
  entryId: string,
  userId: string,
): Promise<boolean> => {
  try {
    await WorkSummary.findOneAndUpdate(
      {
        _id: entryId,
        userId,
        monthSheet,
        deletedAt: null,
      },
      { deletedAt: new Date() },
    );
    return true;
  } catch (error) {
    console.error("Error deleting work summary entry:", error);
    return false;
  }
};

/**
 * Update project name in work summary entries for a specific user
 */
export const updateProjectNameInWorkSummary = async (
  oldProjectName: string,
  newProjectName: string,
  userId: string,
): Promise<boolean> => {
  try {
    // Update work summary entries for this user only (including soft-deleted ones for data integrity)
    await WorkSummary.updateMany(
      { userId, projectName: oldProjectName },
      { projectName: newProjectName },
    );
    return true;
  } catch (error) {
    console.error("Error updating project name in work summary:", error);
    return false;
  }
};

