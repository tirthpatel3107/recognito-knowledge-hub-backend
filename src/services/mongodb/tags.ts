/**
 * MongoDB Tags Service
 */
import { Tag } from "../../models/Tag.js";

export interface TagResult {
  id: string;
  no: string;
  name: string;
}

/**
 * Get all tags for a specific user
 */
export const getTags = async (userId: string): Promise<TagResult[]> => {
  const tags = await Tag.find({ userId, deletedAt: null }).sort({ order: 1 });
  return tags.map((tag, index) => ({
    id: tag._id.toString(),
    no: (index + 1).toString(),
    name: tag.name,
  }));
};

/**
 * Add a tag for a specific user
 */
export const addTag = async (name: string, userId: string): Promise<boolean> => {
  try {
    // Check if tag already exists for this user
    const existing = await Tag.findOne({ userId, name, deletedAt: null });
    if (existing) {
      return false;
    }

    // Get max order for this user
    const maxOrder = await Tag.findOne({ userId, deletedAt: null }).sort({ order: -1 });
    const newOrder = maxOrder ? maxOrder.order + 1 : 0;

    await Tag.create({ userId, name, order: newOrder });
    return true;
  } catch (error) {
    console.error("Error adding tag:", error);
    return false;
  }
};

/**
 * Update a tag for a specific user
 */
export const updateTag = async (id: string, name: string, userId: string): Promise<boolean> => {
  try {
    await Tag.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { name },
    );
    return true;
  } catch (error) {
    console.error("Error updating tag:", error);
    return false;
  }
};

/**
 * Delete a tag for a specific user
 */
export const deleteTag = async (id: string, userId: string): Promise<boolean> => {
  try {
    await Tag.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { deletedAt: new Date() },
    );
    return true;
  } catch (error) {
    console.error("Error deleting tag:", error);
    return false;
  }
};

