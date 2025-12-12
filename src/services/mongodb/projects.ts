/**
 * MongoDB Projects Service
 */
import { Project } from "../../models/Project.js";

export interface ProjectResult {
  id: string;
  no: string;
  project: string;
  projectId: string;
}

/**
 * Get all projects for a specific user
 */
export const getProjects = async (userId: string): Promise<ProjectResult[]> => {
  const projects = await Project.find({ userId, deletedAt: null }).sort({ order: 1 });
  return projects.map((proj, index) => ({
    id: proj._id.toString(),
    no: (index + 1).toString(),
    project: proj.project,
    projectId: proj.projectId,
  }));
};

/**
 * Add a project for a specific user
 */
export const addProject = async (
  projectData: {
    project: string;
    projectId: string;
  },
  userId: string,
): Promise<boolean> => {
  try {
    // Check if projectId already exists for this user
    const existing = await Project.findOne({ 
      userId,
      projectId: projectData.projectId,
      deletedAt: null,
    });
    if (existing) {
      return false;
    }

    // Get max order for this user
    const maxOrder = await Project.findOne({ userId, deletedAt: null }).sort({ order: -1 });
    const newOrder = maxOrder ? maxOrder.order + 1 : 0;

    await Project.create({ ...projectData, userId, order: newOrder });
    return true;
  } catch (error) {
    console.error("Error adding project:", error);
    return false;
  }
};

/**
 * Update a project for a specific user
 */
export const updateProject = async (
  projectId: string,
  projectData: {
    project: string;
    projectId: string;
  },
  userId: string,
  oldProjectName?: string,
): Promise<boolean> => {
  try {
    const project = await Project.findOne({ 
      userId,
      projectId,
      deletedAt: null,
    });
    if (!project) {
      return false;
    }

    await Project.findOneAndUpdate(
      { userId, projectId, deletedAt: null },
      projectData,
    );

    // If project name changed, update WorkSummary entries for this user only
    if (oldProjectName && oldProjectName !== projectData.project) {
      const { updateProjectNameInWorkSummary } = await import("./workSummary.js");
      await updateProjectNameInWorkSummary(
        oldProjectName,
        projectData.project,
        userId,
      );
    }

    return true;
  } catch (error) {
    console.error("Error updating project:", error);
    return false;
  }
};

/**
 * Delete a project for a specific user
 */
export const deleteProject = async (projectId: string, userId: string): Promise<boolean> => {
  try {
    await Project.findOneAndUpdate(
      { userId, projectId, deletedAt: null },
      { deletedAt: new Date() },
    );
    return true;
  } catch (error) {
    console.error("Error deleting project:", error);
    return false;
  }
};

/**
 * Reorder projects for a specific user
 */
export const reorderProjects = async (
  projectIds: string[],
  userId: string,
): Promise<boolean> => {
  try {
    const updates = projectIds.map((id, index) =>
      Project.findOneAndUpdate(
        { _id: id, userId, deletedAt: null },
        { order: index },
      ),
    );
    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error("Error reordering projects:", error);
    return false;
  }
};

