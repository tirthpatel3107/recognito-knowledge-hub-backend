/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface UserPayload {
  email: string;
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== "string" || !secret.trim()) {
    throw new Error("JWT_SECRET is not configured in environment variables");
  }
  return secret;
};

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const jwtSecret = getJwtSecret();

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

    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.message?.includes("JWT_SECRET")) {
      res.status(500).json({
        error: "Server configuration error",
        message: error.message,
      });
      return;
    }
    // Token verification failed
    res.status(403).json({ error: "Invalid or expired token" });
  }
};
