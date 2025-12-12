/**
 * MongoDB Practical Task Technologies Service
 */
import { Technology } from "../../models/Technology.js";
import { TechnologyResult } from "./types.js";

export type { TechnologyResult };

/**
 * Get all practical task technologies
 */
export const getPracticalTaskTechnologies = async (): Promise<
  TechnologyResult[]
> => {
  const technologies = await Technology.find({ deletedAt: null }).sort({ order: 1 });
  return technologies.map((tech, index) => ({
    id: tech._id.toString(),
    name: tech.name,
    sheetId: index, // For backward compatibility
  }));
};

