/**
 * Projects Routes
 */
import express from 'express';
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  reorderProjects,
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

// Helper to get sheet ID for "Project List" sheet
const getProjectListSheetId = async (accessToken = null) => {
  const sheetsClient = buildSheetsClient(accessToken);

  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
  });

  const sheetsList = response.data.sheets || [];
  const projectListSheet = sheetsList.find(
    (sheet) => sheet.properties.title === 'Project List'
  );

  return projectListSheet?.properties.sheetId;
};

// Get all projects (read-only, but supports OAuth if available)
router.get('/', async (req, res) => {
  try {
    // Try to get Google OAuth token for authenticated access to private sheets
    const googleToken = req.headers['x-google-token'] || (req.user?.email ? getGoogleToken(req.user.email) : null);
    const projects = await getProjects(googleToken);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Add project (requires Google auth)
router.post(
  '/',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { project, projectId } = req.body;

      if (!project || !projectId) {
        return res
          .status(400)
          .json({ error: 'Project name and project ID are required' });
      }

      const success = await addProject({ project, projectId });

      if (success) {
        res.json({ success: true, message: 'Project added successfully' });
      } else {
        res.status(500).json({ error: 'Failed to add project' });
      }
    } catch (error) {
      console.error('Error adding project:', error);
      res.status(500).json({ error: 'Failed to add project' });
    }
  }
);

// Update project (requires Google auth)
router.put(
  '/:rowIndex',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { rowIndex } = req.params;
      const { project, projectId } = req.body;

      if (!project || !projectId) {
        return res
          .status(400)
          .json({ error: 'Project name and project ID are required' });
      }

      const success = await updateProject(parseInt(rowIndex), {
        project,
        projectId,
      });

      if (success) {
        res.json({ success: true, message: 'Project updated successfully' });
      } else {
        res.status(500).json({ error: 'Failed to update project' });
      }
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  }
);

// Delete project (requires Google auth)
router.delete(
  '/:rowIndex',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { rowIndex } = req.params;

      const sheetId = await getProjectListSheetId(req.googleToken);

      if (!sheetId) {
        return res.status(404).json({ error: 'Project List sheet not found' });
      }

      const success = await deleteProject(parseInt(rowIndex), sheetId);

      if (success) {
        res.json({ success: true, message: 'Project deleted successfully' });
      } else {
        res.status(500).json({ error: 'Failed to delete project' });
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }
);

// Reorder projects (requires Google auth)
router.post(
  '/reorder',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { oldIndex, newIndex } = req.body;

      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        typeof oldIndex !== 'number' ||
        typeof newIndex !== 'number'
      ) {
        return res
          .status(400)
          .json({ error: 'oldIndex and newIndex are required numbers' });
      }

      const sheetId = await getProjectListSheetId(req.googleToken);

      if (!sheetId) {
        return res.status(404).json({ error: 'Project List sheet not found' });
      }

      const success = await reorderProjects(oldIndex, newIndex, sheetId);

      if (success) {
        res.json({ success: true, message: 'Projects reordered successfully' });
      } else {
        res.status(500).json({ error: 'Failed to reorder projects' });
      }
    } catch (error) {
      console.error('Error reordering projects:', error);
      res.status(500).json({ error: 'Failed to reorder projects' });
    }
  }
);

export default router;
