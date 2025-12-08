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
  getTechnologies,
  setUserCredentials,
} from "../services/googleSheets";
import { asyncHandler } from "../utils/asyncHandler";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} from "../utils/responseHelper";
import { getGoogleTokenFromRequest } from "../utils/googleTokenHelper";

/**
 * Get questions for a technology
 */
export const getQuestionsByTechnology = asyncHandler(
  async (req: Request, res: Response) => {
    const { technologyName } = req.params;
    const googleToken = getGoogleTokenFromRequest(req);

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

    const email = req.user?.email || null;
    const questions = await getQuestions(
      technologyName,
      googleToken,
      page,
      limit,
      email,
    );
    return sendSuccess(res, questions);
  },
);

/**
 * Add a question
 */
export const addQuestionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    setUserCredentials(req.googleToken!);
    const email = req.user?.email || null;
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
    }, email, req.googleToken!);

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
    setUserCredentials(req.googleToken!);
    const email = req.user?.email || null;
    const { technologyName, rowIndex } = req.params;
    const { question, answer, example, priority } = req.body;

    if (!question || !answer) {
      return sendValidationError(res, "Question and answer are required");
    }

    const success = await updateQuestion(technologyName, parseInt(rowIndex), {
      question,
      answer,
      example,
      priority: priority || "low",
    }, email, req.googleToken!);

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
    setUserCredentials(req.googleToken!);
    const { technologyName, rowIndex } = req.params;

    // Get sheet ID for the technology
    const technologies = await getTechnologies(req.googleToken!);
    const tech = technologies.find((t) => t.name === technologyName);

    if (!tech || tech.sheetId === undefined) {
      return sendNotFound(res, "Technology");
    }

    const email = req.user?.email || null;
    const success = await deleteQuestion(
      technologyName,
      parseInt(rowIndex),
      tech.sheetId,
      req.googleToken!,
      email,
    );

    if (success) {
      return sendSuccess(
        res,
        null,
        "Question deleted successfully",
      );
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
    setUserCredentials(req.googleToken!);
    const { technologyName } = req.params;
    const { oldIndex, newIndex } = req.body;

    if (
      oldIndex === undefined ||
      newIndex === undefined ||
      typeof oldIndex !== "number" ||
      typeof newIndex !== "number"
    ) {
      return sendValidationError(
        res,
        "oldIndex and newIndex are required numbers",
      );
    }

    // Get sheet ID for the technology
    const technologies = await getTechnologies(req.googleToken!);
    const tech = technologies.find((t) => t.name === technologyName);

    if (!tech || tech.sheetId === undefined) {
      return sendNotFound(res, "Technology");
    }

    const email = req.user?.email || null;
    const success = await reorderQuestions(
      technologyName,
      oldIndex,
      newIndex,
      tech.sheetId,
      email,
      req.googleToken!,
    );

    if (success) {
      return sendSuccess(res, null, "Questions reordered successfully");
    } else {
      return sendError(res, "Failed to reorder questions", 500);
    }
  },
);
