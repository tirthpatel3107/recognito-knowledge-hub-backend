/**
 * Authentication Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as authController from "../controllers/authController";
import { authLimiter } from "../middleware/rateLimiter";
import {
  validateLogin,
  validateGoogleToken,
} from "../middleware/inputValidation";

const router = express.Router();

// Login with email, password, and one-time Google OAuth token
router.post("/login", authLimiter, validateLogin, authController.login);

// Verify Google OAuth token and get user info
router.post(
  "/google/verify",
  authLimiter,
  validateGoogleToken,
  authController.verifyGoogleToken,
);

// Refresh token endpoint (if needed)
router.post("/refresh", authLimiter, authController.refreshToken);

// Logout endpoint - clears authentication cookie
router.post("/logout", authController.logout);

export default router;
