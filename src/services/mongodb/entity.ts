/**
 * MongoDB Entity Service
 */
import { Entity } from "../../models/Entity.js";

export interface EntityResult {
  id: string;
  no: string;
  name: string;
}

/**
 * Get all entities for a specific user
 */
export const getEntities = async (userId: string): Promise<EntityResult[]> => {
  const entities = await Entity.find({ userId, deletedAt: null }).sort({ order: 1 });
  return entities.map((entity, index) => ({
    id: entity._id.toString(),
    no: (index + 1).toString(),
    name: entity.name,
  }));
};

/**
 * Add an entity for a specific user
 */
export const addEntity = async (name: string, userId: string): Promise<boolean> => {
  try {
    // Check if entity already exists for this user
    const existing = await Entity.findOne({ userId, name, deletedAt: null });
    if (existing) {
      return false;
    }

    // Get max order for this user
    const maxOrder = await Entity.findOne({ userId, deletedAt: null }).sort({ order: -1 });
    const newOrder = maxOrder ? maxOrder.order + 1 : 0;

    await Entity.create({ userId, name, order: newOrder });
    return true;
  } catch (error) {
    console.error("Error adding entity:", error);
    return false;
  }
};

/**
 * Update an entity for a specific user
 */
export const updateEntity = async (id: string, name: string, userId: string): Promise<boolean> => {
  try {
    await Entity.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { name },
    );
    return true;
  } catch (error) {
    console.error("Error updating entity:", error);
    return false;
  }
};

/**
 * Delete an entity for a specific user
 */
export const deleteEntity = async (id: string, userId: string): Promise<boolean> => {
  try {
    await Entity.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { deletedAt: new Date() },
    );
    return true;
  } catch (error) {
    console.error("Error deleting entity:", error);
    return false;
  }
};

