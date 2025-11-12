/**
 * Questions Routes
 */
import express from "express";
import { authenticateToken, authenticateGoogleToken } from "../middleware/auth";
import * as questionsController from "../controllers/questionsController";

const router = express.Router();

// Get questions for a technology (read-only, but supports OAuth if available)
router.get("/:technologyName", questionsController.getQuestionsByTechnology);

// Add question (requires Google auth)
router.post(
  "/:technologyName",
  authenticateToken,
  authenticateGoogleToken,
  questionsController.addQuestionHandler,
);

// Update question (requires Google auth)
router.put(
  "/:technologyName/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  questionsController.updateQuestionHandler,
);

// Delete question (requires Google auth)
router.delete(
  "/:technologyName/:rowIndex",
  authenticateToken,
  authenticateGoogleToken,
  questionsController.deleteQuestionHandler,
);

// Reorder questions (requires Google auth)
router.post(
  "/:technologyName/reorder",
  authenticateToken,
  authenticateGoogleToken,
  questionsController.reorderQuestionsHandler,
);

export default router;
