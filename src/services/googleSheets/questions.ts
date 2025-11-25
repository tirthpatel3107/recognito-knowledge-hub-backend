/**
 * Google Sheets Questions Service
 * Handles question CRUD operations with support for chunked text
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import type { Question, QuestionInput } from "../../types/googleSheets";
import {
  getSheetsClient,
  splitTextIntoChunks,
  getColumnLetter,
  ensureSheetHeaders,
  updateSerialNumbers,
  getSpreadsheetMetadata,
  clearSpreadsheetMetadataCache,
} from "./utils";

const QUESTION_BANK_HEADERS = ["No", "Question", "Answer", "Image"];

/**
 * Paginated response type
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Parse image URLs from string (handles both ||| and comma delimiters)
 */
const parseImageUrls = (imageUrlsString: string): string[] => {
  if (!imageUrlsString) return [];

  // Try new format first (||| delimiter)
  if (imageUrlsString.includes("|||")) {
    return imageUrlsString
      .split("|||")
      .map((url: string) => url.trim())
      .filter(Boolean);
  }

  // Old format: comma delimiter
  const commaSplit = imageUrlsString.split(",");
  if (
    commaSplit.length === 2 &&
    commaSplit[0].includes("base64") &&
    !commaSplit[1].includes("data:")
  ) {
    // Single base64 image that was incorrectly split
    return [commaSplit.join(",")];
  }

  // Multiple images - reconstruct intelligently
  const reconstructed: string[] = [];
  let current = "";
  for (let i = 0; i < commaSplit.length; i++) {
    const part = commaSplit[i].trim();
    if (!part) continue;

    if (
      part.startsWith("data:") ||
      part.startsWith("http://") ||
      part.startsWith("https://")
    ) {
      if (current) {
        reconstructed.push(current);
      }
      current = part;
    } else if (current) {
      current += "," + part;
    }
  }
  if (current) {
    reconstructed.push(current);
  }

  return reconstructed.length > 0 ? reconstructed : commaSplit.filter(Boolean);
};

/**
 * Extract priority from question text and return clean question with priority
 */
const extractPriority = (questionText: string): { question: string; priority: "low" | "medium" | "high" } => {
  const priorityRegex = /\|PRIORITY:(low|medium|high)\|$/;
  const match = questionText.match(priorityRegex);
  
  if (match) {
    const priority = match[1] as "low" | "medium" | "high";
    const cleanQuestion = questionText.replace(priorityRegex, "").trim();
    return { question: cleanQuestion, priority };
  }
  
  return { question: questionText, priority: "low" };
};

/**
 * Append priority metadata to question text
 */
const appendPriority = (questionText: string, priority: "low" | "medium" | "high" = "low"): string => {
  // Remove existing priority if any
  const cleanQuestion = questionText.replace(/\|PRIORITY:(low|medium|high)\|$/, "").trim();
  return `${cleanQuestion}|PRIORITY:${priority}|`;
};

/**
 * Ensure Question Bank sheet has correct headers
 */
const ensureQuestionBankHeaders = async (
  technologyName: string,
  accessToken: string | null = null,
): Promise<void> => {
  await ensureSheetHeaders(
    SPREADSHEET_IDS.QUESTION_BANK,
    technologyName,
    QUESTION_BANK_HEADERS,
    `${technologyName}!A1:D1`,
    accessToken,
  );
};

/**
 * Get questions for a technology
 * Handles text that may be split across multiple columns
 */
export const getQuestions = async (
  technologyName: string,
  accessToken: string | null = null,
  page?: number,
  limit?: number,
): Promise<Question[] | PaginatedResponse<Question>> => {
  await ensureQuestionBankHeaders(technologyName, accessToken);

  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A2:Z1000`,
    });

    const rows = response?.data?.values || [];
    const allQuestions = rows.map((row: any[], index: number) => {
      // Reconstruct question, answer, imageUrls from multiple columns
      // Each group is 4 columns: [Q, A, Images, FirstImage]
      let question = "";
      let answer = "";
      let imageUrlsString = "";

      // Process in groups of 4 columns starting from index 1 (after Serial number)
      for (let i = 1; i < row.length; i += 4) {
        if (row[i]) question += row[i];
        if (row[i + 1]) answer += row[i + 1];
        if (row[i + 2]) imageUrlsString += row[i + 2];
      }

      const imageUrls = parseImageUrls(imageUrlsString);
      const { question: cleanQuestion, priority } = extractPriority(question);

      return {
        id: `q-${index}`,
        question: cleanQuestion,
        answer,
        imageUrls,
        priority,
      };
    });

    // If pagination parameters are provided, return paginated response
    if (page !== undefined && limit !== undefined) {
      const total = allQuestions.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = allQuestions.slice(startIndex, endIndex);

      return {
        data: paginatedData,
        total,
        page,
        limit,
        totalPages,
      };
    }

    return allQuestions;
  } catch (error) {
    if (page !== undefined && limit !== undefined) {
      return {
        data: [],
        total: 0,
        page: page || 1,
        limit: limit || 100,
        totalPages: 0,
      };
    }
    return [];
  }
};

/**
 * Build row data for question with chunking support
 */
const buildQuestionRowData = (
  serialNumber: number,
  questionData: QuestionInput,
): any[] => {
  // Append priority to question text for storage
  const questionWithPriority = appendPriority(
    questionData.question || "",
    questionData.priority || "low"
  );
  const questionChunks = splitTextIntoChunks(questionWithPriority);
  const answerChunks = splitTextIntoChunks(questionData.answer || "");
  const imageUrlsString = questionData.imageUrls?.join("|||") || "";
  const imageUrlsChunks = splitTextIntoChunks(imageUrlsString);
  const firstImage = questionData.imageUrls?.[0] || "";
  const firstImageChunks = splitTextIntoChunks(firstImage);

  const rowData: any[] = [serialNumber];

  const maxChunks = Math.max(
    questionChunks.length,
    answerChunks.length,
    imageUrlsChunks.length,
    firstImageChunks.length,
  );

  for (let i = 0; i < maxChunks; i++) {
    rowData.push(questionChunks[i] || "");
    rowData.push(answerChunks[i] || "");
    rowData.push(imageUrlsChunks[i] || "");
    rowData.push(firstImageChunks[i] || "");
  }

  return rowData;
};

/**
 * Add a question
 */
export const addQuestion = async (
  technologyName: string,
  questionData: QuestionInput,
): Promise<boolean> => {
  try {
    await ensureQuestionBankHeaders(technologyName);

    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A:A`,
    });
    const rowCount = (response?.data?.values?.length || 1) + 1;

    const rowData = buildQuestionRowData(rowCount - 1, questionData);
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${rowCount}:${endColumn}${rowCount}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowData],
      },
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Update a question
 */
export const updateQuestion = async (
  technologyName: string,
  rowIndex: number,
  questionData: QuestionInput,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2;

    // Read current row to see how many columns are used
    const currentRowResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A${actualRow}:ZZ${actualRow}`,
    });
    const currentRow = currentRowResponse.data.values?.[0] || [];
    const maxCurrentCol = currentRow.length;

    const rowData = buildQuestionRowData(rowIndex + 1, questionData);
    const endColumnIndex = Math.max(maxCurrentCol, rowData.length);
    const endColumn = getColumnLetter(endColumnIndex - 1);
    const range = `${technologyName}!A${actualRow}:${endColumn}${actualRow}`;

    // If we're writing fewer columns than exist, extend rowData with empty strings
    if (rowData.length < maxCurrentCol) {
      while (rowData.length < maxCurrentCol) {
        rowData.push("");
      }
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowData],
      },
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Delete a question
 */
export const deleteQuestion = async (
  technologyName: string,
  rowIndex: number,
  sheetId: number,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const actualRow = rowIndex + 2;

    // Delete the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: actualRow - 1,
                endIndex: actualRow,
              },
            },
          },
        ],
      },
    });

    // Update serial numbers
    const updatedQuestions = await getQuestions(technologyName, accessToken);
    const questionsArray = Array.isArray(updatedQuestions)
      ? updatedQuestions
      : updatedQuestions.data;

    await updateSerialNumbers(
      SPREADSHEET_IDS.QUESTION_BANK,
      technologyName,
      questionsArray.length,
    );

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Reorder questions
 */
export const reorderQuestions = async (
  technologyName: string,
  oldIndex: number,
  newIndex: number,
  sheetId: number,
): Promise<boolean> => {
  try {
    if (oldIndex === newIndex) {
      return true;
    }

    const sheetsClient = getSheetsClient();
    const oldRowNumber = oldIndex + 1;
    const newRowNumber = newIndex + 1;

    // Move the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId,
                dimension: "ROWS",
                startIndex: oldRowNumber,
                endIndex: oldRowNumber + 1,
              },
              destinationIndex:
                newRowNumber > oldRowNumber ? newRowNumber + 1 : newRowNumber,
            },
          },
        ],
      },
    });

    // Update serial numbers
    const updatedQuestions = await getQuestions(technologyName);
    const questionsArray = Array.isArray(updatedQuestions)
      ? updatedQuestions
      : updatedQuestions.data;

    await updateSerialNumbers(
      SPREADSHEET_IDS.QUESTION_BANK,
      technologyName,
      questionsArray.length,
    );

    return true;
  } catch (error) {
    return false;
  }
};
