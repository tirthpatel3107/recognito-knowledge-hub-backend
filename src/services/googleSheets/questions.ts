/**
 * Google Sheets Questions Service
 * Handles question CRUD operations with support for chunked text
 */
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
import { getUserQuestionBankSpreadsheetId } from "./userProfile";

const QUESTION_BANK_HEADERS = ["No", "Question", "Answer", "Example"];

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
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<void> => {
  await ensureSheetHeaders(
    spreadsheetId,
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
  email: string | null = null,
): Promise<Question[] | PaginatedResponse<Question>> => {
  const spreadsheetId = await getUserQuestionBankSpreadsheetId(email, accessToken);
  await ensureQuestionBankHeaders(technologyName, spreadsheetId, accessToken);

  try {
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${technologyName}!A2:Z1000`,
    });

    const rows = response?.data?.values || [];
    const allQuestions = rows.map((row: any[], index: number) => {
      // Reconstruct question, answer, example from multiple columns
      // Each group is 4 columns: [Q, A, Example]
      let question = "";
      let answer = "";
      let example = "";

      // Process in groups of 4 columns starting from index 1 (after Serial number)
      for (let i = 1; i < row.length; i += 4) {
        if (row[i]) question += row[i];
        if (row[i + 1]) answer += row[i + 1];
        if (row[i + 2]) example += row[i + 2];
      }

      const { question: cleanQuestion, priority } = extractPriority(question);

      return {
        id: `q-${index}`,
        question: cleanQuestion,
        answer,
        example: example || undefined,
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
  const exampleChunks = splitTextIntoChunks(questionData.example || "");

  const rowData: any[] = [serialNumber];

  const maxChunks = Math.max(
    questionChunks.length,
    answerChunks.length,
    exampleChunks.length,
  );

  for (let i = 0; i < maxChunks; i++) {
    rowData.push(questionChunks[i] || "");
    rowData.push(answerChunks[i] || "");
    rowData.push(exampleChunks[i] || "");
  }

  return rowData;
};

/**
 * Add a question
 */
export const addQuestion = async (
  technologyName: string,
  questionData: QuestionInput,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserQuestionBankSpreadsheetId(email, accessToken);
    await ensureQuestionBankHeaders(technologyName, spreadsheetId, accessToken);

    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${technologyName}!A:A`,
    });
    const rowCount = (response?.data?.values?.length || 1) + 1;

    const rowData = buildQuestionRowData(rowCount - 1, questionData);
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${rowCount}:${endColumn}${rowCount}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserQuestionBankSpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const actualRow = rowIndex + 2;

    // Read current row to see how many columns are used
    const currentRowResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
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
      spreadsheetId,
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
  email: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserQuestionBankSpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const actualRow = rowIndex + 2;

    // Delete the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
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
    const updatedQuestions = await getQuestions(technologyName, accessToken, undefined, undefined, email);
    const questionsArray = Array.isArray(updatedQuestions)
      ? updatedQuestions
      : updatedQuestions.data;

    await updateSerialNumbers(
      spreadsheetId,
      technologyName,
      questionsArray.length,
      2,
      accessToken,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    if (oldIndex === newIndex) {
      return true;
    }

    const spreadsheetId = await getUserQuestionBankSpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    const oldRowNumber = oldIndex + 1;
    const newRowNumber = newIndex + 1;

    // Move the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
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
    const updatedQuestions = await getQuestions(technologyName, accessToken, undefined, undefined, email);
    const questionsArray = Array.isArray(updatedQuestions)
      ? updatedQuestions
      : updatedQuestions.data;

    await updateSerialNumbers(
      spreadsheetId,
      technologyName,
      questionsArray.length,
      2,
      accessToken,
    );

    return true;
  } catch (error) {
    return false;
  }
};
