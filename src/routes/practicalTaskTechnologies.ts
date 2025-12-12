/**
 * Practical Task Technologies Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as practicalTaskTechnologiesController from "../controllers/practicalTaskTechnologiesController";

const router = express.Router();

// Get all practical task technologies (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get(
  "/",
  authenticateToken,
  practicalTaskTechnologiesController.getAllPracticalTaskTechnologies,
);

// Create practical task technology (requires Google auth)
router.post(
  "/",
  authenticateToken,
  practicalTaskTechnologiesController.createPracticalTaskTechnologyHandler,
);

// Update practical task technology (requires Google auth)
router.put(
  "/:sheetId",
  authenticateToken,
  practicalTaskTechnologiesController.updatePracticalTaskTechnologyHandler,
);

// Delete practical task technology (requires Google auth)
router.delete(
  "/:sheetId",
  authenticateToken,
  practicalTaskTechnologiesController.deletePracticalTaskTechnologyHandler,
);

// Reorder practical task technologies (requires Google auth)
router.post(
  "/reorder",
  authenticateToken,
  practicalTaskTechnologiesController.reorderPracticalTaskTechnologiesHandler,
);

export default router;
