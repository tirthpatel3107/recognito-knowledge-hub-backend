/**
 * Code Editor Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as codeEditorController from "../controllers/codeEditorController";

const router = express.Router();

// List files in a directory
router.get(
  "/files",
  authenticateToken,
  codeEditorController.listFilesHandler,
);

// Read file content
router.get(
  "/file",
  authenticateToken,
  codeEditorController.readFileHandler,
);

// Write file content (requires Google auth for write operations)
router.post(
  "/file",
  authenticateToken,
  authenticateGoogleToken,
  codeEditorController.writeFileHandler,
);

// Get AI code suggestions
router.post(
  "/ai/suggestions",
  authenticateToken,
  codeEditorController.getAISuggestionsHandler,
);

// Get AI code completion
router.post(
  "/ai/completion",
  authenticateToken,
  codeEditorController.getAICompletionHandler,
);

export default router;

