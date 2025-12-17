/**
 * MongoDB Practical Tasks Service
 */
import { PracticalTask } from "../../models/PracticalTask.js";
import { PaginatedResponse } from "./types.js";

export interface PracticalTaskResult {
  id: string;
  no: string;
  question: string;
  answer: string;
  example?: string;
  priority?: "low" | "medium" | "high";
}

export type { PaginatedResponse };

/**
 * Get practical tasks for a technology
 */
export const getPracticalTasks = async (
  technologyName: string,
  page?: number,
  limit?: number,
): Promise<PracticalTaskResult[] | PaginatedResponse<PracticalTaskResult>> => {
  const query = { technologyName, deletedAt: null };

  if (page !== undefined && limit !== undefined) {
    const skip = (page - 1) * limit;
    const [tasks, total] = await Promise.all([
      PracticalTask.find(query).sort({ order: 1 }).skip(skip).limit(limit),
      PracticalTask.countDocuments(query),
    ]);

    return {
      data: tasks.map((t, index) => ({
        id: t._id.toString(),
        no: (skip + index + 1).toString(),
        question: t.question,
        answer: t.answer,
        example: t.example,
        priority: t.priority,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  const tasks = await PracticalTask.find(query).sort({ order: 1 });
  return tasks.map((t, index) => ({
    id: t._id.toString(),
    no: (index + 1).toString(),
    question: t.question,
    answer: t.answer,
    example: t.example,
    priority: t.priority,
  }));
};

/**
 * Add a practical task
 */
export const addPracticalTask = async (
  technologyName: string,
  taskData: {
    question: string;
    answer: string;
    example?: string;
    priority?: "low" | "medium" | "high";
  },
): Promise<boolean> => {
  try {
    // Get max order for this technology
    const maxOrder = await PracticalTask.findOne({ 
      technologyName,
      deletedAt: null,
    })
      .sort({ order: -1 })
      .select("order");
    const newOrder = maxOrder ? maxOrder.order + 1 : 0;

    // Get total count of tasks for this technology to calculate the 'no' field
    const taskCount = await PracticalTask.countDocuments({ 
      technologyName,
      deletedAt: null,
    });
    const newNo = (taskCount + 1).toString();

    await PracticalTask.create({
      technologyName,
      ...taskData,
      no: newNo,
      order: newOrder,
    });
    return true;
  } catch (error) {
    console.error("Error adding practical task:", error);
    return false;
  }
};

/**
 * Update a practical task
 */
export const updatePracticalTask = async (
  technologyName: string,
  taskId: string,
  taskData: {
    question: string;
    answer: string;
    example?: string;
    priority?: "low" | "medium" | "high";
  },
): Promise<boolean> => {
  try {
    await PracticalTask.findOneAndUpdate(
      { _id: taskId, technologyName, deletedAt: null },
      taskData,
    );
    return true;
  } catch (error) {
    console.error("Error updating practical task:", error);
    return false;
  }
};

/**
 * Delete a practical task
 */
export const deletePracticalTask = async (
  technologyName: string,
  taskId: string,
): Promise<boolean> => {
  try {
    await PracticalTask.findOneAndUpdate(
      { _id: taskId, technologyName, deletedAt: null },
      { deletedAt: new Date() },
    );
    return true;
  } catch (error) {
    console.error("Error deleting practical task:", error);
    return false;
  }
};

/**
 * Reorder practical tasks by oldIndex/newIndex
 */
export const reorderPracticalTasks = async (
  technologyName: string,
  oldIndex: number,
  newIndex: number,
): Promise<boolean> => {
  try {
    // Get all tasks for this technology, sorted by current order
    const tasks = await PracticalTask.find({
      technologyName,
      deletedAt: null,
    }).sort({ order: 1 });

    if (tasks.length === 0) {
      return true; // Nothing to reorder
    }

    // Validate indices
    if (
      oldIndex < 0 ||
      oldIndex >= tasks.length ||
      newIndex < 0 ||
      newIndex >= tasks.length
    ) {
      throw new Error(
        `Invalid indices: oldIndex=${oldIndex}, newIndex=${newIndex}, totalTasks=${tasks.length}`,
      );
    }

    // Reorder the array
    const [movedTask] = tasks.splice(oldIndex, 1);
    tasks.splice(newIndex, 0, movedTask);

    // Update order for all tasks
    const updates = tasks.map((task, index) =>
      PracticalTask.findOneAndUpdate(
        { _id: task._id, technologyName, deletedAt: null },
        { order: index },
      ),
    );

    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error("Error reordering practical tasks:", error);
    return false;
  }
};

/**
 * Reorder practical tasks by array of IDs (backward compatibility)
 */
export const reorderPracticalTasksByIds = async (
  technologyName: string,
  taskIds: string[],
): Promise<boolean> => {
  try {
    const updates = taskIds.map((id, index) =>
      PracticalTask.findOneAndUpdate(
        { _id: id, technologyName, deletedAt: null },
        { order: index },
      ),
    );
    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error("Error reordering practical tasks by IDs:", error);
    return false;
  }
};

