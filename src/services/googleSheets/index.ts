/**
 * Google Sheets Service Index
 * Central export point for all Google Sheets service modules
 */

// Core utilities and initialization
export {
  initializeGoogleSheets,
  setUserCredentials,
  getSheetsClient,
  splitTextIntoChunks,
  getColumnLetter,
  formatDateForGoogleSheets,
  parseDateFromGoogleSheets,
  convertHtmlToFormattedText,
  parseMonthNameToDate,
  getMonthNameFromDate,
  ensureSheetHeaders,
  updateSerialNumbers,
  findRowIndexByEmail,
  findSheetByName,
  clearSpreadsheetMetadataCache,
} from "./utils";

// Authentication
export { authenticateUser, updateUserPhotoFromGoogle } from "./auth";

// Technologies
export {
  getTechnologies,
  createTechnology,
  updateTechnology,
  deleteTechnology,
  reorderTechnologies,
} from "./technologies";

// Practical Task Technologies
export {
  getPracticalTaskTechnologies,
  createPracticalTaskTechnology,
  updatePracticalTaskTechnology,
  deletePracticalTaskTechnology,
  reorderPracticalTaskTechnologies,
} from "./practicalTaskTechnologies";

// Questions
export {
  getQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  type PaginatedResponse,
} from "./questions";

// Practical Tasks
export {
  getPracticalTasks,
  getPracticalTasksByTechnology,
  addPracticalTask,
  updatePracticalTask,
  deletePracticalTask,
  reorderPracticalTasks,
} from "./practicalTasks";

// Projects
export {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  reorderProjects,
} from "./projects";

// Tags
export { getTags, addTag, updateTag, deleteTag } from "./tags";

// Work Summary
export {
  getWorkSummaryMonthSheets,
  getWorkSummaryEntriesByMonth,
  createWorkSummaryMonthSheet,
  addWorkSummaryEntry,
  updateWorkSummaryEntry,
  deleteWorkSummaryEntry,
} from "./workSummary";

// User Profile
export {
  getUserProfile,
  updateUserProfile,
  updateUserPassword,
  getUserMode,
  updateUserMode,
  getUserColorPalette,
  updateUserColorPalette,
  getTabs,
  saveTabs,
} from "./userProfile";

// Dashboard
export { getDashboardCardOrder, saveDashboardCardOrder } from "./dashboard";
