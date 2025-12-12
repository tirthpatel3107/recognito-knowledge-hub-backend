/**
 * MongoDB Kanban Service
 */
import { KanbanTask } from "../../models/KanbanTask.js";

export interface KanbanTaskResult {
  id: string;
  title: string;
  description: string;
  createdDate: string;
  columnId: "todo" | "in-progress" | "done" | "close";
  tags?: string[];
  priority?: "low" | "medium" | "high";
}

/**
 * Get all kanban tasks grouped by column for a specific user
 */
export const getKanbanTasks = async (
  userId: string,
): Promise<Record<string, KanbanTaskResult[]>> => {
  // Return tasks from this user only
  const tasks = await KanbanTask.find({ 
    userId,
    deletedAt: null,
  }).sort({
    order: 1,
  });

  const tasksByColumn: Record<string, KanbanTaskResult[]> = {
    todo: [],
    "in-progress": [],
    done: [],
    close: [],
  };

  tasks.forEach((task) => {
    const taskResult: KanbanTaskResult = {
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      createdDate: task.createdDate.toISOString(),
      columnId: task.columnId,
      tags: task.tags,
      priority: task.priority,
    };

    if (tasksByColumn[task.columnId]) {
      tasksByColumn[task.columnId].push(taskResult);
    }
  });

  return tasksByColumn;
};

/**
 * Save all kanban tasks
 */
export const saveKanbanTasks = async (
  tasks: KanbanTaskResult[],
  userId: string,
): Promise<boolean> => {
  try {
    const deletedAt = new Date();

    // Soft delete all existing tasks for this user
    await KanbanTask.updateMany(
      { userId, deletedAt: null },
      { deletedAt },
    );

    // Create new tasks
    const tasksToCreate = tasks.map((task, index) => ({
      userId,
      title: task.title,
      description: task.description,
      createdDate: new Date(task.createdDate),
      columnId: task.columnId,
      tags: task.tags || [],
      priority: task.priority || "low",
      order: index,
    }));

    await KanbanTask.insertMany(tasksToCreate);
    return true;
  } catch (error) {
    console.error("Error saving kanban tasks:", error);
    return false;
  }
};

