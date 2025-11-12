/**
 * Projects Controller
 * Handles project-related operations
 */
import { Request, Response } from "express";
import { google } from "googleapis";
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  reorderProjects,
  setUserCredentials,
} from "../services/googleSheetsService";
import { GOOGLE_CONFIG, SPREADSHEET_IDS } from "../config/googleConfig";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} from "../utils/responseHelper";
import { getGoogleTokenFromRequest } from "../utils/googleTokenHelper";

const buildSheetsClient = (accessToken: string | null = null) => {
  if (accessToken) {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CONFIG.CLIENT_ID,
      GOOGLE_CONFIG.CLIENT_SECRET,
      GOOGLE_CONFIG.REDIRECT_URI,
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.sheets({ version: "v4", auth: oauth2Client });
  }

  if (!GOOGLE_CONFIG.API_KEY) {
    throw new Error("Google API key is not configured for read-only access");
  }

  return google.sheets({ version: "v4", auth: GOOGLE_CONFIG.API_KEY });
};

// Helper to get sheet ID for "Project List" sheet
// Note: Project List sheet (tab) is inside the WORK_SUMMARY spreadsheet, not PROJECT_LISTING
// This uses the same search logic as the service layer for consistency
const getProjectListSheetId = async (
  accessToken: string | null = null,
): Promise<{ sheetId?: number; availableSheets?: string[] }> => {
  try {
    const sheetsClient = buildSheetsClient(accessToken);

    if (!SPREADSHEET_IDS.WORK_SUMMARY) {
      // WORK_SUMMARY spreadsheet ID is not configured
      return { availableSheets: [] };
    }

    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });

    const sheetsList = response.data.sheets || [];
    const availableSheets = sheetsList
      .map((sheet: any) => sheet.properties?.title)
      .filter(Boolean);

    // Searching for Project List sheet

    // Try multiple search strategies
    let projectListSheet = null;

    // Strategy 1: Exact case-sensitive match
    projectListSheet = sheetsList.find(
      (sheet) => sheet.properties?.title === "Project List",
    );

    if (projectListSheet) {
      // Found Project List sheet using exact case-sensitive match
    } else {
      // Strategy 2: Case-insensitive match with normalized whitespace
      projectListSheet = sheetsList.find((sheet) => {
        const title = sheet.properties?.title || "";
        const normalized = title.replace(/\s+/g, " ").trim().toLowerCase();
        return normalized === "project list";
      });

      if (projectListSheet) {
        // Found Project List sheet using normalized case-insensitive match
      } else {
        // Strategy 3: Partial match (contains both words)
        projectListSheet = sheetsList.find((sheet) => {
          const title = (sheet.properties?.title || "").toLowerCase();
          return title.includes("project") && title.includes("list");
        });

        if (projectListSheet) {
          // Found Project List sheet using partial match
        }
      }
    }

    if (!projectListSheet) {
      // Project List sheet (tab) not found in WORK_SUMMARY spreadsheet
      return { availableSheets };
    }

    const sheetId = projectListSheet.properties?.sheetId;
    if (!sheetId) {
      // Project List sheet found but sheetId is missing
      return { availableSheets };
    }

    // Successfully found Project List sheet
    return { sheetId, availableSheets };
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
    const googleToken = getGoogleTokenFromRequest(req);
    const projects = await getProjects(googleToken);
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

    if (!project || !projectId) {
      return sendValidationError(
        res,
        "Project name and project ID are required",
      );
    }

    const success = await addProject({ project, projectId });

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
    const { project, projectId } = req.body;

    if (!project || !projectId) {
      return sendValidationError(
        res,
        "Project name and project ID are required",
      );
    }

    const success = await updateProject(parseInt(rowIndex), {
      project,
      projectId,
    });

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

    const result = await getProjectListSheetId(req.googleToken!);

    if (!result.sheetId) {
      const availableSheets = result.availableSheets?.join(", ") || "none";
      return sendNotFound(
        res,
        `Project List sheet (tab) not found in Work Summary spreadsheet. Available sheets (tabs): ${availableSheets}. Please ensure the tab is named exactly "Project List".`,
      );
    }

    const success = await deleteProject(parseInt(rowIndex), result.sheetId);

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

    const result = await getProjectListSheetId(req.googleToken!);

    if (!result.sheetId) {
      const availableSheets = result.availableSheets?.join(", ") || "none";
      return sendNotFound(
        res,
        `Project List sheet (tab) not found in Work Summary spreadsheet. Available sheets (tabs): ${availableSheets}. Please ensure the tab is named exactly "Project List".`,
      );
    }

    const success = await reorderProjects(oldIndex, newIndex, result.sheetId);

    if (success) {
      return sendSuccess(res, null, "Projects reordered successfully");
    } else {
      return sendError(res, "Failed to reorder projects", 500);
    }
  },
);
