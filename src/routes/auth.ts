/**
 * Authentication Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as authController from "../controllers/authController";
import { authLimiter } from "../middleware/rateLimiter";
import { validateLogin } from "../middleware/inputValidation";

const router = express.Router();

// Login with email and password (JWT-only authentication)
router.post("/login", authLimiter, validateLogin, authController.login);

// Verify token endpoint (for backward compatibility)
router.post(
  "/google/verify",
  authLimiter,
  authenticateToken,
  authController.verifyGoogleToken,
);

// Refresh token endpoint (if needed)
router.post("/refresh", authLimiter, authController.refreshToken);

// Logout endpoint - clears authentication cookie
router.post("/logout", authController.logout);

export default router;
