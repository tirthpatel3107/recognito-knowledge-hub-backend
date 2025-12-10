/**
 * Google Sheets Notes Service
 * Handles notes CRUD operations
 */
import {
  getSheetsClient,
  ensureSheetHeaders,
  getSpreadsheetMetadata,
  getColumnLetter,
} from "./utils";
import { getUserNotesSpreadsheetId } from "./userProfile";

const TABS_SHEET_NAME = "Tabs";
const ALL_NOTES_SHEET_NAME = "All Notes";
const TABS_HEADERS = ["ID", "Tab Name", "Pinned"];
const ALL_NOTES_HEADERS = ["ID", "Title", "Description1", "Description2", "Description3", "Starred"];

export interface NotesTab {
  id: string;
  name: string;
  sheetId?: number;
  pinned?: boolean;
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
  starred?: boolean;
}

/**
 * Ensure Tabs sheet exists and has correct headers
 */
const ensureTabsSheet = async (
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<void> => {
  try {
    await ensureSheetHeaders(
      spreadsheetId,
      TABS_SHEET_NAME,
      TABS_HEADERS,
      `${TABS_SHEET_NAME}!A1:C1`,
      accessToken,
    );
  } catch (error) {
    // Error ensuring Tabs sheet
    throw error;
  }
};

/**
 * Ensure All Notes sheet exists and has correct headers
 */
const ensureAllNotesSheet = async (
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<void> => {
  try {
    await ensureSheetHeaders(
      spreadsheetId,
      ALL_NOTES_SHEET_NAME,
      ALL_NOTES_HEADERS,
      `${ALL_NOTES_SHEET_NAME}!A1:F1`,
      accessToken,
    );
  } catch (error) {
    // Error ensuring All Notes sheet
    throw error;
  }
};

/**
 * Get all tabs from "Tabs" sheet
 */
export const getTabsFromSheet = async (
  email: string | null = null,
  accessToken: string | null = null,
): Promise<NotesTab[]> => {
  try {
    const spreadsheetId = await getUserNotesSpreadsheetId(email, accessToken);

    await ensureTabsSheet(spreadsheetId, accessToken);

    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${TABS_SHEET_NAME}!A2:C1000`,
    });

    const rows = response?.data?.values || [];
    const tabs: NotesTab[] = [];

    // Get sheet metadata to find sheetIds
    const sheets = await getSpreadsheetMetadata(spreadsheetId, accessToken);

    rows.forEach((row: string[], index: number) => {
      if (row.length >= 2) {
        const tabId = row[0]?.toString().trim() || "";
        const tabName = row[1]?.toString().trim() || "";
        const pinned = row[2]?.toString().trim().toLowerCase() === "true" || row[2]?.toString().trim() === "1";

        if (tabId && tabName) {
          // Find sheetId for this tab
          const sheet = sheets.find(
            (s: any) => s.properties?.title?.toLowerCase() === tabName.toLowerCase(),
          );

          tabs.push({
            id: tabId,
            name: tabName,
            sheetId: sheet?.properties?.sheetId,
            pinned: pinned,
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
export const getAllNotesFromSheet = async (
  email: string | null = null,
  accessToken: string | null = null,
): Promise<Note[]> => {
  try {
    const spreadsheetId = await getUserNotesSpreadsheetId(email, accessToken);

    await ensureAllNotesSheet(spreadsheetId, accessToken);

    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${ALL_NOTES_SHEET_NAME}!A1:F1000`,
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
      const starred = row[5]?.toString().trim().toLowerCase() === "true" || row[5]?.toString().trim() === "1";

      if (id && title) {
        notes.push({
          id: `note-${i}`,
          tabId: id, // The ID column represents the tab ID
          title: title,
          description: description,
          description2: description2,
          description3: description3,
          starred: starred,
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
export const getNotesByTab = async (
  tabName: string,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<Note[]> => {
  try {
    const spreadsheetId = await getUserNotesSpreadsheetId(email, accessToken);

    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
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
export const getTabHeadings = async (
  tabName: string,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<string[]> => {
  try {
    const spreadsheetId = await getUserNotesSpreadsheetId(email, accessToken);

    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );

    const headingsResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<Record<string, Note[]>> => {
  try {
    const spreadsheetId = await getUserNotesSpreadsheetId(email, accessToken);

    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );

    // Get row 1 to find all columns with headings
    const headingsResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
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
    const notes = await getNotesByTab(tabName, email, accessToken);
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

/**
 * Update a note in "All Notes" sheet
 */
export const updateNoteInAllNotes = async (
  rowIndex: number,
  noteData: {
    title: string;
    description: string;
    description2?: string;
    description3?: string;
    starred?: boolean;
  },
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserNotesSpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(accessToken, null, spreadsheetId);
    
    // rowIndex is 0-based (row 2 = index 0), so actual row = rowIndex + 2
    const actualRow = rowIndex + 2;
    
    // Update columns B (Title), C (Description1), D (Description2), E (Description3), F (Starred)
    const starredValue = noteData.starred !== undefined ? noteData.starred : false;
    const values = [[
      noteData.title || "",
      noteData.description || "",
      noteData.description2 || "",
      noteData.description3 || "",
      starredValue ? "true" : "false",
    ]];

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `All Notes!B${actualRow}:F${actualRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: values,
      },
    });
    
    return true;
  } catch (error) {
    console.error("Error updating note in All Notes:", error);
    return false;
  }
};

