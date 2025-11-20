/**
 * Code Editor Service
 * Handles file operations and AI code suggestions
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join, dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get project root (parent of backend directory)
const PROJECT_ROOT = resolve(__dirname, "../..");
const FRONTEND_ROOT = resolve(PROJECT_ROOT, "..", "recognito-knowledge-hub");
const BACKEND_ROOT = resolve(PROJECT_ROOT, "recognito-knowledge-hub-backend");

// Initialize Gemini AI
let genAI: GoogleGenerativeAI | null = null;

const initializeGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[CodeEditor] GEMINI_API_KEY not found in environment variables",
    );
    return null;
  }
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log("[CodeEditor] Gemini AI initialized successfully");
    return genAI;
  } catch (error) {
    console.error("[CodeEditor] Failed to initialize Gemini AI:", error);
    return null;
  }
};

// Lazy initialization
const getGeminiAI = () => {
  if (!genAI) {
    return initializeGemini();
  }
  return genAI;
};

/**
 * Get file path based on project type
 */
const getFilePath = (
  projectType: "frontend" | "backend",
  filePath: string,
): string => {
  const basePath = projectType === "frontend" ? FRONTEND_ROOT : BACKEND_ROOT;
  const resolvedPath = resolve(basePath, filePath);

  // Security check: ensure the resolved path is within the base path
  if (!resolvedPath.startsWith(basePath)) {
    throw new Error("Invalid file path: path traversal detected");
  }

  return resolvedPath;
};

/**
 * List files in a directory
 */
export const listFiles = async (
  projectType: "frontend" | "backend",
  dirPath: string = "",
): Promise<
  Array<{ name: string; type: "file" | "directory"; path: string }>
> => {
  try {
    const basePath = projectType === "frontend" ? FRONTEND_ROOT : BACKEND_ROOT;
    const fullPath = dirPath ? resolve(basePath, dirPath) : basePath;

    // Security check
    if (!fullPath.startsWith(basePath)) {
      throw new Error("Invalid directory path: path traversal detected");
    }

    const entries = await readdir(fullPath, { withFileTypes: true });
    const result: Array<{
      name: string;
      type: "file" | "directory";
      path: string;
    }> = [];

    for (const entry of entries) {
      // Skip node_modules, dist, .git, and other build/cache directories
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "dist-electron" ||
        entry.name === ".next" ||
        entry.name === ".vite"
      ) {
        continue;
      }

      const relativePath = dirPath ? join(dirPath, entry.name) : entry.name;
      result.push({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        path: relativePath,
      });
    }

    return result.sort((a, b) => {
      // Directories first, then files, both alphabetically
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error("[CodeEditor] Error listing files:", error);
    throw error;
  }
};

/**
 * Read file content
 */
export const readFileContent = async (
  projectType: "frontend" | "backend",
  filePath: string,
): Promise<string> => {
  try {
    const fullPath = getFilePath(projectType, filePath);
    const content = await readFile(fullPath, "utf-8");
    return content;
  } catch (error) {
    console.error("[CodeEditor] Error reading file:", error);
    throw error;
  }
};

/**
 * Write file content
 */
export const writeFileContent = async (
  projectType: "frontend" | "backend",
  filePath: string,
  content: string,
): Promise<void> => {
  try {
    const fullPath = getFilePath(projectType, filePath);

    // Ensure directory exists
    const dir = dirname(fullPath);
    await import("fs/promises").then((fs) =>
      fs.mkdir(dir, { recursive: true }),
    );

    await writeFile(fullPath, content, "utf-8");
  } catch (error) {
    console.error("[CodeEditor] Error writing file:", error);
    throw error;
  }
};

/**
 * Get AI code suggestions using Gemini
 */
export const getAICodeSuggestions = async (
  code: string,
  context?: {
    filePath?: string;
    language?: string;
    projectType?: "frontend" | "backend";
    userPrompt?: string;
  },
): Promise<{ suggestions: string; explanation: string }> => {
  try {
    const ai = getGeminiAI();
    if (!ai) {
      throw new Error(
        "Gemini AI not initialized. Please set GEMINI_API_KEY in environment variables.",
      );
    }

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const language = context?.language || "typescript";
    const filePath = context?.filePath || "unknown";
    const projectType = context?.projectType || "frontend";
    const userPrompt =
      context?.userPrompt ||
      "Analyze this code and provide suggestions for improvement.";

    const prompt = `You are an expert code reviewer and assistant. Analyze the following ${language} code from ${projectType} project (file: ${filePath}).

${userPrompt}

Code:
\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Code suggestions and improvements
2. Potential bugs or issues
3. Best practices recommendations
4. If the user asked for specific changes, provide the updated code

Format your response as JSON with the following structure:
{
  "suggestions": "Your detailed suggestions and analysis",
  "explanation": "Explanation of the changes or recommendations",
  "updatedCode": "The improved code (if applicable, otherwise empty string)"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestions: parsed.suggestions || text,
          explanation: parsed.explanation || "",
        };
      }
    } catch {
      // If JSON parsing fails, return the raw text
    }

    return {
      suggestions: text,
      explanation: "AI analysis completed",
    };
  } catch (error) {
    console.error("[CodeEditor] Error getting AI suggestions:", error);
    throw error;
  }
};

/**
 * Get AI code completion
 */
export const getAICodeCompletion = async (
  code: string,
  cursorPosition: { line: number; column: number },
  context?: {
    filePath?: string;
    language?: string;
    projectType?: "frontend" | "backend";
  },
): Promise<string> => {
  try {
    const ai = getGeminiAI();
    if (!ai) {
      throw new Error(
        "Gemini AI not initialized. Please set GEMINI_API_KEY in environment variables.",
      );
    }

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const language = context?.language || "typescript";
    const filePath = context?.filePath || "unknown";

    const prompt = `You are a code completion assistant. Based on the following ${language} code, provide a code completion suggestion for the cursor position (line ${cursorPosition.line}, column ${cursorPosition.column}).

Code:
\`\`\`${language}
${code}
\`\`\`

Provide only the completion text that should be inserted at the cursor position. Do not include the existing code, only the completion.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("[CodeEditor] Error getting AI completion:", error);
    throw error;
  }
};
