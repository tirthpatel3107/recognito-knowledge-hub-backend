/**
 * Work Summary Controller
 * Handles work summary-related operations
 */
import { Request, Response } from "express";
import {
  getMonthSheets as getMonthSheetsService,
  getWorkSummaryEntriesByMonth,
  addWorkSummaryEntry,
  updateWorkSummaryEntry,
  deleteWorkSummaryEntry,
} from "../services/mongodb/workSummary";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";

/**
 * Helper to get month name from date (YYYY-MM-DD format)
 */
const getMonthNameFromDate = (date: string): string => {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

/**
 * Get all month sheets
 */
export const getMonthSheetsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const monthSheets = await getMonthSheetsService(userId);
    return sendSuccess(res, monthSheets);
  },
);

/**
 * Get work summary entries for a month
 */
export const getEntriesByMonth = asyncHandler(
  async (req: Request, res: Response) => {
    const { monthSheet } = req.params;
    const userId = req.user!.userId;
    const entries = await getWorkSummaryEntriesByMonth(monthSheet, userId);
    return sendSuccess(res, entries);
  },
);

/**
 * Create a new month sheet (no-op in MongoDB, months are created automatically)
 */
export const createMonthSheet = asyncHandler(
  async (req: Request, res: Response) => {
    // In MongoDB, months are created automatically when entries are added
    return sendSuccess(res, null, "Month sheet will be created automatically");
  },
);

/**
 * Add a work summary entry
 */
export const addWorkSummaryEntryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { monthSheet, projectName, workSummary, date } = req.body;

    if (!projectName || !workSummary || !date) {
      return sendValidationError(
        res,
        "Project name, work summary, and date are required",
      );
    }

    const userId = req.user!.userId;
    const targetMonthSheet = monthSheet || getMonthNameFromDate(date);

    if (!targetMonthSheet) {
      return sendValidationError(res, "Invalid date format");
    }

    const success = await addWorkSummaryEntry(
      targetMonthSheet,
      {
        projectName,
        workSummary,
        date,
      },
      userId,
    );

    if (success) {
      return sendSuccess(res, null, "Work summary entry added successfully");
    } else {
      return sendError(res, "Failed to add work summary entry", 500);
    }
  },
);

/**
 * Update a work summary entry
 */
export const updateWorkSummaryEntryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { monthSheet, rowIndex } = req.params;
    const { projectName, workSummary, date, oldDate } = req.body;

    if (!projectName || !workSummary || !date) {
      return sendValidationError(
        res,
        "Project name, work summary, and date are required",
      );
    }

    const userId = req.user!.userId;
    const newMonth = getMonthNameFromDate(date);
    const oldMonth = oldDate ? getMonthNameFromDate(oldDate) : monthSheet;

    // Get entries to find the entry ID
    const entries = await getWorkSummaryEntriesByMonth(monthSheet, userId);
    const entryToUpdate = entries[parseInt(rowIndex)];
    
    if (!entryToUpdate) {
      return sendError(res, "Work summary entry not found", 404);
    }

    // If month changed, delete old entry and create new one
    if (oldDate && oldMonth !== newMonth && newMonth) {
      await deleteWorkSummaryEntry(monthSheet, entryToUpdate.id, userId);
      const success = await addWorkSummaryEntry(
        newMonth,
        { projectName, workSummary, date },
        userId,
      );

      if (success) {
        return sendSuccess(
          res,
          null,
          "Work summary entry updated successfully",
        );
      } else {
        return sendError(res, "Failed to update work summary entry", 500);
      }
    } else {
      const success = await updateWorkSummaryEntry(
        monthSheet,
        entryToUpdate.id,
        { projectName, workSummary, date },
        userId,
      );

      if (success) {
        return sendSuccess(
          res,
          null,
          "Work summary entry updated successfully",
        );
      } else {
        return sendError(res, "Failed to update work summary entry", 500);
      }
    }
  },
);

/**
 * Delete a work summary entry
 */
export const deleteWorkSummaryEntryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { monthSheet, rowIndex } = req.params;
    const userId = req.user!.userId;

    // Get entries to find the entry ID
    const entries = await getWorkSummaryEntriesByMonth(monthSheet, userId);
    const entryToDelete = entries[parseInt(rowIndex)];

    if (!entryToDelete) {
      return sendError(res, "Work summary entry not found", 404);
    }

    const success = await deleteWorkSummaryEntry(
      monthSheet,
      entryToDelete.id,
      userId,
    );

    if (success) {
      return sendSuccess(res, null, "Work summary entry deleted successfully");
    } else {
      return sendError(res, "Failed to delete work summary entry", 500);
    }
  },
);
