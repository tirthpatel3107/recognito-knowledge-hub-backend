/**
 * Code Editor Controller
 * Handles code editor API requests
 */
import { Request, Response } from "express";
import {
  listFiles,
  readFileContent,
  writeFileContent,
  getAICodeSuggestions,
  getAICodeCompletion,
} from "../services/codeEditorService";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendError, sendValidationError } from "../utils/responseHelper";

/**
 * List files in a directory
 */
export const listFilesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectType, path } = req.query;
    
    if (!projectType || (projectType !== "frontend" && projectType !== "backend")) {
      return sendValidationError(res, "projectType must be 'frontend' or 'backend'");
    }
    
    const dirPath = typeof path === "string" ? path : "";
    const files = await listFiles(projectType as "frontend" | "backend", dirPath);
    return sendSuccess(res, files);
  },
);

/**
 * Read file content
 */
export const readFileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectType, filePath } = req.query;
    
    if (!projectType || (projectType !== "frontend" && projectType !== "backend")) {
      return sendValidationError(res, "projectType must be 'frontend' or 'backend'");
    }
    
    if (!filePath || typeof filePath !== "string") {
      return sendValidationError(res, "filePath is required");
    }
    
    const content = await readFileContent(
      projectType as "frontend" | "backend",
      filePath,
    );
    return sendSuccess(res, { content, filePath });
  },
);

/**
 * Write file content
 */
export const writeFileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectType, filePath, content } = req.body;
    
    if (!projectType || (projectType !== "frontend" && projectType !== "backend")) {
      return sendValidationError(res, "projectType must be 'frontend' or 'backend'");
    }
    
    if (!filePath || typeof filePath !== "string") {
      return sendValidationError(res, "filePath is required");
    }
    
    if (content === undefined || typeof content !== "string") {
      return sendValidationError(res, "content is required");
    }
    
    await writeFileContent(
      projectType as "frontend" | "backend",
      filePath,
      content,
    );
    return sendSuccess(res, null, "File saved successfully");
  },
);

/**
 * Get AI code suggestions
 */
export const getAISuggestionsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, filePath, language, projectType, userPrompt } = req.body;
    
    if (!code || typeof code !== "string") {
      return sendValidationError(res, "code is required");
    }
    
    const suggestions = await getAICodeSuggestions(code, {
      filePath,
      language,
      projectType,
      userPrompt,
    });
    
    return sendSuccess(res, suggestions);
  },
);

/**
 * Get AI code completion
 */
export const getAICompletionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, cursorPosition, filePath, language, projectType } = req.body;
    
    if (!code || typeof code !== "string") {
      return sendValidationError(res, "code is required");
    }
    
    if (!cursorPosition || typeof cursorPosition.line !== "number" || typeof cursorPosition.column !== "number") {
      return sendValidationError(res, "cursorPosition with line and column is required");
    }
    
    const completion = await getAICodeCompletion(code, cursorPosition, {
      filePath,
      language,
      projectType,
    });
    
    return sendSuccess(res, { completion });
  },
);

