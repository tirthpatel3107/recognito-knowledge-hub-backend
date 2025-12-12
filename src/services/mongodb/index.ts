/**
 * MongoDB Services Index
 * Central export for all MongoDB services
 */

// Export types first
export * from "./types.js";

// Export auth services (excluding updateUserPhoto to avoid conflict)
export {
  authenticateUser,
  emailExists,
  normalizeEmail,
} from "./auth.js";

// Export other services
export * from "./technologies.js";
export * from "./questions.js";
export * from "./projects.js";
export * from "./workSummary.js";
export * from "./practicalTasks.js";
export * from "./practicalTaskTechnologies.js";
export * from "./tags.js";
export * from "./kanban.js";
export * from "./notes.js";

// Export userProfile services (includes updateUserPhoto, getDashboardOrder, updateDashboardOrder)
export * from "./userProfile.js";

// Export dashboard services (excluding functions that conflict with userProfile)
// Note: dashboard.js is kept for backward compatibility, but userProfile.js is preferred

