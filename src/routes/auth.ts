/**
 * Authentication Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as authController from "../controllers/authController";

const router = express.Router();

// Login with email, password, and one-time Google OAuth token
router.post("/login", authController.login);

// Verify Google OAuth token and get user info
router.post("/google/verify", authController.verifyGoogleToken);

// Refresh token endpoint (if needed)
router.post("/refresh", authController.refreshToken);

export default router;
