/**
 * Google Sheets Notes Service
 * Handles notes CRUD operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import {
  getSheetsClient,
  ensureSheetHeaders,
  getSpreadsheetMetadata,
  getColumnLetter,
} from "./utils";

const TABS_SHEET_NAME = "Tabs";
const ALL_NOTES_SHEET_NAME = "All Notes";
const TABS_HEADERS = ["ID", "Tab Name"];
const ALL_NOTES_HEADERS = ["ID", "Title", "Description1", "Description2", "Description3"];

export interface NotesTab {
  id: string;
  name: string;
  sheetId?: number;
}

export interface Note {
  id: string;
  columnIndex: number;
  columnLetter: string;
  heading: string;
  content: string;
  imageUrls?: string[];
  rowIndex: number;
  tabId?: string;
  title?: string;
  description?: string;
  description2?: string;
  description3?: string;
}

/**
 * Ensure Tabs sheet exists and has correct headers
 */
const ensureTabsSheet = async (): Promise<void> => {
  try {
    if (!SPREADSHEET_IDS.NOTES || SPREADSHEET_IDS.NOTES.trim() === "") {
      throw new Error("NOTES_SPREADSHEET_ID is not configured");
    }

    await ensureSheetHeaders(
      SPREADSHEET_IDS.NOTES,
      TABS_SHEET_NAME,
      TABS_HEADERS,
      `${TABS_SHEET_NAME}!A1:B1`,
      null,
    );
  } catch (error) {
    // Error ensuring Tabs sheet
    throw error;
  }
};

/**
 * Ensure All Notes sheet exists and has correct headers
 */
const ensureAllNotesSheet = async (): Promise<void> => {
  try {
    if (!SPREADSHEET_IDS.NOTES || SPREADSHEET_IDS.NOTES.trim() === "") {
      throw new Error("NOTES_SPREADSHEET_ID is not configured");
    }

    await ensureSheetHeaders(
      SPREADSHEET_IDS.NOTES,
      ALL_NOTES_SHEET_NAME,
      ALL_NOTES_HEADERS,
      `${ALL_NOTES_SHEET_NAME}!A1:E1`,
      null,
    );
  } catch (error) {
    // Error ensuring All Notes sheet
    throw error;
  }
};

/**
 * Get all tabs from "Tabs" sheet
 */
export const getTabsFromSheet = async (): Promise<NotesTab[]> => {
  try {
    if (!SPREADSHEET_IDS.NOTES || SPREADSHEET_IDS.NOTES.trim() === "") {
      throw new Error("NOTES_SPREADSHEET_ID is not configured");
    }

    await ensureTabsSheet();

    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.NOTES,
    );

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.NOTES,
      range: `${TABS_SHEET_NAME}!A2:B1000`,
    });

    const rows = response?.data?.values || [];
    const tabs: NotesTab[] = [];

    // Get sheet metadata to find sheetIds
    const sheets = await getSpreadsheetMetadata(SPREADSHEET_IDS.NOTES, null);

    rows.forEach((row: string[], index: number) => {
      if (row.length >= 2) {
        const tabId = row[0]?.toString().trim() || "";
        const tabName = row[1]?.toString().trim() || "";

        if (tabId && tabName) {
          // Find sheetId for this tab
          const sheet = sheets.find(
            (s: any) => s.properties?.title?.toLowerCase() === tabName.toLowerCase(),
          );

          tabs.push({
            id: tabId,
            name: tabName,
            sheetId: sheet?.properties?.sheetId,
          });
        }
      }
    });

    return tabs;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all notes from "All Notes" sheet
 */
export const getAllNotesFromSheet = async (): Promise<Note[]> => {
  try {
    if (!SPREADSHEET_IDS.NOTES || SPREADSHEET_IDS.NOTES.trim() === "") {
      throw new Error("NOTES_SPREADSHEET_ID is not configured");
    }

    await ensureAllNotesSheet();

    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.NOTES,
    );

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.NOTES,
      range: `${ALL_NOTES_SHEET_NAME}!A1:E1000`,
    });

    const rows = response?.data?.values || [];
    if (rows.length < 2) {
      return []; // No data rows
    }

    // Skip row 1 (headers), process from row 2
    const notes: Note[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const id = row[0]?.toString().trim() || "";
      const title = row[1]?.toString().trim() || "";
      const description = row[2]?.toString().trim() || "";
      const description2 = row[3]?.toString().trim() || "";
      const description3 = row[4]?.toString().trim() || "";

      if (id && title) {
        notes.push({
          id: `note-${i}`,
          tabId: id, // The ID column represents the tab ID
          title: title,
          description: description,
          description2: description2,
          description3: description3,
          columnIndex: 0,
          columnLetter: "A",
          heading: title,
          content: description,
          rowIndex: i - 1, // 0-based index (row 2 = index 0)
        });
      }
    }

    return notes;
  } catch (error) {
    throw error;
  }
};

/**
 * Get notes for a specific tab
 */
export const getNotesByTab = async (tabName: string): Promise<Note[]> => {
  try {
    if (!SPREADSHEET_IDS.NOTES || SPREADSHEET_IDS.NOTES.trim() === "") {
      throw new Error("NOTES_SPREADSHEET_ID is not configured");
    }

    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.NOTES,
    );

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.NOTES,
      range: `${tabName}!A1:Z1000`,
    });

    const rows = response?.data?.values || [];
    if (rows.length === 0) {
      return [];
    }

    // First row contains headings
    const headings = rows[0] || [];
    const notes: Note[] = [];

    // Process each column
    for (let colIndex = 0; colIndex < headings.length; colIndex++) {
      const heading = headings[colIndex] || "";
      const columnLetter = getColumnLetter(colIndex);

      // Process rows starting from row 2 (index 1)
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex] || [];
        const content = row[colIndex] || "";

        // Only create note if there's content
        if (content.trim()) {
          // Parse images from content if they're embedded
          let noteContent = content;
          let imageUrls: string[] = [];

          const imageStartMarker = "|||IMAGE_START|||";
          const imageEndMarker = "|||IMAGE_END|||";

          if (
            content.includes(imageStartMarker) &&
            content.includes(imageEndMarker)
          ) {
            const startIndex = content.indexOf(imageStartMarker);
            const endIndex = content.indexOf(imageEndMarker);
            noteContent = content.substring(0, startIndex).trim();
            const imageSection = content.substring(
              startIndex + imageStartMarker.length,
              endIndex,
            );
            imageUrls = imageSection.split("|||").filter(Boolean);
          }

          notes.push({
            id: `${colIndex}-${rowIndex}`,
            columnIndex: colIndex,
            columnLetter: columnLetter,
            heading: heading,
            content: noteContent,
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
            rowIndex: rowIndex - 1, // Convert to 0-based index (row 2 = index 0)
          });
        }
      }
    }

    return notes;
  } catch (error) {
    throw error;
  }
};

/**
 * Get headings for a specific tab
 */
export const getTabHeadings = async (tabName: string): Promise<string[]> => {
  try {
    if (!SPREADSHEET_IDS.NOTES || SPREADSHEET_IDS.NOTES.trim() === "") {
      throw new Error("NOTES_SPREADSHEET_ID is not configured");
    }

    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.NOTES,
    );

    const headingsResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.NOTES,
      range: `${tabName}!A1:Z1`,
    });

    return headingsResponse?.data?.values?.[0] || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get notes organized by column for a specific tab
 */
export const getNotesByColumn = async (
  tabName: string,
): Promise<Record<string, Note[]>> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.NOTES,
    );

    // Get row 1 to find all columns with headings
    const headingsResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.NOTES,
      range: `${tabName}!A1:Z1`,
    });

    const headings = headingsResponse?.data?.values?.[0] || [];
    const notesByColumn: Record<string, Note[]> = {};

    // Initialize all columns with headings (even if they have no notes)
    headings.forEach((heading: string, index: number) => {
      if (heading && heading.trim()) {
        const columnLetter = getColumnLetter(index);
        notesByColumn[columnLetter] = [];
      }
    });

    // Add notes to their respective columns
    const notes = await getNotesByTab(tabName);
    notes.forEach((note) => {
      if (!notesByColumn[note.columnLetter]) {
        notesByColumn[note.columnLetter] = [];
      }
      notesByColumn[note.columnLetter].push(note);
    });

    return notesByColumn;
  } catch (error) {
    throw error;
  }
};

