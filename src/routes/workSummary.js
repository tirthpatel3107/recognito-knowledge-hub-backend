/**
 * Work Summary Routes
 */
import express from 'express';
import {
  getWorkSummaryMonthSheets,
  getWorkSummaryEntriesByMonth,
  createWorkSummaryMonthSheet,
  addWorkSummaryEntry,
  updateWorkSummaryEntry,
  deleteWorkSummaryEntry,
  getMonthNameFromDate,
  setUserCredentials,
} from '../services/googleSheetsService.js';
import { authenticateToken, authenticateGoogleToken } from '../middleware/auth.js';
import { GOOGLE_CONFIG, SPREADSHEET_IDS } from '../config/googleConfig.js';
import { google } from 'googleapis';

const router = express.Router();

const buildSheetsClient = (accessToken = null) => {
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
const getSheetIdByName = async (sheetName, accessToken = null) => {
  const sheetsClient = buildSheetsClient(accessToken);

  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
  });

  const sheetsList = response.data.sheets || [];
  const targetSheet = sheetsList.find(
    (sheet) => sheet.properties.title === sheetName
  );

  return targetSheet?.properties.sheetId;
};

// Get all month sheets (read-only, but supports OAuth if available)
router.get('/months', async (req, res) => {
  try {
    // Try to get Google OAuth token for authenticated access to private sheets
    const googleToken = req.headers['x-google-token'] || (req.user?.email ? getGoogleToken(req.user.email) : null);
    const monthSheets = await getWorkSummaryMonthSheets(googleToken);
    res.json(monthSheets);
  } catch (error) {
    console.error('Error fetching month sheets:', error);
    res.status(500).json({ error: 'Failed to fetch month sheets' });
  }
});

// Get work summary entries for a month (read-only, but supports OAuth if available)
router.get('/entries/:monthSheet', async (req, res) => {
  try {
    const { monthSheet } = req.params;
    // Try to get Google OAuth token for authenticated access to private sheets
    const googleToken = req.headers['x-google-token'] || (req.user?.email ? getGoogleToken(req.user.email) : null);
    const entries = await getWorkSummaryEntriesByMonth(monthSheet, googleToken);
    res.json(entries);
  } catch (error) {
    console.error('Error fetching work summary entries:', error);
    res.status(500).json({ error: 'Failed to fetch work summary entries' });
  }
});

// Create new month sheet (requires Google auth)
router.post(
  '/months',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { monthName } = req.body;

      if (!monthName) {
        return res.status(400).json({ error: 'Month name is required' });
      }

      const success = await createWorkSummaryMonthSheet(monthName);

      if (success) {
        res.json({ success: true, message: 'Month sheet created successfully' });
      } else {
        res.status(500).json({ error: 'Failed to create month sheet' });
      }
    } catch (error) {
      console.error('Error creating month sheet:', error);
      res.status(500).json({ error: 'Failed to create month sheet' });
    }
  }
);

// Add work summary entry (requires Google auth)
router.post(
  '/entries',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { monthSheet, projectName, workSummary, date } = req.body;

      if (!projectName || !workSummary || !date) {
        return res.status(400).json({
          error: 'Project name, work summary, and date are required',
        });
      }

      const targetMonthSheet = monthSheet || getMonthNameFromDate(date);

      if (!targetMonthSheet) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      const existingSheets = await getWorkSummaryMonthSheets(req.googleToken);
      if (!existingSheets.includes(targetMonthSheet)) {
        await createWorkSummaryMonthSheet(targetMonthSheet);
      }

      const success = await addWorkSummaryEntry(targetMonthSheet, {
        projectName,
        workSummary,
        date,
      });

      if (success) {
        res.json({
          success: true,
          message: 'Work summary entry added successfully',
        });
      } else {
        res.status(500).json({ error: 'Failed to add work summary entry' });
      }
    } catch (error) {
      console.error('Error adding work summary entry:', error);
      res.status(500).json({ error: 'Failed to add work summary entry' });
    }
  }
);

// Update work summary entry (requires Google auth)
router.put(
  '/entries/:monthSheet/:rowIndex',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { monthSheet, rowIndex } = req.params;
      const { projectName, workSummary, date, oldDate } = req.body;

      if (!projectName || !workSummary || !date) {
        return res.status(400).json({
          error: 'Project name, work summary, and date are required',
        });
      }

      const newMonth = getMonthNameFromDate(date);
      const oldMonth = oldDate ? getMonthNameFromDate(oldDate) : monthSheet;

      if (oldDate && oldMonth !== newMonth && newMonth) {
        const sheetId = await getSheetIdByName(monthSheet, req.googleToken);
        if (sheetId) {
          await deleteWorkSummaryEntry(monthSheet, parseInt(rowIndex), sheetId);
        }

        const existingSheets = await getWorkSummaryMonthSheets(req.googleToken);
        if (!existingSheets.includes(newMonth)) {
          await createWorkSummaryMonthSheet(newMonth);
        }

        const success = await addWorkSummaryEntry(newMonth, {
          projectName,
          workSummary,
          date,
        });

        if (success) {
          res.json({
            success: true,
            message: 'Work summary entry updated successfully',
          });
        } else {
          res.status(500).json({ error: 'Failed to update work summary entry' });
        }
      } else {
        const success = await updateWorkSummaryEntry(
          monthSheet,
          parseInt(rowIndex),
          { projectName, workSummary, date }
        );

        if (success) {
          res.json({
            success: true,
            message: 'Work summary entry updated successfully',
          });
        } else {
          res.status(500).json({ error: 'Failed to update work summary entry' });
        }
      }
    } catch (error) {
      console.error('Error updating work summary entry:', error);
      res.status(500).json({ error: 'Failed to update work summary entry' });
    }
  }
);

// Delete work summary entry (requires Google auth)
router.delete(
  '/entries/:monthSheet/:rowIndex',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { monthSheet, rowIndex } = req.params;

      const sheetId = await getSheetIdByName(monthSheet, req.googleToken);

      if (!sheetId) {
        return res.status(404).json({ error: 'Month sheet not found' });
      }

      const success = await deleteWorkSummaryEntry(
        monthSheet,
        parseInt(rowIndex),
        sheetId
      );

      if (success) {
        res.json({
          success: true,
          message: 'Work summary entry deleted successfully',
        });
      } else {
        res.status(500).json({ error: 'Failed to delete work summary entry' });
      }
    } catch (error) {
      console.error('Error deleting work summary entry:', error);
      res.status(500).json({ error: 'Failed to delete work summary entry' });
    }
  }
);

export default router;
