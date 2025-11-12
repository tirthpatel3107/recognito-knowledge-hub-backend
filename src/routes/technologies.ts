/**
 * Technologies Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as technologiesController from "../controllers/technologiesController";

const router = express.Router();

// Get all technologies (read-only, no auth needed, but supports OAuth if available)
router.get("/", technologiesController.getAllTechnologies);

// Create technology (requires Google auth)
router.post(
  "/",
  authenticateToken,
  authenticateGoogleToken,
  technologiesController.createTechnologyHandler,
);

// Update technology (requires Google auth)
router.put(
  "/:sheetId",
  authenticateToken,
  authenticateGoogleToken,
  technologiesController.updateTechnologyHandler,
);

// Delete technology (requires Google auth)
router.delete(
  "/:sheetId",
  authenticateToken,
  authenticateGoogleToken,
  technologiesController.deleteTechnologyHandler,
);

// Reorder technologies (requires Google auth)
router.post(
  "/reorder",
  authenticateToken,
  authenticateGoogleToken,
  technologiesController.reorderTechnologiesHandler,
);

export default router;
