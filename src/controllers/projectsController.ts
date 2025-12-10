/**
 * Projects Controller
 * Handles project-related operations
 */
import { Request, Response } from "express";
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  reorderProjects,
  setUserCredentials,
  getSheetsClient,
  findSheetByName,
} from "../services/googleSheets";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} from "../utils/responseHelper";
import { getGoogleTokenFromRequest } from "../utils/googleTokenHelper";

// Helper to get sheet ID for "Project List" sheet
// Note: Project List sheet (tab) is inside the WORK_SUMMARY spreadsheet, not PROJECT_LISTING
// This uses the findSheetByName utility for consistent sheet matching logic
const getProjectListSheetId = async (
  email: string | null,
  accessToken: string | null = null,
): Promise<{ sheetId?: number; availableSheets?: string[] }> => {
  try {
    const { getUserWorkSummarySpreadsheetId } = await import("../services/googleSheets/userProfile");
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    
    const result = await findSheetByName(
      spreadsheetId,
      "Project List",
      accessToken,
    );

    // Check if sheetId exists (using !== undefined to handle 0 as valid sheetId)
    if (result.sheetId === undefined || result.sheetId === null) {
      return { availableSheets: result.availableSheets };
    }

    return { sheetId: result.sheetId, availableSheets: result.availableSheets };
  } catch {
    // Error getting Project List sheet ID
    return { availableSheets: [] };
  }
};

/**
 * Get all projects
 */
export const getAllProjects = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const projects = await getProjects(email, googleToken);
    return sendSuccess(res, projects);
  },
);

/**
 * Add a project
 */
export const addProjectHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { project, projectId } = req.body;
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);

    if (!project || !projectId) {
      return sendValidationError(
        res,
        "Project name and project ID are required",
      );
    }

    const success = await addProject({ project, projectId }, email, googleToken);

    if (success) {
      return sendSuccess(res, null, "Project added successfully");
    } else {
      return sendError(res, "Failed to add project", 500);
    }
  },
);

/**
 * Update a project
 */
export const updateProjectHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { rowIndex } = req.params;
    const { project, projectId, oldProjectName } = req.body;
    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);

    if (!project || !projectId) {
      return sendValidationError(
        res,
        "Project name and project ID are required",
      );
    }

    const success = await updateProject(
      parseInt(rowIndex),
      {
        project,
        projectId,
      },
      email,
      googleToken,
      oldProjectName,
    );

    if (success) {
      return sendSuccess(res, null, "Project updated successfully");
    } else {
      return sendError(res, "Failed to update project", 500);
    }
  },
);

/**
 * Delete a project
 */
export const deleteProjectHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { rowIndex } = req.params;

    if (!rowIndex || isNaN(parseInt(rowIndex))) {
      return sendValidationError(res, `Invalid rowIndex parameter: ${rowIndex}. Must be a number.`);
    }

    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    
    const result = await getProjectListSheetId(email, googleToken);

    // Check if sheetId exists (using !== undefined to handle 0 as valid sheetId)
    if (result.sheetId === undefined || result.sheetId === null) {
      const availableSheets = result.availableSheets?.join(", ") || "none";
      return sendNotFound(
        res,
        `Project List sheet (tab) not found in Work Summary spreadsheet. Available sheets (tabs): ${availableSheets}. Please ensure the tab is named exactly "Project List".`,
      );
    }

    const parsedRowIndex = parseInt(rowIndex);
    
    const success = await deleteProject(parsedRowIndex, result.sheetId, email, googleToken);

    if (success) {
      return sendSuccess(res, null, "Project deleted successfully");
    } else {
      return sendError(res, "Failed to delete project", 500);
    }
  },
);

/**
 * Reorder projects
 */
export const reorderProjectsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const { oldIndex, newIndex } = req.body;

    if (
      oldIndex === undefined ||
      newIndex === undefined ||
      typeof oldIndex !== "number" ||
      typeof newIndex !== "number"
    ) {
      return sendValidationError(
        res,
        "oldIndex and newIndex are required numbers",
      );
    }

    const email = req.user?.email || null;
    const googleToken = getGoogleTokenFromRequest(req);
    const result = await getProjectListSheetId(email, googleToken);

    // Check if sheetId exists (using !== undefined to handle 0 as valid sheetId)
    if (result.sheetId === undefined || result.sheetId === null) {
      const availableSheets = result.availableSheets?.join(", ") || "none";
      return sendNotFound(
        res,
        `Project List sheet (tab) not found in Work Summary spreadsheet. Available sheets (tabs): ${availableSheets}. Please ensure the tab is named exactly "Project List".`,
      );
    }

    const success = await reorderProjects(oldIndex, newIndex, result.sheetId, email, googleToken);

    if (success) {
      return sendSuccess(res, null, "Projects reordered successfully");
    } else {
      return sendError(res, "Failed to reorder projects", 500);
    }
  },
);
