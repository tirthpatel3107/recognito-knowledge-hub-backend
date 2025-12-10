/**
 * Practical Tasks Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as practicalTasksController from "../controllers/practicalTasksController";

const router = express.Router();

// Get all practical tasks (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get("/", authenticateToken, practicalTasksController.getAllPracticalTasks);

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
  authenticateGoogleToken,
  practicalTasksController.addPracticalTaskHandler,
);

// Update practical task (requires Google auth)
router.put(
  "/:technologyName/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  practicalTasksController.updatePracticalTaskHandler,
);

// Delete practical task (requires Google auth)
router.delete(
  "/:technologyName/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  practicalTasksController.deletePracticalTaskHandler,
);

// Reorder practical tasks (requires Google auth)
router.post(
  "/:technologyName/reorder",
  authenticateToken,
  authenticateGoogleToken,
  practicalTasksController.reorderPracticalTasksHandler,
);

export default router;
