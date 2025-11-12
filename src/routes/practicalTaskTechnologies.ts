/**
 * Practical Task Technologies Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as practicalTaskTechnologiesController from "../controllers/practicalTaskTechnologiesController";

const router = express.Router();

// Get all practical task technologies (read-only, no auth needed, but supports OAuth if available)
router.get(
  "/",
  practicalTaskTechnologiesController.getAllPracticalTaskTechnologies,
);

// Create practical task technology (requires Google auth)
router.post(
  "/",
  authenticateToken,
  authenticateGoogleToken,
  practicalTaskTechnologiesController.createPracticalTaskTechnologyHandler,
);

// Update practical task technology (requires Google auth)
router.put(
  "/:sheetId",
  authenticateToken,
  authenticateGoogleToken,
  practicalTaskTechnologiesController.updatePracticalTaskTechnologyHandler,
);

// Delete practical task technology (requires Google auth)
router.delete(
  "/:sheetId",
  authenticateToken,
  authenticateGoogleToken,
  practicalTaskTechnologiesController.deletePracticalTaskTechnologyHandler,
);

// Reorder practical task technologies (requires Google auth)
router.post(
  "/reorder",
  authenticateToken,
  authenticateGoogleToken,
  practicalTaskTechnologiesController.reorderPracticalTaskTechnologiesHandler,
);

export default router;
