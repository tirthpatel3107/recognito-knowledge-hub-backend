/**
 * Notes Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as notesController from "../controllers/notesController";

const router = express.Router();

// Get all tabs
router.get("/tabs", authenticateToken, notesController.getTabsHandler);

// Get all notes from "All Notes" sheet
router.get("/all", authenticateToken, notesController.getAllNotesHandler);

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

// Add a note to "All Notes" sheet
router.post(
  "/all",
  authenticateToken,
  notesController.addNote,
);

// Update a note in "All Notes" sheet
router.put(
  "/all/:rowIndex",
  authenticateToken,
  notesController.updateNote,
);

// Update note tag (ID in column A) in "All Notes" sheet
router.put(
  "/all/:rowIndex/tag",
  authenticateToken,
  notesController.updateNoteTagHandler,
);

// Delete a note from "All Notes" sheet
router.delete(
  "/all/:rowIndex",
  authenticateToken,
  notesController.deleteNote,
);

// Tab management routes
// Create a new tab
router.post("/tabs", authenticateToken, notesController.createTabHandler);

// Update a tab (rename)
router.put("/tabs/:tabId", authenticateToken, notesController.updateTabHandler);

// Delete a tab
router.delete("/tabs/:tabId", authenticateToken, notesController.deleteTabHandler);

// Reorder tabs
router.post("/tabs/reorder", authenticateToken, notesController.reorderTabsHandler);

// Toggle tab pin status
router.put("/tabs/:tabId/pin", authenticateToken, notesController.toggleTabPinHandler);

export default router;
