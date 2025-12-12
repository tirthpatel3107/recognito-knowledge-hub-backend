/**
 * Projects Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as projectsController from "../controllers/projectsController";

const router = express.Router();

// Get all projects (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get("/", authenticateToken, projectsController.getAllProjects);

// Add project (requires Google auth)
router.post(
  "/",
  authenticateToken,
  projectsController.addProjectHandler,
);

// Update project (requires Google auth)
router.put(
  "/:rowIndex",
  authenticateToken,
  projectsController.updateProjectHandler,
);

// Delete project (requires Google auth)
router.delete(
  "/:rowIndex",
  authenticateToken,
  projectsController.deleteProjectHandler,
);

// Reorder projects (requires Google auth)
router.post(
  "/reorder",
  authenticateToken,
  projectsController.reorderProjectsHandler,
);

export default router;
