/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  getServiceConfigValue,
  isConfigLoaded,
} from "../config/googleConfig";
import { getGoogleToken } from "../services/googleTokenStore";

interface UserPayload {
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      googleToken?: string;
    }
  }
}

const getJwtSecret = (): string | null => {
  const secret = getServiceConfigValue("JWT_SECRET");
  // Return null if secret is not a string, is empty, or is null/undefined
  if (typeof secret !== "string" || !secret.trim()) {
    return null;
  }
  return secret;
};

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const jwtSecret = getJwtSecret();

  if (!jwtSecret) {
    // JWT secret is not configured in the Config sheet
    // This can happen if:
    // 1. Server restarted and config hasn't been loaded yet (config is loaded during login)
    // 2. Config failed to load from Google Sheets
    // 3. JWT_SECRET is missing or empty in the Config sheet
    const configLoaded = isConfigLoaded();
    console.error(
      `[Auth Middleware] JWT_SECRET is not configured. Config loaded: ${configLoaded}. Config must be loaded from Google Sheets during login.`,
    );
    
    let errorMessage =
      "JWT secret is not configured. Please ensure the Config tab exists in your login spreadsheet and contains JWT_SECRET.";
    if (!configLoaded) {
      errorMessage +=
        " Configuration has not been loaded yet. If you just restarted the server, please log in again to reload the configuration.";
    } else {
      errorMessage +=
        " Configuration was loaded but JWT_SECRET is missing or empty. Please check your Config sheet.";
    }

    res.status(500).json({
      error: "Server configuration error",
      message: errorMessage,
    });
    return;
  }

  // Try to get token from httpOnly cookie first (more secure)
  let token = req.cookies?.authToken;

  // Fallback to Authorization header for backward compatibility
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    req.user = decoded;
    next();
  } catch (error: any) {
    // Token verification failed
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const authenticateGoogleToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let googleToken =
    (req.headers["x-google-token"] as string) ||
    (req.headers["authorization"] &&
      req.headers["authorization"].split(" ")[1]);

  if (!googleToken && req.user && req.user.email) {
    googleToken = getGoogleToken(req.user.email) || undefined;
  }

  if (!googleToken) {
    res
      .status(401)
      .json({ error: "Google access token required for write operations" });
    return;
  }

  req.googleToken = googleToken;
  next();
};
