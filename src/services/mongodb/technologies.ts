/**
 * MongoDB Technologies Service
 */
import { Technology } from "../../models/Technology.js";
import { TechnologyResult } from "./types.js";

export type { TechnologyResult };

/**
 * Get all technologies
 */
export const getTechnologies = async (): Promise<TechnologyResult[]> => {
  const technologies = await Technology.find({ deletedAt: null }).sort({ order: 1 });
  return technologies.map((tech, index) => ({
    id: tech._id.toString(),
    name: tech.name,
    sheetId: index, // For backward compatibility
  }));
};

/**
 * Create a new technology
 */
export const createTechnology = async (
  name: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if technology already exists
    const existing = await Technology.findOne({ name, deletedAt: null });
    if (existing) {
      return { success: false, error: "Technology already exists" };
    }

    // Get max order
    const maxOrder = await Technology.findOne({ deletedAt: null }).sort({ order: -1 });
    const newOrder = maxOrder ? maxOrder.order + 1 : 0;

    await Technology.create({ name, order: newOrder });
    return { success: true };
  } catch (error) {
    console.error("Error creating technology:", error);
    return { success: false, error: "Failed to create technology" };
  }
};

/**
 * Update technology name
 */
export const updateTechnology = async (
  id: string,
  newName: string,
): Promise<boolean> => {
  try {
    await Technology.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { name: newName },
    );
    return true;
  } catch (error) {
    console.error("Error updating technology:", error);
    return false;
  }
};

/**
 * Delete technology
 */
export const deleteTechnology = async (
  id: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await Technology.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date() },
    );
    return { success: true };
  } catch (error) {
    console.error("Error deleting technology:", error);
    return { success: false, error: "Failed to delete technology" };
  }
};

/**
 * Reorder technologies
 */
export const reorderTechnologies = async (
  technologyIds: string[],
): Promise<boolean> => {
  try {
    const updates = technologyIds.map((id, index) =>
      Technology.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { order: index },
      ),
    );
    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error("Error reordering technologies:", error);
    return false;
  }
};

