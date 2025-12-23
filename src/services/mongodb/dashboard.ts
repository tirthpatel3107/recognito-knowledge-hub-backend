/**
 * MongoDB Dashboard Service
 * Note: This service is kept for backward compatibility.
 * Consider using functions from userProfile.ts instead.
 */
import { UserProfile } from "../../models/UserProfile.js";
import { normalizeEmail } from "./auth.js";

/**
 * Get dashboard order for a user
 * Returns accessibleModules which defines both access and display order
 */
export const getDashboardOrder = async (
  email: string,
): Promise<string[]> => {
  const normalizedEmail = normalizeEmail(email);
  const profile = await UserProfile.findOne({ 
    email: normalizedEmail,
    deletedAt: null,
  });
  return profile?.accessibleModules || [];
};

/**
 * Update dashboard order for a user
 * Updates accessibleModules with the new order
 */
export const updateDashboardOrder = async (
  email: string,
  order: string[],
): Promise<boolean> => {
  try {
    const normalizedEmail = normalizeEmail(email);
    // Validate that order contains valid module IDs
    const validModuleIds = [
      "question-bank",
      "work-summary",
      "practical-task",
      "kanban-board",
      "notes",
      "attendance",
    ];
    
    // Filter to only include valid module IDs
    const validOrder = order.filter((cardId) =>
      validModuleIds.includes(cardId),
    );
    
    await UserProfile.findOneAndUpdate(
      { email: normalizedEmail, deletedAt: null },
      { accessibleModules: validOrder },
      { upsert: true, new: true },
    );
    return true;
  } catch (error) {
    console.error("Error updating dashboard order:", error);
    return false;
  }
};

