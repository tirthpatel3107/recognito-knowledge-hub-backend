/**
 * Authentication Controller
 * Handles authentication-related operations
 */
import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import {
  authenticateUser,
  updateUserPhotoFromGoogle,
  setUserCredentials,
  initializeGoogleSheets,
} from "../services/googleSheetsService";
import { loadConfigFromSheet } from "../config/sheetConfigLoader";
import {
  getServiceConfigValue,
  requireServiceConfigValue,
} from "../config/googleConfig";
import { storeGoogleToken } from "../services/googleTokenStore";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";
import { ValidationError } from "../utils/errorHandler";

const extractTokenTtl = (
  accessTokenExpiresIn?: number,
  expiresIn?: number,
): number => {
  if (typeof accessTokenExpiresIn === "number" && accessTokenExpiresIn > 0) {
    return accessTokenExpiresIn;
  }
  if (typeof expiresIn === "number" && expiresIn > 0) {
    return expiresIn;
  }
  // Default to 24 hours (86400 seconds) if not provided
  return 24 * 60 * 60; // 24 hours in seconds
};

/**
 * Login with email, password, and one-time Google OAuth token
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const {
    email,
    password,
    googleAccessToken,
    accessTokenExpiresIn,
    expiresIn,
  } = req.body;

  if (!email || !password) {
    return sendValidationError(res, "Email and password are required");
  }

  if (!googleAccessToken) {
    return sendValidationError(
      res,
      "Google access token is required for login",
    );
  }

  const isValid = await authenticateUser(email, password, googleAccessToken);

  if (!isValid) {
    return sendError(res, "Invalid credentials", 401);
  }

  await loadConfigFromSheet(googleAccessToken);
  initializeGoogleSheets();

  const tokenTtlSeconds = extractTokenTtl(accessTokenExpiresIn, expiresIn);
  storeGoogleToken(email, googleAccessToken, {
    expiresInSeconds: tokenTtlSeconds,
  });

  const jwtSecretRaw = requireServiceConfigValue("JWT_SECRET");
  const jwtExpiresInRaw = getServiceConfigValue("JWT_EXPIRES_IN");
  const jwtExpiresIn: string =
    typeof jwtExpiresInRaw === "string" ? jwtExpiresInRaw : "24h";

  if (typeof jwtSecretRaw !== "string") {
    return sendError(res, "JWT secret configuration error", 500);
  }

  const jwtSecret: string = jwtSecretRaw;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signOptions: any = { expiresIn: jwtExpiresIn };
  const token = jwt.sign({ email }, jwtSecret, signOptions);

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
  // Frontend should prefer using the cookie in future versions
  return sendSuccess(res, { token, email }, "Login successful");
});

/**
 * Verify Google OAuth token and get user info
 */
export const verifyGoogleToken = asyncHandler(
  async (req: Request, res: Response) => {
    const { accessToken, expectedEmail, accessTokenExpiresIn, expiresIn } =
      req.body;

    if (!accessToken) {
      return sendValidationError(res, "Access token is required");
    }

    // Verify the token by calling Google's userinfo API
    let googleEmail: string;
    let googlePhoto: string = "";

    try {
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        // Google userinfo API error
        return sendError(res, "Invalid Google access token", 401);
      }

      const userInfo = (await userInfoResponse.json()) as {
        email?: string;
        picture?: string;
      };
      googleEmail = userInfo.email || "";
      googlePhoto = userInfo.picture || "";

      // Verify email matches if expected
      if (
        expectedEmail &&
        googleEmail.toLowerCase() !== expectedEmail.toLowerCase()
      ) {
        return sendError(res, "Email mismatch", 403, {
          expected: expectedEmail,
          received: googleEmail,
        });
      }
    } catch {
      // Error verifying Google token
      return sendError(res, "Invalid Google access token", 401);
    }

    // Load config from the sheet using the verified token
    try {
      await loadConfigFromSheet(accessToken);
      initializeGoogleSheets();
    } catch {
      // Error loading config from sheet - continue even if config loading fails
    }

    // Store the token for future use
    const tokenTtlSeconds = extractTokenTtl(accessTokenExpiresIn, expiresIn);
    storeGoogleToken(googleEmail, accessToken, {
      expiresInSeconds: tokenTtlSeconds,
    });

    // Set user credentials for Google Sheets API
    try {
      setUserCredentials(accessToken);
    } catch {
      // Could not set user credentials (config may not be loaded)
    }

    // Try to update user photo (optional, don't fail if this errors)
    if (googlePhoto) {
      try {
        await updateUserPhotoFromGoogle(googleEmail, googlePhoto, accessToken);
      } catch {
        // Error saving Google photo to sheet - don't fail the request if photo update fails
      }
    }

    return sendSuccess(
      res,
      { email: googleEmail, picture: googlePhoto },
      "Google authentication verified",
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

  // If user is authenticated, clear their Google token from server memory
  if (req.user?.email) {
    const { clearGoogleToken } = await import("../services/googleTokenStore");
    clearGoogleToken(req.user.email);
  }

  return sendSuccess(res, null, "Logged out successfully");
});
