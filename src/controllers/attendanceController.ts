/**
 * Attendance Controller
 * Handles attendance-related operations
 */
import { Request, Response } from "express";
import {
  getAttendanceByDay,
  saveAttendanceByDay,
  getAttendanceByMonth,
  getUserAttendanceSummaries,
  calculateTotalHours,
  formatHours,
  IAttendanceEntry,
} from "../services/mongodb/attendance";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";
import mongoose from "mongoose";

/**
 * Get attendance for a specific day
 */
export const getDayAttendanceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { targetUserId, year, month, date } = req.query;

    if (!targetUserId || !year || !month || !date) {
      return sendValidationError(res, "targetUserId, year, month, and date are required");
    }

    const userId = req.user!.userId;
    const entries = await getAttendanceByDay(
      userId,
      targetUserId as string,
      parseInt(year as string),
      parseInt(month as string),
      parseInt(date as string),
    );

    // Calculate total hours
    const totalHours = calculateTotalHours(entries);
    const formattedHours = formatHours(totalHours);

    return sendSuccess(res, {
      entries,
      totalHours,
      formattedHours,
    });
  },
);

/**
 * Save attendance for a specific day
 */
export const saveDayAttendanceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { targetUserId, year, month, date, entries } = req.body;

    if (!targetUserId || !year || !month || !date) {
      return sendValidationError(res, "targetUserId, year, month, and date are required");
    }

    if (!Array.isArray(entries)) {
      return sendValidationError(res, "entries must be an array");
    }

    // Validate entries
    for (const entry of entries) {
      if (!entry.name || typeof entry.name !== "string") {
        return sendValidationError(res, "Each entry must have a name");
      }
    }

    const userId = req.user!.userId;
    
    // Validate targetUserId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return sendValidationError(res, "Invalid targetUserId");
    }

    const success = await saveAttendanceByDay(
      userId,
      targetUserId,
      parseInt(year),
      parseInt(month),
      parseInt(date),
      entries as IAttendanceEntry[],
    );

    if (success) {
      return sendSuccess(res, null, "Attendance saved successfully");
    } else {
      return sendError(res, "Failed to save attendance", 500);
    }
  },
);

/**
 * Get attendance for an entire month
 */
export const getMonthAttendanceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { targetUserId, year, month } = req.query;

    if (!targetUserId || !year || !month) {
      return sendValidationError(res, "targetUserId, year, and month are required");
    }

    const userId = req.user!.userId;
    
    // Validate targetUserId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(targetUserId as string)) {
      return sendValidationError(res, "Invalid targetUserId");
    }

    const monthData = await getAttendanceByMonth(
      userId,
      targetUserId as string,
      parseInt(year as string),
      parseInt(month as string),
    );

    return sendSuccess(res, monthData);
  },
);

/**
 * Get user attendance summaries (for "All Users" page)
 */
export const getUserSummariesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { year, month, search } = req.query;

    const userId = req.user!.userId;
    
    const yearNum = year ? parseInt(year as string) : undefined;
    const monthNum = month ? parseInt(month as string) : undefined;
    const searchQuery = search ? (search as string) : undefined;

    const summaries = await getUserAttendanceSummaries(
      userId,
      yearNum,
      monthNum,
      searchQuery,
    );

    return sendSuccess(res, summaries);
  },
);

