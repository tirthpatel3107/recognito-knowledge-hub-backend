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
} from "../services/mongodb/projects";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";

/**
 * Get all projects for the authenticated user
 */
export const getAllProjects = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const projects = await getProjects(userId);
    return sendSuccess(res, projects);
  },
);

/**
 * Add a project
 */
export const addProjectHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { project, projectId } = req.body;

    if (!project || !projectId) {
      return sendValidationError(
        res,
        "Project name and project ID are required",
      );
    }

    const userId = req.user!.userId;
    const success = await addProject({ project, projectId }, userId);

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
    const { rowIndex } = req.params;
    const { project, projectId, oldProjectName } = req.body;

    if (!project || !projectId) {
      return sendValidationError(
        res,
        "Project name and project ID are required",
      );
    }

    // Get the project to find its current projectId
    const userId = req.user!.userId;
    const projects = await getProjects(userId);
    const projectToUpdate = projects[parseInt(rowIndex)];
    if (!projectToUpdate) {
      return sendError(res, "Project not found", 404);
    }

    const success = await updateProject(
      projectToUpdate.projectId,
      { project, projectId },
      userId,
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
    const { rowIndex } = req.params;

    if (!rowIndex || isNaN(parseInt(rowIndex))) {
      return sendValidationError(
        res,
        `Invalid rowIndex parameter: ${rowIndex}. Must be a number.`,
      );
    }

    // Get the project to find its projectId
    const userId = req.user!.userId;
    const projects = await getProjects(userId);
    const projectToDelete = projects[parseInt(rowIndex)];
    if (!projectToDelete) {
      return sendError(res, "Project not found", 404);
    }

    const success = await deleteProject(projectToDelete.projectId, userId);

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
    const { projectIds } = req.body;

    if (!Array.isArray(projectIds)) {
      return sendValidationError(res, "projectIds must be an array");
    }

    const userId = req.user!.userId;
    const success = await reorderProjects(projectIds, userId);

    if (success) {
      return sendSuccess(res, null, "Projects reordered successfully");
    } else {
      return sendError(res, "Failed to reorder projects", 500);
    }
  },
);
