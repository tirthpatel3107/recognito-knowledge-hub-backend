/**
 * Work Summary Controller
 * Handles work summary-related operations
 */
import { Request, Response } from "express";
import {
  getWorkSummaryMonthSheets,
  getWorkSummaryEntriesByMonth,
  createWorkSummaryMonthSheet,
  addWorkSummaryEntry,
  updateWorkSummaryEntry,
  deleteWorkSummaryEntry,
  getMonthNameFromDate,
  setUserCredentials,
  getSheetsClient,
} from "../services/googleSheets";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} from "../utils/responseHelper";
import { getGoogleTokenFromRequest } from "../utils/googleTokenHelper";
import { getUserWorkSummarySpreadsheetId } from "../services/googleSheets/userProfile";

// Helper to get sheet ID by name
const getSheetIdByName = async (
  sheetName: string,
  email: string | null,
  accessToken: string | null = null,
): Promise<number | undefined> => {
  const spreadsheetId = await getUserWorkSummarySpreadsheetId(
    email,
    accessToken,
  );
  const sheetsClient = getSheetsClient(accessToken);

  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId: spreadsheetId,
  });

  const sheetsList = response.data.sheets || [];
  const targetSheet = sheetsList.find(
    (sheet: any) => sheet.properties?.title === sheetName,
  );

  return targetSheet?.properties?.sheetId ?? undefined;
};

/**
 * Get all month sheets
 */
export const getMonthSheets = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const monthSheets = await getWorkSummaryMonthSheets(email, googleToken);
    return sendSuccess(res, monthSheets);
  },
);

/**
 * Get work summary entries for a month
 */
export const getEntriesByMonth = asyncHandler(
  async (req: Request, res: Response) => {
    const { monthSheet } = req.params;
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const entries = await getWorkSummaryEntriesByMonth(
      monthSheet,
      email,
      googleToken,
    );
    return sendSuccess(res, entries);
  },
);

/**
 * Create a new month sheet
 */
export const createMonthSheet = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { monthName } = req.body;
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);

    if (!monthName) {
      return sendValidationError(res, "Month name is required");
    }

    const success = await createWorkSummaryMonthSheet(
      monthName,
      email,
      googleToken,
    );

    if (success) {
      return sendSuccess(res, null, "Month sheet created successfully");
    } else {
      return sendError(res, "Failed to create month sheet", 500);
    }
  },
);

/**
 * Add a work summary entry
 */
export const addWorkSummaryEntryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { monthSheet, projectName, workSummary, date } = req.body;

    if (!projectName || !workSummary || !date) {
      return sendValidationError(
        res,
        "Project name, work summary, and date are required",
      );
    }

    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const targetMonthSheet = monthSheet || getMonthNameFromDate(date);

    if (!targetMonthSheet) {
      return sendValidationError(res, "Invalid date format");
    }

    const existingSheets = await getWorkSummaryMonthSheets(email, googleToken);
    if (!existingSheets.includes(targetMonthSheet)) {
      await createWorkSummaryMonthSheet(targetMonthSheet, email, googleToken);
    }

    const success = await addWorkSummaryEntry(
      targetMonthSheet,
      {
        projectName,
        workSummary,
        date,
      },
      email,
      googleToken,
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
    setUserCredentials(req.googleToken!);
    const { monthSheet, rowIndex } = req.params;
    const { projectName, workSummary, date, oldDate } = req.body;

    if (!projectName || !workSummary || !date) {
      return sendValidationError(
        res,
        "Project name, work summary, and date are required",
      );
    }

    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const newMonth = getMonthNameFromDate(date);
    const oldMonth = oldDate ? getMonthNameFromDate(oldDate) : monthSheet;

    if (oldDate && oldMonth !== newMonth && newMonth) {
      const sheetId = await getSheetIdByName(monthSheet, email, googleToken);
      if (sheetId) {
        await deleteWorkSummaryEntry(
          monthSheet,
          parseInt(rowIndex),
          sheetId,
          email,
          googleToken,
        );
      }

      const existingSheets = await getWorkSummaryMonthSheets(
        email,
        googleToken,
      );
      if (!existingSheets.includes(newMonth)) {
        await createWorkSummaryMonthSheet(newMonth, email, googleToken);
      }

      const success = await addWorkSummaryEntry(
        newMonth,
        {
          projectName,
          workSummary,
          date,
        },
        email,
        googleToken,
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
      const email = req.user?.email || null;
      const googleToken = getGoogleTokenFromRequest(req);
      const success = await updateWorkSummaryEntry(
        monthSheet,
        parseInt(rowIndex),
        { projectName, workSummary, date },
        email,
        googleToken,
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
    setUserCredentials(req.googleToken!);
    const { monthSheet, rowIndex } = req.params;
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);

    const sheetId = await getSheetIdByName(monthSheet, email, googleToken);

    if (!sheetId) {
      return sendNotFound(res, "Month sheet");
    }

    const success = await deleteWorkSummaryEntry(
      monthSheet,
      parseInt(rowIndex),
      sheetId,
      email,
      googleToken,
    );

    if (success) {
      return sendSuccess(res, null, "Work summary entry deleted successfully");
    } else {
      return sendError(res, "Failed to delete work summary entry", 500);
    }
  },
);
