/**
 * Work Summary Controller
 * Handles work summary-related operations
 */
import { Request, Response } from 'express';
import { google } from 'googleapis';
import {
  getWorkSummaryMonthSheets,
  getWorkSummaryEntriesByMonth,
  createWorkSummaryMonthSheet,
  addWorkSummaryEntry,
  updateWorkSummaryEntry,
  deleteWorkSummaryEntry,
  getMonthNameFromDate,
  setUserCredentials,
} from '../services/googleSheetsService';
import { GOOGLE_CONFIG, SPREADSHEET_IDS } from '../config/googleConfig';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError, sendValidationError, sendNotFound } from '../utils/responseHelper';
import { getGoogleTokenFromRequest } from '../utils/googleTokenHelper';

const buildSheetsClient = (accessToken: string | null = null) => {
  if (accessToken) {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CONFIG.CLIENT_ID,
      GOOGLE_CONFIG.CLIENT_SECRET,
      GOOGLE_CONFIG.REDIRECT_URI
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.sheets({ version: 'v4', auth: oauth2Client });
  }

  if (!GOOGLE_CONFIG.API_KEY) {
    throw new Error('Google API key is not configured for read-only access');
  }

  return google.sheets({ version: 'v4', auth: GOOGLE_CONFIG.API_KEY });
};

// Helper to get sheet ID by name
const getSheetIdByName = async (
  sheetName: string,
  accessToken: string | null = null
): Promise<number | undefined> => {
  const sheetsClient = buildSheetsClient(accessToken);

  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
  });

  const sheetsList = response.data.sheets || [];
  const targetSheet = sheetsList.find(
    (sheet) => sheet.properties?.title === sheetName
  );

  return targetSheet?.properties?.sheetId ?? undefined;
};

/**
 * Get all month sheets
 */
export const getMonthSheets = asyncHandler(async (req: Request, res: Response) => {
  const googleToken = getGoogleTokenFromRequest(req);
  const monthSheets = await getWorkSummaryMonthSheets(googleToken);
  return sendSuccess(res, monthSheets);
});

/**
 * Get work summary entries for a month
 */
export const getEntriesByMonth = asyncHandler(async (req: Request, res: Response) => {
  const { monthSheet } = req.params;
  const googleToken = getGoogleTokenFromRequest(req);
  const entries = await getWorkSummaryEntriesByMonth(monthSheet, googleToken);
  return sendSuccess(res, entries);
});

/**
 * Create a new month sheet
 */
export const createMonthSheet = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { monthName } = req.body;

  if (!monthName) {
    return sendValidationError(res, 'Month name is required');
  }

  const success = await createWorkSummaryMonthSheet(monthName);

  if (success) {
    return sendSuccess(res, null, 'Month sheet created successfully');
  } else {
    return sendError(res, 'Failed to create month sheet', 500);
  }
});

/**
 * Add a work summary entry
 */
export const addWorkSummaryEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { monthSheet, projectName, workSummary, date } = req.body;

  if (!projectName || !workSummary || !date) {
    return sendValidationError(res, 'Project name, work summary, and date are required');
  }

  const targetMonthSheet = monthSheet || getMonthNameFromDate(date);

  if (!targetMonthSheet) {
    return sendValidationError(res, 'Invalid date format');
  }

  const existingSheets = await getWorkSummaryMonthSheets(req.googleToken!);
  if (!existingSheets.includes(targetMonthSheet)) {
    await createWorkSummaryMonthSheet(targetMonthSheet);
  }

  const success = await addWorkSummaryEntry(targetMonthSheet, {
    projectName,
    workSummary,
    date,
  });

  if (success) {
    return sendSuccess(res, null, 'Work summary entry added successfully');
  } else {
    return sendError(res, 'Failed to add work summary entry', 500);
  }
});

/**
 * Update a work summary entry
 */
export const updateWorkSummaryEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { monthSheet, rowIndex } = req.params;
  const { projectName, workSummary, date, oldDate } = req.body;

  if (!projectName || !workSummary || !date) {
    return sendValidationError(res, 'Project name, work summary, and date are required');
  }

  const newMonth = getMonthNameFromDate(date);
  const oldMonth = oldDate ? getMonthNameFromDate(oldDate) : monthSheet;

  if (oldDate && oldMonth !== newMonth && newMonth) {
    const sheetId = await getSheetIdByName(monthSheet, req.googleToken!);
    if (sheetId) {
      await deleteWorkSummaryEntry(monthSheet, parseInt(rowIndex), sheetId);
    }

    const existingSheets = await getWorkSummaryMonthSheets(req.googleToken!);
    if (!existingSheets.includes(newMonth)) {
      await createWorkSummaryMonthSheet(newMonth);
    }

    const success = await addWorkSummaryEntry(newMonth, {
      projectName,
      workSummary,
      date,
    });

    if (success) {
      return sendSuccess(res, null, 'Work summary entry updated successfully');
    } else {
      return sendError(res, 'Failed to update work summary entry', 500);
    }
  } else {
    const success = await updateWorkSummaryEntry(
      monthSheet,
      parseInt(rowIndex),
      { projectName, workSummary, date }
    );

    if (success) {
      return sendSuccess(res, null, 'Work summary entry updated successfully');
    } else {
      return sendError(res, 'Failed to update work summary entry', 500);
    }
  }
});

/**
 * Delete a work summary entry
 */
export const deleteWorkSummaryEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { monthSheet, rowIndex } = req.params;

  const sheetId = await getSheetIdByName(monthSheet, req.googleToken!);

  if (!sheetId) {
    return sendNotFound(res, 'Month sheet');
  }

  const success = await deleteWorkSummaryEntry(
    monthSheet,
    parseInt(rowIndex),
    sheetId
  );

  if (success) {
    return sendSuccess(res, null, 'Work summary entry deleted successfully');
  } else {
    return sendError(res, 'Failed to delete work summary entry', 500);
  }
});

