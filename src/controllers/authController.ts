/**
 * Authentication Controller
 * Handles authentication-related operations
 */
import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import {
  authenticateUser,
  emailExists,
  normalizeEmail,
  updateUserPhoto,
} from "../services/mongodb/auth";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== "string" || !secret.trim()) {
    throw new Error("JWT_SECRET is not configured in environment variables");
  }
  return secret;
};

const getJwtExpiresIn = (): string => {
  return process.env.JWT_EXPIRES_IN || "24h";
};

/**
 * Login with email and password (JWT-only authentication)
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendValidationError(res, "Email and password are required");
  }

  // Authenticate user with email and password
  const authResult = await authenticateUser(email, password);

  if (!authResult.success) {
    // Return specific error message if available
    if (authResult.error) {
      return sendError(res, authResult.error, 401);
    }
    return sendError(res, "Invalid credentials", 401);
  }

  // Generate JWT token with userId
  const jwtSecret = getJwtSecret();
  const jwtExpiresIn = getJwtExpiresIn();
  const signOptions: SignOptions = { expiresIn: jwtExpiresIn as StringValue };
  const userId = authResult.user?._id?.toString() || "";
  const token = jwt.sign({ email, userId }, jwtSecret, signOptions);

  // Set httpOnly cookie for enhanced security (prevents XSS attacks)
  // Cookie expires based on JWT expiration
  const maxAge = jwtExpiresIn.includes("h")
    ? parseInt(jwtExpiresIn) * 60 * 60 * 1000
    : jwtExpiresIn.includes("d")
      ? parseInt(jwtExpiresIn) * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000; // Default 24 hours

  res.cookie("authToken", token, {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // CSRF protection
    maxAge: maxAge,
    path: "/",
  });

  // Also return token in response for backward compatibility
  return sendSuccess(res, { token, email }, "Login successful");
});

/**
 * Verify token endpoint (for backward compatibility)
 * Now just returns user info from JWT
 */
export const verifyGoogleToken = asyncHandler(
  async (req: Request, res: Response) => {
    // This endpoint is kept for backward compatibility but no longer verifies Google tokens
    // The user should be authenticated via JWT middleware
    if (!req.user) {
      return sendError(res, "User not authenticated", 401);
    }

    const { User } = await import("../models/User.js");
    const user = await User.findOne({ 
      email: req.user.email,
      deletedAt: null,
    });

    return sendSuccess(
      res,
      {
        email: req.user.email,
        picture: user?.photo || "",
      },
      "Token verified",
    );
  },
);

/**
 * Refresh token endpoint (not implemented)
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    return sendError(res, "Not implemented", 501);
  },
);

/**
 * Logout endpoint - clears authentication cookie
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  // Clear the httpOnly cookie
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  return sendSuccess(res, null, "Logged out successfully");
});
