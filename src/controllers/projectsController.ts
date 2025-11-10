/**
 * Projects Controller
 * Handles project-related operations
 */
import { Request, Response } from 'express';
import { google } from 'googleapis';
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  reorderProjects,
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

// Helper to get sheet ID for "Project List" sheet
const getProjectListSheetId = async (accessToken: string | null = null): Promise<number | undefined> => {
  const sheetsClient = buildSheetsClient(accessToken);

  const response = await sheetsClient.spreadsheets.get({
    spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
  });

  const sheetsList = response.data.sheets || [];
  const projectListSheet = sheetsList.find(
    (sheet) => sheet.properties?.title === 'Project List'
  );

  return projectListSheet?.properties?.sheetId ?? undefined;
};

/**
 * Get all projects
 */
export const getAllProjects = asyncHandler(async (req: Request, res: Response) => {
  const googleToken = getGoogleTokenFromRequest(req);
  const projects = await getProjects(googleToken);
  return sendSuccess(res, projects);
});

/**
 * Add a project
 */
export const addProjectHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { project, projectId } = req.body;

  if (!project || !projectId) {
    return sendValidationError(res, 'Project name and project ID are required');
  }

  const success = await addProject({ project, projectId });

  if (success) {
    return sendSuccess(res, null, 'Project added successfully');
  } else {
    return sendError(res, 'Failed to add project', 500);
  }
});

/**
 * Update a project
 */
export const updateProjectHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { rowIndex } = req.params;
  const { project, projectId } = req.body;

  if (!project || !projectId) {
    return sendValidationError(res, 'Project name and project ID are required');
  }

  const success = await updateProject(parseInt(rowIndex), {
    project,
    projectId,
  });

  if (success) {
    return sendSuccess(res, null, 'Project updated successfully');
  } else {
    return sendError(res, 'Failed to update project', 500);
  }
});

/**
 * Delete a project
 */
export const deleteProjectHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { rowIndex } = req.params;

  const sheetId = await getProjectListSheetId(req.googleToken!);

  if (!sheetId) {
    return sendNotFound(res, 'Project List sheet');
  }

  const success = await deleteProject(parseInt(rowIndex), sheetId);

  if (success) {
    return sendSuccess(res, null, 'Project deleted successfully');
  } else {
    return sendError(res, 'Failed to delete project', 500);
  }
});

/**
 * Reorder projects
 */
export const reorderProjectsHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const { oldIndex, newIndex } = req.body;

  if (
    oldIndex === undefined ||
    newIndex === undefined ||
    typeof oldIndex !== 'number' ||
    typeof newIndex !== 'number'
  ) {
    return sendValidationError(res, 'oldIndex and newIndex are required numbers');
  }

  const sheetId = await getProjectListSheetId(req.googleToken!);

  if (!sheetId) {
    return sendNotFound(res, 'Project List sheet');
  }

  const success = await reorderProjects(oldIndex, newIndex, sheetId);

  if (success) {
    return sendSuccess(res, null, 'Projects reordered successfully');
  } else {
    return sendError(res, 'Failed to reorder projects', 500);
  }
});

