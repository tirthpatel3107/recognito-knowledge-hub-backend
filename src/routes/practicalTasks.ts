/**
 * Practical Tasks Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as practicalTasksController from "../controllers/practicalTasksController";

const router = express.Router();

// Get all practical tasks (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get(
  "/",
  authenticateToken,
  practicalTasksController.getAllPracticalTasks,
);

// Get practical tasks for a technology (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get(
  "/:technologyName",
  authenticateToken,
  practicalTasksController.getPracticalTasksByTechnologyHandler,
);

// Add practical task (requires Google auth)
router.post(
  "/:technologyName",
  authenticateToken,
  practicalTasksController.addPracticalTaskHandler,
);

// Update practical task (requires Google auth)
router.put(
  "/:technologyName/:rowIndex",
  authenticateToken,
  practicalTasksController.updatePracticalTaskHandler,
);

// Delete practical task (requires Google auth)
router.delete(
  "/:technologyName/:rowIndex",
  authenticateToken,
  practicalTasksController.deletePracticalTaskHandler,
);

// Reorder practical tasks (requires Google auth)
router.post(
  "/:technologyName/reorder",
  authenticateToken,
  practicalTasksController.reorderPracticalTasksHandler,
);

export default router;
