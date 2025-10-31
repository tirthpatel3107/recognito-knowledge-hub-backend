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
import { SPREADSHEET_IDS } from '../config/googleConfig.js';
import { google } from 'googleapis';

const router = express.Router();

// Helper to get sheet ID for "Project List" sheet
const getProjectListSheetId = async () => {
  const sheets = google.sheets({
    version: 'v4',
    auth: process.env.GOOGLE_API_KEY,
  });

  const response = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
  });

  const sheetsList = response.data.sheets || [];
  const projectListSheet = sheetsList.find(
    (sheet) => sheet.properties.title === 'Project List'
  );

  return projectListSheet?.properties.sheetId;
};

// Get all projects (read-only)
router.get('/', async (req, res) => {
  try {
    const projects = await getProjects();
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

      const sheetId = await getProjectListSheetId();

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

      const sheetId = await getProjectListSheetId();

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
