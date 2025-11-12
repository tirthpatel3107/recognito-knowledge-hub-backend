/**
 * Projects Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as projectsController from "../controllers/projectsController";

const router = express.Router();

// Get all projects (read-only, but supports OAuth if available)
router.get("/", projectsController.getAllProjects);

// Add project (requires Google auth)
router.post(
  "/",
  authenticateToken,
  authenticateGoogleToken,
  projectsController.addProjectHandler,
);

// Update project (requires Google auth)
router.put(
  "/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  projectsController.updateProjectHandler,
);

// Delete project (requires Google auth)
router.delete(
  "/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  projectsController.deleteProjectHandler,
);

// Reorder projects (requires Google auth)
router.post(
  "/reorder",
  authenticateToken,
  authenticateGoogleToken,
  projectsController.reorderProjectsHandler,
);

export default router;
