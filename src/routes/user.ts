/**
 * User Preferences Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as userController from "../controllers/userController";

const router = express.Router();

// Get dashboard card order
router.get(
  "/dashboard-order",
  authenticateToken,
  userController.getDashboardCardOrderHandler,
);

// Save dashboard card order
router.post(
  "/dashboard-order",
  authenticateToken,
  userController.saveDashboardCardOrderHandler,
);

// Get user profile (username and email from UserDetail sheet)
router.get("/profile", authenticateToken, userController.getUserProfileHandler);

// Update user profile (username and photo in UserDetail sheet)
router.post(
  "/profile",
  authenticateToken,
  userController.updateUserProfileHandler,
);

// Change user password
router.post(
  "/password",
  authenticateToken,
  userController.updateUserPasswordHandler,
);

// Get user color palette preference
router.get(
  "/color-palette",
  authenticateToken,
  userController.getUserColorPaletteHandler,
);

// Update user color palette preference
router.post(
  "/color-palette",
  authenticateToken,
  userController.updateUserColorPaletteHandler,
);

// Get user-specific spreadsheet IDs
router.get(
  "/spreadsheet-ids",
  authenticateToken,
  userController.getUserSpreadsheetIdsHandler,
);

// Get users for attendance selection
router.get(
  "/attendance-users",
  authenticateToken,
  userController.getUsersForAttendanceHandler,
);

export default router;
