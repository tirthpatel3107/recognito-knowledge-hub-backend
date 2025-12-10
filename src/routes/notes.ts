/**
 * Notes Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as notesController from "../controllers/notesController";

const router = express.Router();

// Get all tabs
router.get("/tabs", authenticateToken, notesController.getTabs);

// Get all notes from "All Notes" sheet
router.get("/all", authenticateToken, notesController.getAllNotes);

// Get notes for a specific tab
router.get("/tab/:tabName", authenticateToken, notesController.getNotes);

// Get notes organized by column for a specific tab
router.get(
  "/tab/:tabName/columns",
  authenticateToken,
  notesController.getNotesByColumnForTab,
);

// Get headings for a specific tab
router.get(
  "/tab/:tabName/headings",
  authenticateToken,
  notesController.getHeadings,
);

// Update a note in "All Notes" sheet
router.put(
  "/all/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  notesController.updateNote,
);

export default router;

