/**
 * User Controller
 * Handles user preferences and profile operations
 */
import { Request, Response } from "express";
import {
  getDashboardOrder,
  updateDashboardOrder,
  getUserProfile,
  updateUserProfile,
  updateUserPhoto,
} from "../services/mongodb/userProfile";
import { User } from "../models/User.js";
import { Attendance } from "../models/Attendance.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
} from "../utils/responseHelper";

/**
 * Get dashboard card order
 */
export const getDashboardCardOrderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user!.email;
    const cardOrder = await getDashboardOrder(email);
    return sendSuccess(res, cardOrder);
  },
);

/**
 * Save dashboard card order
 */
export const saveDashboardCardOrderHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user!.email;
    const { cardOrder } = req.body;

    if (!Array.isArray(cardOrder)) {
      return sendValidationError(res, "cardOrder must be an array");
    }

    const success = await updateDashboardOrder(email, cardOrder);

    if (success) {
      return sendSuccess(res, null, "Dashboard card order saved successfully");
    } else {
      return sendError(res, "Failed to save dashboard card order", 500);
    }
  },
);

/**
 * Get user profile
 */
export const getUserProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user!.email;
    const profile = await getUserProfile(email);
    return sendSuccess(res, profile);
  },
);

/**
 * Update user profile
 */
export const updateUserProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user!.email;
    const { username, photo } = req.body;

    // Username is optional (can be updated separately), but validate if provided
    if (username !== undefined && username !== null && username.trim() === "") {
      return sendValidationError(res, "Username cannot be empty");
    }

    try {
      // Update username in User model if provided
      if (username !== undefined) {
        await User.findOneAndUpdate(
          { email, deletedAt: null },
          { username: username.trim() },
        );
      }

      // Update photo in User model if provided
      if (photo !== undefined) {
        await updateUserPhoto(email, photo || "");
      }

      return sendSuccess(res, null, "Profile updated successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update profile";
      return sendError(res, errorMessage, 500);
    }
  },
);

/**
 * Change user password
 */
export const updateUserPasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user!.email;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return sendValidationError(
        res,
        "Current password and new password are required",
      );
    }

    if (newPassword.length < 6) {
      return sendValidationError(
        res,
        "New password must be at least 6 characters long",
      );
    }

    if (currentPassword === newPassword) {
      return sendValidationError(
        res,
        "New password must be different from current password",
      );
    }

    try {
      const user = await User.findOne({ email, deletedAt: null });
      if (!user) {
        return sendError(res, "User not found", 404);
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return sendError(res, "Current password is incorrect", 401);
      }

      // Update password (User model will hash it automatically)
      user.password = newPassword;
      await user.save();

      return sendSuccess(res, null, "Password changed successfully");
    } catch (error: any) {
      const errorMessage = error.message || "Failed to change password";
      const statusCode =
        error.message === "Current password is incorrect" ? 401 : 500;
      return sendError(res, errorMessage, statusCode);
    }
  },
);

/**
 * Get user color palette preference
 */
export const getUserColorPaletteHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user!.email;
    const profile = await getUserProfile(email);
    return sendSuccess(res, profile?.colorPalette || { darkModeColor: null });
  },
);

/**
 * Update user color palette preference
 */
export const updateUserColorPaletteHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user!.email;
    const { lightModeColor, darkModeColor } = req.body;

    // Validate color is a string (HSL format: "hue saturation% lightness%")
    // Allow null/empty to reset to default
    if (
      darkModeColor !== undefined &&
      darkModeColor !== null &&
      typeof darkModeColor !== "string"
    ) {
      return sendValidationError(res, "darkModeColor must be a string or null");
    }

    // Convert empty strings to null, but preserve null values
    const darkColorValue =
      darkModeColor === null ||
      darkModeColor === undefined ||
      darkModeColor === ""
        ? null
        : darkModeColor;

    const success = await updateUserProfile(email, {
      colorPalette: {
        lightModeColor: null, // lightModeColor is no longer used
        darkModeColor: darkColorValue,
      },
    });

    if (success) {
      return sendSuccess(res, null, "Color palette updated successfully");
    } else {
      return sendError(res, "Failed to update color palette", 500);
    }
  },
);

/**
 * Get user-specific spreadsheet IDs (deprecated - no longer needed with MongoDB)
 */
export const getUserSpreadsheetIdsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    // Return empty object since we no longer use Google Sheets
    return sendSuccess(res, {});
  },
);

/**
 * Get list of users (for attendance user selection)
 * Returns users that the current user has created attendance records for,
 * plus the current user themselves
 */
export const getUsersForAttendanceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const currentUserId = req.user!.userId;

      // Get distinct targetUserIds for attendance records created by this user
      const distinctTargetUsers = await Attendance.distinct("targetUserId", {
        userId: currentUserId,
        deletedAt: null,
      });

      // Always include the current user
      const allTargetUserIds = [
        new mongoose.Types.ObjectId(currentUserId),
        ...distinctTargetUsers,
      ];

      // Get unique user IDs (remove duplicates)
      const uniqueUserIds = [...new Set(allTargetUserIds.map((id) => id.toString()))];

      // Get user details
      const users = await User.find({
        _id: { $in: uniqueUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
        deletedAt: null,
      }).select("_id username email photo");

      const userList = users.map((user) => ({
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        photo: user.photo || "",
      }));

      return sendSuccess(res, userList);
    } catch (error) {
      console.error("Error getting users for attendance:", error);
      return sendError(res, "Failed to get users", 500);
    }
  },
);
