/**
 * Google Sheets Practical Tasks Service
 * Handles practical task CRUD operations with support for chunked text
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
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

const PRACTICAL_TASK_HEADERS = ["No", "Question", "Answer", "Image"];

/**
 * Ensure practical task headers exist for a technology sheet
 */
const ensurePracticalTaskHeaders = async (
  technologyName: string,
  accessToken: string | null = null,
): Promise<void> => {
  await ensureSheetHeaders(
    SPREADSHEET_IDS.PRACTICAL_TASKS,
    technologyName,
    PRACTICAL_TASK_HEADERS,
    `${technologyName}!A1:D1`,
    accessToken,
  );
};

/**
 * Get all practical tasks from UserDetail sheet
 * Note: This reads from a specific "UserDetail" sheet in the PRACTICAL_TASKS spreadsheet
 */
export const getPracticalTasks = async (
  accessToken: string | null = null,
): Promise<PracticalTask[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: "UserDetail!A2:E1000",
    });

    const rows = response?.data?.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `pt-${index}`,
      no: row[0]?.toString() || "",
      question: row[1] || "",
      answer: row[2] || "",
      image: row[3] || "",
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
  accessToken: string | null = null,
  page?: number,
  limit?: number,
): Promise<PracticalTask[] | PaginatedResponse<PracticalTask>> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: `${technologyName}!A2:Z1000`,
    });

    const rows = response?.data?.values || [];
    const allTasks = rows.map((row: any[], index: number) => {
      // Handle chunked data - process in groups of 3 columns
      let question = "";
      let answer = "";
      let image = "";

      for (let i = 1; i < row.length; i += 3) {
        if (row[i]) question += row[i];
        if (row[i + 1]) answer += row[i + 1];
        if (row[i + 2]) image += row[i + 2];
      }

      return {
        id: `pt-${index}`,
        no: row[0]?.toString() || (index + 1).toString(),
        question,
        answer,
        image: image || row[3] || "",
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
  taskData: { question: string; answer: string; image?: string },
): any[] => {
  const questionChunks = splitTextIntoChunks(taskData.question || "");
  const answerChunks = splitTextIntoChunks(taskData.answer || "");
  const imageChunks = splitTextIntoChunks(taskData.image || "");

  const rowData: any[] = [serialNumber];

  const maxChunks = Math.max(
    questionChunks.length,
    answerChunks.length,
    imageChunks.length,
  );

  for (let i = 0; i < maxChunks; i++) {
    rowData.push(questionChunks[i] || "");
    rowData.push(answerChunks[i] || "");
    rowData.push(imageChunks[i] || "");
  }

  return rowData;
};

/**
 * Add a practical task
 */
export const addPracticalTask = async (
  technologyName: string,
  taskData: { question: string; answer: string; image?: string },
): Promise<boolean> => {
  try {
    await ensurePracticalTaskHeaders(technologyName);

    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: `${technologyName}!A:A`,
    });
    const rowCount = (response?.data?.values?.length || 1) + 1;

    const rowData = buildPracticalTaskRowData(rowCount - 1, taskData);
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${rowCount}:${endColumn}${rowCount}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
 * Update a practical task
 */
export const updatePracticalTask = async (
  technologyName: string,
  rowIndex: number,
  taskData: { question: string; answer: string; image?: string },
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2;

    const rowData = buildPracticalTaskRowData(rowIndex + 1, taskData);
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${actualRow}:${endColumn}${actualRow}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const actualRow = rowIndex + 2;

    // Get the sheet ID for the technology (using cached metadata)
    const sheets = await getSpreadsheetMetadata(
      SPREADSHEET_IDS.PRACTICAL_TASKS,
      accessToken,
    );
    const sheet = sheets.find(
      (s: any) => s.properties.title === technologyName,
    );
    if (!sheet) {
      return false;
    }
    const sheetId = sheet.properties.sheetId;

    // Delete the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
      accessToken,
    );
    const tasksArray = Array.isArray(updatedTasks)
      ? updatedTasks
      : updatedTasks.data;

    await updateSerialNumbers(
      SPREADSHEET_IDS.PRACTICAL_TASKS,
      technologyName,
      tasksArray.length,
    );

    // Clear cache after modification
    clearSpreadsheetMetadataCache(SPREADSHEET_IDS.PRACTICAL_TASKS);

    return true;
  } catch (error) {
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
): Promise<boolean> => {
  try {
    if (oldIndex === newIndex) {
      return true;
    }

    const sheetsClient = getSheetsClient();
    // Get the sheet ID for the technology (using cached metadata)
    const sheets = await getSpreadsheetMetadata(
      SPREADSHEET_IDS.PRACTICAL_TASKS,
    );
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
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
    const updatedTasks = await getPracticalTasksByTechnology(technologyName);
    const tasksArray = Array.isArray(updatedTasks)
      ? updatedTasks
      : updatedTasks.data;

    await updateSerialNumbers(
      SPREADSHEET_IDS.PRACTICAL_TASKS,
      technologyName,
      tasksArray.length,
    );

    // Clear cache after modification
    clearSpreadsheetMetadataCache(SPREADSHEET_IDS.PRACTICAL_TASKS);

    return true;
  } catch (error) {
    return false;
  }
};
