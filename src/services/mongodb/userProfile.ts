/**
 * MongoDB User Profile Service
 */
import { UserProfile } from "../../models/UserProfile.js";
import { normalizeEmail } from "./auth.js";

export interface UserProfileResult {
  email: string;
  username: string;
  photo: string;
  colorPalette?: {
    lightModeColor?: string | null;
    darkModeColor?: string | null;
  };
  accessibleModules?: string[];
}

/**
 * Get user profile
 */
export const getUserProfile = async (
  email: string,
): Promise<UserProfileResult | null> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const profile = await UserProfile.findOne({ 
      email: normalizedEmail,
      deletedAt: null,
    });
    
    if (!profile) {
      return null;
    }

    // Also get user info
    const { User } = await import("../../models/User.js");
    const user = await User.findOne({ 
      email: normalizedEmail,
      deletedAt: null,
    });

    return {
      email: profile.email,
      username: user?.username || "",
      photo: user?.photo || "",
      colorPalette: profile.colorPalette,
      accessibleModules: profile.accessibleModules,
    };
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  email: string,
  profileData: {
    colorPalette?: {
      lightModeColor?: string | null;
      darkModeColor?: string | null;
    };
  },
): Promise<boolean> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    await UserProfile.findOneAndUpdate(
      { email: normalizedEmail, deletedAt: null },
      profileData,
      { upsert: true, new: true },
    );
    return true;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return false;
  }
};

/**
 * Update user photo
 */
export const updateUserPhoto = async (
  email: string,
  photo: string,
): Promise<boolean> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const { User } = await import("../../models/User.js");
    await User.findOneAndUpdate(
      { email: normalizedEmail, deletedAt: null },
      { photo },
    );
    return true;
  } catch (error) {
    console.error("Error updating user photo:", error);
    return false;
  }
};

/**
 * Get dashboard card order for a user
 * Returns accessibleModules which defines both access and display order
 */
export const getDashboardOrder = async (
  email: string,
): Promise<string[]> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const profile = await UserProfile.findOne({ 
      email: normalizedEmail,
      deletedAt: null,
    });
    return profile?.accessibleModules || [];
  } catch (error) {
    console.error("Error getting dashboard order:", error);
    return [];
  }
};

/**
 * Update dashboard card order for a user
 * Updates accessibleModules with the new order
 */
export const updateDashboardOrder = async (
  email: string,
  cardOrder: string[],
): Promise<boolean> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    // Validate that cardOrder contains valid module IDs
    const validModuleIds = [
      "question-bank",
      "work-summary",
      "practical-task",
      "kanban-board",
      "notes",
    ];
    
    // Filter to only include valid module IDs
    const validCardOrder = cardOrder.filter((cardId) =>
      validModuleIds.includes(cardId),
    );
    
    await UserProfile.findOneAndUpdate(
      { email: normalizedEmail, deletedAt: null },
      { accessibleModules: validCardOrder },
      { upsert: true, new: true },
    );
    return true;
  } catch (error) {
    console.error("Error updating dashboard order:", error);
    return false;
  }
};

/**
 * Get accessible modules for a user
 */
export const getAccessibleModules = async (
  email: string,
): Promise<string[]> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const profile = await UserProfile.findOne({ 
      email: normalizedEmail,
      deletedAt: null,
    });
    return profile?.accessibleModules || [];
  } catch (error) {
    console.error("Error getting accessible modules:", error);
    return [];
  }
};

/**
 * Update accessible modules for a user
 */
export const updateAccessibleModules = async (
  email: string,
  modules: string[],
): Promise<boolean> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    await UserProfile.findOneAndUpdate(
      { email: normalizedEmail, deletedAt: null },
      { accessibleModules: modules },
      { upsert: true, new: true },
    );
    return true;
  } catch (error) {
    console.error("Error updating accessible modules:", error);
    return false;
  }
};

