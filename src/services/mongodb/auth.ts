/**
 * MongoDB Authentication Service
 * Handles user authentication operations
 */
import { User } from "../../models/User.js";
import { normalizeGmailAddress } from "./utils.js";

/**
 * Normalize Gmail addresses for comparison
 * Gmail treats dots as equivalent and ignores everything after +
 */
export const normalizeEmail = (email: string): string => {
  return normalizeGmailAddress(email);
};

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: any }> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      deletedAt: null,
    });

    if (!user) {
      return { success: false, error: "Invalid credentials" };
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return { success: false, error: "Invalid credentials" };
    }

    return { success: true, user: user.toObject() };
  } catch (error) {
    console.error("Error authenticating user:", error);
    return {
      success: false,
      error: "Failed to authenticate. Please try again.",
    };
  }
};

/**
 * Check if email exists in the database
 */
export const emailExists = async (
  email: string,
): Promise<{ exists: boolean; error?: string }> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      deletedAt: null,
    });

    return { exists: !!user };
  } catch (error) {
    console.error("Error checking email:", error);
    return {
      exists: false,
      error: "Failed to check email.",
    };
  }
};

/**
 * Create a new user
 */
export const createUser = async (
  email: string,
  password: string,
  username: string,
  photo: string = "",
): Promise<{ success: boolean; user?: any; error?: string }> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    
    // Check if user already exists (including soft-deleted users to prevent re-registration)
    const existingUser = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      deletedAt: null,
    });

    if (existingUser) {
      return { success: false, error: "User already exists" };
    }

    const user = new User({
      email: normalizedEmail,
      password,
      username,
      photo,
    });

    await user.save();
    return { success: true, user: user.toObject() };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      success: false,
      error: "Failed to create user. Please try again.",
    };
  }
};

/**
 * Update user photo
 */
export const updateUserPhoto = async (
  email: string,
  photoUrl: string,
): Promise<boolean> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    await User.updateOne(
      { 
        email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        deletedAt: null,
      },
      { photo: photoUrl },
    );
    return true;
  } catch (error) {
    console.error("Error updating user photo:", error);
    return false;
  }
};

