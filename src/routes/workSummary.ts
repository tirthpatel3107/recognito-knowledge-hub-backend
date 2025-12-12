/**
 * Work Summary Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as workSummaryController from "../controllers/workSummaryController";

const router = express.Router();

// Get all month sheets
router.get("/months", authenticateToken, workSummaryController.getMonthSheetsHandler);

// Get work summary entries for a month
router.get(
  "/entries/:monthSheet",
  authenticateToken,
  workSummaryController.getEntriesByMonth,
);

// Create new month sheet (no-op in MongoDB, months created automatically)
router.post(
  "/months",
  authenticateToken,
  workSummaryController.createMonthSheet,
);

// Add work summary entry
router.post(
  "/entries",
  authenticateToken,
  workSummaryController.addWorkSummaryEntryHandler,
);

// Update work summary entry
router.put(
  "/entries/:monthSheet/:rowIndex",
  authenticateToken,
  workSummaryController.updateWorkSummaryEntryHandler,
);

// Delete work summary entry
router.delete(
  "/entries/:monthSheet/:rowIndex",
  authenticateToken,
  workSummaryController.deleteWorkSummaryEntryHandler,
);

export default router;
