/**
 * Tags Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as tagsController from "../controllers/tagsController";

const router = express.Router();

// Get all tags (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get("/", authenticateToken, tagsController.getAllTags);

// Add tag (requires Google auth)
router.post(
  "/",
  authenticateToken,
  authenticateGoogleToken,
  tagsController.addTagHandler,
);

// Update tag (requires Google auth)
router.put(
  "/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  tagsController.updateTagHandler,
);

// Delete tag (requires Google auth)
router.delete(
  "/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  tagsController.deleteTagHandler,
);

export default router;
