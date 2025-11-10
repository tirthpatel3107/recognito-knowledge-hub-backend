/**
 * User Preferences Routes
 */
import express from 'express';
import { authenticateToken, authenticateGoogleToken } from '../middleware/auth';
import * as userController from '../controllers/userController';

const router = express.Router();

// Get dashboard card order
router.get('/dashboard-order', authenticateToken, userController.getDashboardCardOrderHandler);

// Save dashboard card order
router.post(
  '/dashboard-order',
  authenticateToken,
  authenticateGoogleToken,
  userController.saveDashboardCardOrderHandler
);

// Get user mode preference
router.get('/mode', authenticateToken, userController.getUserModeHandler);

// Update user mode preference
router.post(
  '/mode',
  authenticateToken,
  authenticateGoogleToken,
  userController.updateUserModeHandler
);

// Get user profile (username and email from UserDetail sheet)
router.get('/profile', authenticateToken, userController.getUserProfileHandler);

// Update user profile (username and photo in UserDetail sheet)
router.post(
  '/profile',
  authenticateToken,
  authenticateGoogleToken,
  userController.updateUserProfileHandler
);

// Change user password
router.post(
  '/password',
  authenticateToken,
  authenticateGoogleToken,
  userController.updateUserPasswordHandler
);

// Get user color palette preference
router.get('/color-palette', authenticateToken, userController.getUserColorPaletteHandler);

// Update user color palette preference
router.post(
  '/color-palette',
  authenticateToken,
  authenticateGoogleToken,
  userController.updateUserColorPaletteHandler
);

export default router;

