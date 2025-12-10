/**
 * Google Sheets Practical Tasks Service
 * Handles practical task CRUD operations with support for chunked text
 */
import type { PracticalTask } from "../../types/googleSheets";
import {
  getSheetsClient,
  splitTextIntoChunks,
  getColumnLetter,
  ensureSheetHeaders,
  updateSerialNumbers,
  getSpreadsheetMetadata,
  clearSpreadsheetMetadataCache,
} from "./utils";
import type { PaginatedResponse } from "./questions";
import { getUserPracticalTasksSpreadsheetId } from "./userProfile";

const PRACTICAL_TASK_HEADERS = ["No", "Question", "Answer", "Example"];

/**
 * Ensure practical task headers exist for a technology sheet
 * Creates the sheet if it doesn't exist
 */
const ensurePracticalTaskHeaders = async (
  technologyName: string,
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<void> => {
  try {
    // Check if the sheet exists
    const sheets = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const sheetExists = sheets.some(
      (sheet: any) =>
        sheet.properties?.title?.toLowerCase() === technologyName.toLowerCase(),
    );

    // If sheet doesn't exist, create it
    if (!sheetExists) {
      const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: technologyName,
                },
              },
            },
          ],
        },
      });
      // Clear cache after creating new sheet
      clearSpreadsheetMetadataCache(spreadsheetId);
    }

    // Ensure headers exist
    await ensureSheetHeaders(
      spreadsheetId,
      technologyName,
      PRACTICAL_TASK_HEADERS,
      `${technologyName}!A1:D1`,
      accessToken,
    );
  } catch (error) {
    console.error("Error ensuring practical task headers:", error);
    throw error;
  }
};

/**
 * Get all practical tasks from UserDetail sheet
 * Note: This reads from a specific "UserDetail" sheet in the PRACTICAL_TASKS spreadsheet
 */
export const getPracticalTasks = async (
  email: string | null = null,
  accessToken: string | null = null,
): Promise<PracticalTask[]> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: "UserDetail!A2:E1000",
    });

    const rows = response?.data?.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `pt-${index}`,
      no: row[0]?.toString() || "",
      question: row[1] || "",
      answer: row[2] || "",
      example: row[3] || "",
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Get practical tasks by technology
 */
export const getPracticalTasksByTechnology = async (
  technologyName: string,
  email: string | null = null,
  accessToken: string | null = null,
  page?: number,
  limit?: number,
): Promise<PracticalTask[] | PaginatedResponse<PracticalTask>> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${technologyName}!A2:Z1000`,
    });

    const rows = response?.data?.values || [];
    const allTasks = rows.map((row: any[], index: number) => {
      // Handle chunked data - process in groups of 3 columns (Question, Answer, Example)
      let question = "";
      let answer = "";
      let example = "";

      for (let i = 1; i < row.length; i += 3) {
        if (row[i]) question += row[i];
        if (row[i + 1]) answer += row[i + 1];
        if (row[i + 2]) example += row[i + 2];
      }

      // Extract priority from question text if present
      const priorityRegex = /\|PRIORITY:(low|medium|high)\|$/;
      const priorityMatch = question.match(priorityRegex);
      const priority = priorityMatch
        ? (priorityMatch[1] as "low" | "medium" | "high")
        : "low";
      const cleanQuestion = priorityMatch
        ? question.replace(priorityRegex, "").trim()
        : question;

      return {
        id: `pt-${index}`,
        no: row[0]?.toString() || (index + 1).toString(),
        question: cleanQuestion,
        answer,
        example: example || row[3] || "",
        priority,
      };
    });

    // If pagination parameters are provided, return paginated response
    if (page !== undefined && limit !== undefined) {
      const total = allTasks.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = allTasks.slice(startIndex, endIndex);

      return {
        data: paginatedData,
        total,
        page,
        limit,
        totalPages,
      };
    }

    return allTasks;
  } catch (error: any) {
    if (error?.message?.includes("Unable to parse range")) {
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
 * Build row data for practical task with chunking support
 */
const buildPracticalTaskRowData = (
  serialNumber: number,
  taskData: {
    question: string;
    answer: string;
    example?: string;
    priority?: "low" | "medium" | "high";
  },
): any[] => {
  // Append priority to question if provided
  const questionWithPriority =
    taskData.priority && taskData.priority !== "low"
      ? `${taskData.question || ""}|PRIORITY:${taskData.priority}|`
      : taskData.question || "";

  const questionChunks = splitTextIntoChunks(questionWithPriority);
  const answerChunks = splitTextIntoChunks(taskData.answer || "");
  const exampleChunks = splitTextIntoChunks(taskData.example || "");

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
 * Add a practical task
 */
export const addPracticalTask = async (
  technologyName: string,
  taskData: {
    question: string;
    answer: string;
    example?: string;
    priority?: "low" | "medium" | "high";
  },
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    await ensurePracticalTaskHeaders(
      technologyName,
      spreadsheetId,
      accessToken,
    );

    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${technologyName}!A:A`,
    });
    const rowCount = (response?.data?.values?.length || 1) + 1;

    const rowData = buildPracticalTaskRowData(rowCount - 1, taskData);
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${rowCount}:${endColumn}${rowCount}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowData],
      },
    });
    return true;
  } catch (error) {
    console.error("Error adding practical task:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to add practical task: ${errorMessage}`);
  }
};

/**
 * Update a practical task
 */
export const updatePracticalTask = async (
  technologyName: string,
  rowIndex: number,
  taskData: {
    question: string;
    answer: string;
    example?: string;
    priority?: "low" | "medium" | "high";
  },
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken);
    const actualRow = rowIndex + 2;

    const rowData = buildPracticalTaskRowData(rowIndex + 1, taskData);
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${actualRow}:${endColumn}${actualRow}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
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
 * Delete a practical task
 */
export const deletePracticalTask = async (
  technologyName: string,
  rowIndex: number,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    if (!spreadsheetId) {
      console.error("Failed to get spreadsheet ID for practical tasks");
      return false;
    }

    const sheetsClient = getSheetsClient(accessToken);
    const actualRow = rowIndex + 2;

    // Get the sheet ID for the technology (using cached metadata)
    const sheets = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const sheet = sheets.find(
      (s: any) => s.properties.title === technologyName,
    );
    if (!sheet) {
      console.error(`Sheet not found for technology: ${technologyName}`);
      return false;
    }
    const sheetId = sheet.properties.sheetId;

    // Validate that the row exists before trying to delete
    const existingTasks = await getPracticalTasksByTechnology(
      technologyName,
      email,
      accessToken,
    );
    const tasksArray = Array.isArray(existingTasks)
      ? existingTasks
      : existingTasks.data;

    if (rowIndex < 0 || rowIndex >= tasksArray.length) {
      console.error(
        `Invalid row index: ${rowIndex}. Total tasks: ${tasksArray.length}`,
      );
      return false;
    }

    // Delete the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
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
    const updatedTasks = await getPracticalTasksByTechnology(
      technologyName,
      email,
      accessToken,
    );
    const tasksArrayAfterDelete = Array.isArray(updatedTasks)
      ? updatedTasks
      : updatedTasks.data;

    await updateSerialNumbers(
      spreadsheetId,
      technologyName,
      tasksArrayAfterDelete.length,
      2,
      accessToken,
    );

    // Clear cache after modification
    clearSpreadsheetMetadataCache(spreadsheetId);

    return true;
  } catch (error) {
    console.error("Error deleting practical task:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return false;
  }
};

/**
 * Reorder practical tasks
 */
export const reorderPracticalTasks = async (
  technologyName: string,
  oldIndex: number,
  newIndex: number,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    if (oldIndex === newIndex) {
      return true;
    }

    const spreadsheetId = await getUserPracticalTasksSpreadsheetId(
      email,
      accessToken,
    );
    const sheetsClient = getSheetsClient(accessToken);
    // Get the sheet ID for the technology (using cached metadata)
    const sheets = await getSpreadsheetMetadata(spreadsheetId, accessToken);
    const sheet = sheets.find(
      (s: any) => s.properties.title === technologyName,
    );
    if (!sheet) {
      return false;
    }
    const sheetId = sheet.properties.sheetId;

    const oldRowNumber = oldIndex + 1;
    const newRowNumber = newIndex + 1;

    // Move the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
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
    const updatedTasks = await getPracticalTasksByTechnology(
      technologyName,
      email,
      accessToken,
    );
    const tasksArray = Array.isArray(updatedTasks)
      ? updatedTasks
      : updatedTasks.data;

    await updateSerialNumbers(
      spreadsheetId,
      technologyName,
      tasksArray.length,
      2,
      accessToken,
    );

    // Clear cache after modification
    clearSpreadsheetMetadataCache(spreadsheetId);

    return true;
  } catch (error) {
    return false;
  }
};
