/**
 * Practical Tasks Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as practicalTasksController from "../controllers/practicalTasksController";

const router = express.Router();

// Get all practical tasks (read-only, but supports OAuth if available)
router.get("/", practicalTasksController.getAllPracticalTasks);

// Get practical tasks for a technology (read-only, but supports OAuth if available)
router.get(
  "/:technologyName",
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
