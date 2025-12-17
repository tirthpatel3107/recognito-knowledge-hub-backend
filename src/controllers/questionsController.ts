/**
 * Questions Controller
 * Handles question-related operations
 */
import { Request, Response } from "express";
import {
  getQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  reorderQuestionsByIds,
} from "../services/mongodb/questions";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
} from "../utils/responseHelper";

/**
 * Get questions for a technology
 */
export const getQuestionsByTechnology = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName } = req.params;

    // Parse pagination parameters from query string
    const page = req.query.page
      ? parseInt(req.query.page as string, 10)
      : undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;

    // Validate pagination parameters
    if (page !== undefined && (isNaN(page) || page < 1)) {
      return sendValidationError(res, "Page must be a positive integer");
    }
    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return sendValidationError(res, "Limit must be a positive integer");
    }

    const questions = await getQuestions(technologyName, page, limit);
    return sendSuccess(res, questions);
  },
);

/**
 * Add a question
 */
export const addQuestionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName } = req.params;
    const { question, answer, example, priority } = req.body;

    if (!question || !answer) {
      return sendValidationError(res, "Question and answer are required");
    }

    const success = await addQuestion(technologyName, {
      question,
      answer,
      example,
      priority: priority || "low",
    });

    if (success) {
      return sendSuccess(res, null, "Question added successfully");
    } else {
      return sendError(res, "Failed to add question", 500);
    }
  },
);

/**
 * Update a question
 */
export const updateQuestionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName, rowIndex } = req.params;
    const { question, answer, example, priority } = req.body;

    if (!question || !answer) {
      return sendValidationError(res, "Question and answer are required");
    }

    const success = await updateQuestion(technologyName, rowIndex, {
      question,
      answer,
      example,
      priority: priority || "low",
    });

    if (success) {
      return sendSuccess(res, null, "Question updated successfully");
    } else {
      return sendError(res, "Failed to update question", 500);
    }
  },
);

/**
 * Delete a question
 */
export const deleteQuestionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName, rowIndex } = req.params;

    const success = await deleteQuestion(technologyName, rowIndex);

    if (success) {
      return sendSuccess(res, null, "Question deleted successfully");
    } else {
      return sendError(res, "Failed to delete question", 500);
    }
  },
);

/**
 * Reorder questions
 */
export const reorderQuestionsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName } = req.params;
    const { oldIndex, newIndex, questionIds } = req.body;

    // Support both formats: { oldIndex, newIndex } or { questionIds: [] }
    if (oldIndex !== undefined && newIndex !== undefined) {
      // Handle oldIndex/newIndex format
      if (typeof oldIndex !== "number" || typeof newIndex !== "number") {
        return sendValidationError(
          res,
          "oldIndex and newIndex must be numbers",
        );
      }

      const success = await reorderQuestions(
        technologyName,
        oldIndex,
        newIndex,
      );

      if (success) {
        return sendSuccess(res, null, "Questions reordered successfully");
      } else {
        return sendError(res, "Failed to reorder questions", 500);
      }
    } else if (Array.isArray(questionIds)) {
      // Handle questionIds array format (backward compatibility)
      const success = await reorderQuestionsByIds(technologyName, questionIds);

      if (success) {
        return sendSuccess(res, null, "Questions reordered successfully");
      } else {
        return sendError(res, "Failed to reorder questions", 500);
      }
    } else {
      return sendValidationError(
        res,
        "Either oldIndex/newIndex or questionIds array is required",
      );
    }
  },
);
