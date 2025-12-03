/**
 * Google Sheets Kanban Board Service
 * Handles kanban board task CRUD operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import {
  getSheetsClient,
  ensureSheetHeaders,
  findSheetByName,
} from "./utils";

const KANBAN_SHEET_NAME = "Board";
const KANBAN_HEADERS = [
  "ID",
  "Title",
  "Description",
  "CreatedDate",
  "ColumnId",
  "Tags",
  "Priority",
];

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  createdDate: string;
  columnId: "todo" | "in-progress" | "done" | "close";
  tags?: string[];
  priority?: "low" | "medium" | "high";
}

export interface KanbanTaskInput {
  title: string;
  description?: string;
  columnId: "todo" | "in-progress" | "done" | "close";
  tags?: string[];
  priority?: "low" | "medium" | "high";
}

/**
 * Ensure kanban board sheet exists and has correct headers
 */
const ensureKanbanSheet = async (): Promise<void> => {
  try {
    if (!SPREADSHEET_IDS.KANBAN_BOARD || SPREADSHEET_IDS.KANBAN_BOARD.trim() === "") {
      throw new Error("KANBAN_BOARD_SPREADSHEET_ID is not configured");
    }

    await ensureSheetHeaders(
      SPREADSHEET_IDS.KANBAN_BOARD,
      KANBAN_SHEET_NAME,
      KANBAN_HEADERS,
      `${KANBAN_SHEET_NAME}!A1:G1`,
      null,
    );
  } catch (error) {
    // Error ensuring kanban sheet
    throw error;
  }
};

/**
 * Get all kanban tasks grouped by column
 */
export const getKanbanTasks = async (): Promise<Record<string, KanbanTask[]>> => {
  try {
    if (!SPREADSHEET_IDS.KANBAN_BOARD || SPREADSHEET_IDS.KANBAN_BOARD.trim() === "") {
      throw new Error("KANBAN_BOARD_SPREADSHEET_ID is not configured");
    }

    await ensureKanbanSheet();

    // Find the actual sheet name (handles case variations)
    const sheetInfo = await findSheetByName(
      SPREADSHEET_IDS.KANBAN_BOARD,
      KANBAN_SHEET_NAME,
      null,
    );
    const actualSheetName = sheetInfo.sheetName || KANBAN_SHEET_NAME;

    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.KANBAN_BOARD,
    );

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.KANBAN_BOARD,
      range: `${actualSheetName}!A2:G1000`,
    });

    const rows = response?.data?.values || [];
    const tasksByColumn: Record<string, KanbanTask[]> = {
      todo: [],
      "in-progress": [],
      done: [],
      close: [],
    };

    rows.forEach((row: string[]) => {
      if (row.length >= 4) {
        // Parse tags from column F (index 5) - comma-separated string
        const tagsString = row[5] || "";
        const taskTags = tagsString
          ? tagsString
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t)
          : undefined;

        // Parse priority from column G (index 6)
        const priority = row[6] as "low" | "medium" | "high" | undefined;
        const validPriority =
          priority && ["low", "medium", "high"].includes(priority)
            ? priority
            : "low";

        const task: KanbanTask = {
          id: row[0] || "",
          title: row[1] || "",
          description: row[2] || "",
          createdDate: row[3] || new Date().toISOString(),
          columnId: (row[4] as any) || "todo",
          tags: taskTags,
          priority: validPriority,
        };

        const columnId = task.columnId || "todo";
        if (tasksByColumn[columnId]) {
          tasksByColumn[columnId].push(task);
        }
      }
    });

    return tasksByColumn;
  } catch (error) {
    throw error;
  }
};

/**
 * Save all kanban tasks
 */
export const saveKanbanTasks = async (
  tasks: KanbanTask[],
): Promise<boolean> => {
  try {
    if (!SPREADSHEET_IDS.KANBAN_BOARD || SPREADSHEET_IDS.KANBAN_BOARD.trim() === "") {
      throw new Error("KANBAN_BOARD_SPREADSHEET_ID is not configured");
    }

    await ensureKanbanSheet();

    // Find the actual sheet name (handles case variations)
    const sheetInfo = await findSheetByName(
      SPREADSHEET_IDS.KANBAN_BOARD,
      KANBAN_SHEET_NAME,
      null,
    );
    const actualSheetName = sheetInfo.sheetName || KANBAN_SHEET_NAME;

    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.KANBAN_BOARD,
    );

    // Prepare data for Google Sheets
    const values = tasks.map((task) => [
      task.id,
      task.title,
      task.description || "",
      task.createdDate,
      task.columnId,
      task.tags && task.tags.length > 0 ? task.tags.join(",") : "",
      task.priority || "low",
    ]);

    // Clear existing data (except headers)
    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_IDS.KANBAN_BOARD,
      range: `${actualSheetName}!A2:G1000`,
    });

    // Write new data
    if (values.length > 0) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_IDS.KANBAN_BOARD,
        range: `${actualSheetName}!A2`,
        valueInputOption: "RAW",
        requestBody: {
          values,
        },
      });
    }

    return true;
  } catch (error) {
    throw error;
  }
};

