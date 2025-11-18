/**
 * Input Validation Middleware
 * Validates and sanitizes user input to prevent injection attacks
 */
import { body, param, query, ValidationChain, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { sendValidationError } from "../utils/responseHelper";

/**
 * Middleware to check validation results
 */
export const validate = (
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((error) => `${error.msg} (${error.type})`)
      .join(", ");
    return sendValidationError(res, errorMessages);
  }
  next();
};

/**
 * Validation rules for authentication
 */
export const validateLogin = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Email must be a valid email address")
    .normalizeEmail(),
  body("password")
    .trim()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("googleAccessToken")
    .trim()
    .notEmpty()
    .withMessage("Google access token is required"),
  validate,
];

/**
 * Validation rules for Google token verification
 */
export const validateGoogleToken = [
  body("accessToken")
    .trim()
    .notEmpty()
    .withMessage("Access token is required"),
  body("expectedEmail")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Expected email must be a valid email address")
    .normalizeEmail(),
  validate,
];

/**
 * Validation rules for technology operations
 */
export const validateTechnology = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Technology name must be between 1 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage("Technology name contains invalid characters"),
  validate,
];

/**
 * Validation rules for question operations
 */
export const validateQuestion = [
  body("question")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Question must be between 1 and 5000 characters"),
  body("answer")
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage("Answer must be between 1 and 10000 characters"),
  body("imageUrls")
    .optional()
    .isArray()
    .withMessage("Image URLs must be an array"),
  body("imageUrls.*")
    .optional()
    .isURL()
    .withMessage("Each image URL must be a valid URL"),
  validate,
];

/**
 * Validation rules for project operations
 */
export const validateProject = [
  body("project")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Project name must be between 1 and 200 characters"),
  body("projectId")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Project ID must be between 1 and 200 characters"),
  validate,
];

/**
 * Validation rules for work summary operations
 */
export const validateWorkSummary = [
  body("projectName")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Project name must be between 1 and 200 characters"),
  body("workSummary")
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage("Work summary must be between 1 and 10000 characters"),
  body("date")
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD format"),
  validate,
];

/**
 * Validation rules for ID parameters
 */
export const validateId = [
  param("id")
    .trim()
    .matches(/^\d+$/)
    .withMessage("ID must be a valid number"),
  validate,
];

/**
 * Validation rules for sheet ID parameters
 */
export const validateSheetId = [
  param("sheetId")
    .trim()
    .matches(/^\d+$/)
    .withMessage("Sheet ID must be a valid number"),
  validate,
];

/**
 * Validation rules for row index parameters
 */
export const validateRowIndex = [
  param("rowIndex")
    .trim()
    .matches(/^\d+$/)
    .withMessage("Row index must be a valid number"),
  validate,
];

/**
 * Validation rules for password change
 */
export const validatePasswordChange = [
  body("currentPassword")
    .trim()
    .isLength({ min: 6 })
    .withMessage("Current password must be at least 6 characters long"),
  body("newPassword")
    .trim()
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  validate,
];

/**
 * Validation rules for user profile update
 */
export const validateUserProfile = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Username must be between 1 and 100 characters"),
  body("photo")
    .optional()
    .trim()
    .isURL()
    .withMessage("Photo must be a valid URL"),
  validate,
];

/**
 * Validation rules for tag operations
 */
export const validateTag = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Tag name must be between 1 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage("Tag name contains invalid characters"),
  validate,
];

/**
 * Sanitize string input to prevent XSS
 */
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .substring(0, 10000); // Limit length
};

/**
 * Sanitize email input
 */
export const sanitizeEmail = (input: string): string => {
  return input.trim().toLowerCase().substring(0, 255);
};

