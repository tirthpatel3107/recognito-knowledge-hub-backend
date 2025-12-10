/**
 * Technologies Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as technologiesController from "../controllers/technologiesController";
import { writeLimiter } from "../middleware/rateLimiter";
import {
  validateTechnology,
  validateSheetId,
} from "../middleware/inputValidation";

const router = express.Router();

// Get all technologies (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get("/", authenticateToken, technologiesController.getAllTechnologies);

// Create technology (requires Google auth)
router.post(
  "/",
  writeLimiter,
  authenticateToken,
  authenticateGoogleToken,
  validateTechnology,
  technologiesController.createTechnologyHandler,
);

// Update technology (requires Google auth)
router.put(
  "/:sheetId",
  writeLimiter,
  authenticateToken,
  authenticateGoogleToken,
  validateSheetId,
  validateTechnology,
  technologiesController.updateTechnologyHandler,
);

// Delete technology (requires Google auth)
router.delete(
  "/:sheetId",
  writeLimiter,
  authenticateToken,
  authenticateGoogleToken,
  validateSheetId,
  technologiesController.deleteTechnologyHandler,
);

// Reorder technologies (requires Google auth)
router.post(
  "/reorder",
  writeLimiter,
  authenticateToken,
  authenticateGoogleToken,
  technologiesController.reorderTechnologiesHandler,
);

export default router;
