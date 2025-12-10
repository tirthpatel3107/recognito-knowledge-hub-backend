/**
 * Work Summary Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as workSummaryController from "../controllers/workSummaryController";

const router = express.Router();

// Get all month sheets (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get("/months", authenticateToken, workSummaryController.getMonthSheets);

// Get work summary entries for a month (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get(
  "/entries/:monthSheet",
  authenticateToken,
  workSummaryController.getEntriesByMonth,
);

// Create new month sheet (requires Google auth)
router.post(
  "/months",
  authenticateToken,
  authenticateGoogleToken,
  workSummaryController.createMonthSheet,
);

// Add work summary entry (requires Google auth)
router.post(
  "/entries",
  authenticateToken,
  authenticateGoogleToken,
  workSummaryController.addWorkSummaryEntryHandler,
);

// Update work summary entry (requires Google auth)
router.put(
  "/entries/:monthSheet/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  workSummaryController.updateWorkSummaryEntryHandler,
);

// Delete work summary entry (requires Google auth)
router.delete(
  "/entries/:monthSheet/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  workSummaryController.deleteWorkSummaryEntryHandler,
);

export default router;
