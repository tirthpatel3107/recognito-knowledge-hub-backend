/**
 * Questions Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as questionsController from "../controllers/questionsController";
import { writeLimiter } from "../middleware/rateLimiter";
import {
  validateQuestion,
  validateRowIndex,
} from "../middleware/inputValidation";

const router = express.Router();

// Get questions for a technology (requires auth to get user-specific spreadsheet IDs from UserDetail)
router.get(
  "/:technologyName",
  authenticateToken,
  questionsController.getQuestionsByTechnology,
);

// Add question (requires Google auth)
router.post(
  "/:technologyName",
  writeLimiter,
  authenticateToken,
  authenticateGoogleToken,
  validateQuestion,
  questionsController.addQuestionHandler,
);

// Update question (requires Google auth)
router.put(
  "/:technologyName/:rowIndex",
  writeLimiter,
  authenticateToken,
  authenticateGoogleToken,
  validateRowIndex,
  validateQuestion,
  questionsController.updateQuestionHandler,
);

// Delete question (requires Google auth)
router.delete(
  "/:technologyName/:rowIndex",
  writeLimiter,
  authenticateToken,
  authenticateGoogleToken,
  validateRowIndex,
  questionsController.deleteQuestionHandler,
);

// Reorder questions (requires Google auth)
router.post(
  "/:technologyName/reorder",
  writeLimiter,
  authenticateToken,
  authenticateGoogleToken,
  questionsController.reorderQuestionsHandler,
);

export default router;
