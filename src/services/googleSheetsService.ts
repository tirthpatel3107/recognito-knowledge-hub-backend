/**
 * Google Sheets Service
 * Handles all interactions with Google Sheets API
 */
import { google } from 'googleapis';
import { GOOGLE_CONFIG, SPREADSHEET_IDS } from '../config/googleConfig';
import { getGoogleToken } from './googleTokenStore';
import type {
  Technology,
  Question,
  QuestionInput,
  PracticalTask,
  Project,
  ProjectInput,
  WorkSummaryEntry,
  WorkSummaryEntryInput,
  UserProfile,
  ColorPalette,
} from '../types/googleSheets';

// Global OAuth2 client instance
import type { OAuth2Client } from 'google-auth-library';
let oauth2Client: OAuth2Client | null = null;
let currentAccessToken: string | null = null;

/**
 * Get login spreadsheet ID with fallback to environment variable
 */
const getLoginSpreadsheetId = (): string => {
  const id = SPREADSHEET_IDS.LOGIN || process.env.LOGIN_SPREADSHEET_ID;
  if (!id || id.trim() === '') {
    throw new Error('LOGIN_SPREADSHEET_ID is not configured. Set it in the .env file.');
  }
  return id;
};

/**
 * Initialize Google Sheets service
 */
export const initializeGoogleSheets = (): void => {
  if (!GOOGLE_CONFIG.CLIENT_ID || !GOOGLE_CONFIG.CLIENT_SECRET) {
    console.warn('Google Sheets service not fully initialized - missing OAuth credentials');
    return;
  }

  oauth2Client = new google.auth.OAuth2(
    GOOGLE_CONFIG.CLIENT_ID,
    GOOGLE_CONFIG.CLIENT_SECRET,
    GOOGLE_CONFIG.REDIRECT_URI
  );
};

/**
 * Set user credentials for API calls
 */
export const setUserCredentials = (accessToken: string): void => {
  currentAccessToken = accessToken;
  if (oauth2Client) {
    oauth2Client.setCredentials({ access_token: accessToken });
  }
};

/**
 * Get Google Sheets client
 */
const getSheetsClient = (accessToken: string | null = null): any => {
  const token = accessToken || currentAccessToken;
  
  if (token && oauth2Client) {
    oauth2Client.setCredentials({ access_token: token });
    return google.sheets({ version: 'v4', auth: oauth2Client });
  }

  if (!GOOGLE_CONFIG.API_KEY) {
    throw new Error('Google API key is not configured for read-only access');
  }

  return google.sheets({ version: 'v4', auth: GOOGLE_CONFIG.API_KEY });
};

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (
  email: string,
  password: string,
  accessToken: string
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:B100',
    });

    const rows = response.data.values || [];
    for (const row of rows) {
      if (row.length >= 2 && row[0]?.toLowerCase() === email.toLowerCase() && row[1] === password) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Authentication error:', error);
    return false;
  }
};

/**
 * Update user photo from Google
 */
export const updateUserPhotoFromGoogle = async (
  email: string,
  photoUrl: string,
  accessToken: string
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:D100',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0]?.toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 2; // +2 because range starts at row 2 and arrays are 0-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      console.warn(`User ${email} not found in login spreadsheet`);
      return false;
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!D${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[photoUrl]],
      },
    });

    return true;
  } catch (error: any) {
    console.error('Error updating user photo:', error);
    if (error.message && error.message.includes('LOGIN_SPREADSHEET_ID is not configured')) {
      console.error('LOGIN_SPREADSHEET_ID is not configured. Set it in the .env file.');
    } else if (error.code === 404) {
      console.error('Spreadsheet not found. Check LOGIN_SPREADSHEET_ID configuration.');
    }
    return false;
  }
};

// ==================== Technologies ====================

/**
 * Get all technologies
 */
export const getTechnologies = async (accessToken: string | null = null): Promise<Technology[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
    });

    const sheets = response.data.sheets || [];
    return sheets.map((sheet: any, index: number) => ({
      id: `tech-${sheet.properties.sheetId}`,
      name: sheet.properties.title,
      sheetId: sheet.properties.sheetId,
    }));
  } catch (error) {
    console.error('Error getting technologies:', error);
    return [];
  }
};

/**
 * Create a new technology (sheet)
 */
export const createTechnology = async (name: string): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: name,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error creating technology:', error);
    return false;
  }
};

/**
 * Update technology name
 */
export const updateTechnology = async (
  oldName: string,
  newName: string,
  sheetId: number
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                title: newName,
              },
              fields: 'title',
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error updating technology:', error);
    return false;
  }
};

/**
 * Delete technology (sheet)
 */
export const deleteTechnology = async (sheetId: number): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId,
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error deleting technology:', error);
    return false;
  }
};

/**
 * Reorder technologies
 */
export const reorderTechnologies = async (technologyIds: number[]): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const requests = technologyIds.map((sheetId, index) => ({
      updateSheetProperties: {
        properties: {
          sheetId,
          index,
        },
        fields: 'index',
      },
    }));

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: { requests },
    });
    return true;
  } catch (error) {
    console.error('Error reordering technologies:', error);
    return false;
  }
};

// ==================== Questions ====================

/**
 * Get questions for a technology
 */
export const getQuestions = async (
  technologyName: string,
  accessToken: string | null = null
): Promise<Question[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A2:E1000`,
    });

    const rows = response.data.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `q-${index}`,
      question: row[1] || '',
      answer: row[2] || '',
      imageUrls: row[3] ? row[3].split(',').map((url: string) => url.trim()) : [],
    }));
  } catch (error) {
    console.error('Error getting questions:', error);
    return [];
  }
};

/**
 * Add a question
 */
export const addQuestion = async (
  technologyName: string,
  questionData: QuestionInput
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const imageUrls = questionData.imageUrls?.join(',') || '';
    
    // Get current row count
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A:A`,
    });
    const rowCount = (response.data.values?.length || 1) + 1;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A${rowCount}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          rowCount - 1,
          questionData.question,
          questionData.answer,
          imageUrls,
          questionData.imageUrls?.[0] || '',
        ]],
      },
    });
    return true;
  } catch (error) {
    console.error('Error adding question:', error);
    return false;
  }
};

/**
 * Update a question
 */
export const updateQuestion = async (
  technologyName: string,
  rowIndex: number,
  questionData: QuestionInput
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const imageUrls = questionData.imageUrls?.join(',') || '';
    const actualRow = rowIndex + 2; // +2 for header and 0-indexing

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A${actualRow}:E${actualRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          rowIndex + 1,
          questionData.question,
          questionData.answer,
          imageUrls,
          questionData.imageUrls?.[0] || '',
        ]],
      },
    });
    return true;
  } catch (error) {
    console.error('Error updating question:', error);
    return false;
  }
};

/**
 * Delete a question
 */
export const deleteQuestion = async (
  technologyName: string,
  rowIndex: number,
  sheetId: number
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2; // +2 for header and 0-indexing

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: actualRow - 1,
                endIndex: actualRow,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error deleting question:', error);
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
  sheetId: number
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualOldRow = oldIndex + 2;
    const actualNewRow = newIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId,
                dimension: 'ROWS',
                startIndex: actualOldRow - 1,
                endIndex: actualOldRow,
              },
              destinationIndex: actualNewRow - 1,
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error reordering questions:', error);
    return false;
  }
};

// ==================== Projects ====================

/**
 * Get all projects
 */
export const getProjects = async (accessToken: string | null = null): Promise<Project[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      range: 'Project List!A2:C1000',
    });

    const rows = response.data.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `project-${index}`,
      no: row[0]?.toString() || '',
      project: row[1] || '',
      projectId: row[2] || '',
    }));
  } catch (error) {
    console.error('Error getting projects:', error);
    return [];
  }
};

/**
 * Add a project
 */
export const addProject = async (projectData: ProjectInput): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      range: 'Project List!A:A',
    });
    const rowCount = (response.data.values?.length || 1) + 1;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      range: `Project List!A${rowCount}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[rowCount - 1, projectData.project, projectData.projectId]],
      },
    });
    return true;
  } catch (error) {
    console.error('Error adding project:', error);
    return false;
  }
};

/**
 * Update a project
 */
export const updateProject = async (
  rowIndex: number,
  projectData: ProjectInput
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      range: `Project List!A${actualRow}:C${actualRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[rowIndex + 1, projectData.project, projectData.projectId]],
      },
    });
    return true;
  } catch (error) {
    console.error('Error updating project:', error);
    return false;
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (rowIndex: number, sheetId: number): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: actualRow - 1,
                endIndex: actualRow,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
};

/**
 * Reorder projects
 */
export const reorderProjects = async (
  oldIndex: number,
  newIndex: number,
  sheetId: number
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualOldRow = oldIndex + 2;
    const actualNewRow = newIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId,
                dimension: 'ROWS',
                startIndex: actualOldRow - 1,
                endIndex: actualOldRow,
              },
              destinationIndex: actualNewRow - 1,
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error reordering projects:', error);
    return false;
  }
};

// ==================== Work Summary ====================

/**
 * Get all month sheets
 */
export const getWorkSummaryMonthSheets = async (
  accessToken: string | null = null
): Promise<string[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });

    const sheets = response.data.sheets || [];
    return sheets.map((sheet: any) => sheet.properties.title);
  } catch (error) {
    console.error('Error getting month sheets:', error);
    return [];
  }
};

/**
 * Get work summary entries for a month
 */
export const getWorkSummaryEntriesByMonth = async (
  monthSheet: string,
  accessToken: string | null = null
): Promise<WorkSummaryEntry[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A2:E1000`,
    });

    const rows = response.data.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `ws-${index}`,
      no: row[0]?.toString() || '',
      projectName: row[1] || '',
      workSummary: row[2] || '',
      date: row[3] || '',
    }));
  } catch (error) {
    console.error('Error getting work summary entries:', error);
    return [];
  }
};

/**
 * Create a new month sheet
 */
export const createWorkSummaryMonthSheet = async (monthName: string): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: monthName,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error creating month sheet:', error);
    return false;
  }
};

/**
 * Add a work summary entry
 */
export const addWorkSummaryEntry = async (
  monthSheet: string,
  entryData: WorkSummaryEntryInput
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A:A`,
    });
    const rowCount = (response.data.values?.length || 1) + 1;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A${rowCount}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[rowCount - 1, entryData.projectName, entryData.workSummary, entryData.date]],
      },
    });
    return true;
  } catch (error) {
    console.error('Error adding work summary entry:', error);
    return false;
  }
};

/**
 * Update a work summary entry
 */
export const updateWorkSummaryEntry = async (
  monthSheet: string,
  rowIndex: number,
  entryData: WorkSummaryEntryInput
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A${actualRow}:D${actualRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[rowIndex + 1, entryData.projectName, entryData.workSummary, entryData.date]],
      },
    });
    return true;
  } catch (error) {
    console.error('Error updating work summary entry:', error);
    return false;
  }
};

/**
 * Delete a work summary entry
 */
export const deleteWorkSummaryEntry = async (
  monthSheet: string,
  rowIndex: number,
  sheetId: number
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: actualRow - 1,
                endIndex: actualRow,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error('Error deleting work summary entry:', error);
    return false;
  }
};

/**
 * Get month name from date
 */
export const getMonthNameFromDate = (dateString: string): string | null => {
  try {
    const date = new Date(dateString);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

// ==================== Practical Tasks ====================

/**
 * Get all practical tasks
 */
export const getPracticalTasks = async (
  accessToken: string | null = null
): Promise<PracticalTask[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: 'UserDetail!A2:E1000',
    });

    const rows = response.data.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `pt-${index}`,
      no: row[0]?.toString() || '',
      question: row[1] || '',
      answer: row[2] || '',
      image: row[3] || '',
    }));
  } catch (error) {
    console.error('Error getting practical tasks:', error);
    return [];
  }
};

// ==================== User Profile ====================

/**
 * Get dashboard card order
 */
export const getDashboardCardOrder = async (
  email: string,
  accessToken: string | null = null
): Promise<string[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    // This would typically be stored in a user preferences sheet
    // For now, return default order
    return ['question-bank', 'todo', 'credential', 'work-summary', 'practical-task'];
  } catch (error) {
    console.error('Error getting dashboard card order:', error);
    return [];
  }
};

/**
 * Save dashboard card order
 */
export const saveDashboardCardOrder = async (
  email: string,
  cardOrder: string[]
): Promise<boolean> => {
  try {
    // This would typically save to a user preferences sheet
    // For now, just return true
    return true;
  } catch (error) {
    console.error('Error saving dashboard card order:', error);
    return false;
  }
};

/**
 * Get user mode
 */
export const getUserMode = async (
  email: string,
  accessToken: string | null = null
): Promise<string | null> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:E100',
    });

    const rows = response.data.values || [];
    for (const row of rows) {
      if (row[0]?.toLowerCase() === email.toLowerCase()) {
        return row[4] || 'Light'; // Assuming mode is in column E
      }
    }
    return 'Light';
  } catch (error) {
    console.error('Error getting user mode:', error);
    return 'Light';
  }
};

/**
 * Update user mode
 */
export const updateUserMode = async (email: string, mode: string): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:E100',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0]?.toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) {
      return false;
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!E${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[mode]],
      },
    });
    return true;
  } catch (error) {
    console.error('Error updating user mode:', error);
    return false;
  }
};

/**
 * Get user profile
 */
export const getUserProfile = async (
  email: string,
  accessToken: string | null = null
): Promise<UserProfile | null> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:D100',
    });

    const rows = response.data.values || [];
    for (const row of rows) {
      if (row[0]?.toLowerCase() === email.toLowerCase()) {
        return {
          email: row[0] || '',
          password: '', // Don't return password
          username: row[2] || '',
          photo: row[3] || '',
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  email: string,
  username?: string,
  photo?: string | null
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:D100',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0]?.toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) {
      return false;
    }

    const updates: any[] = [];
    if (username !== undefined) {
      updates.push({
        range: `UserDetail!C${rowIndex}`,
        values: [[username]],
      });
    }
    if (photo !== undefined) {
      updates.push({
        range: `UserDetail!D${rowIndex}`,
        values: [[photo || '']],
      });
    }

    if (updates.length > 0) {
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId: loginSpreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return false;
  }
};

/**
 * Update user password
 */
export const updateUserPassword = async (
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:B100',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0]?.toLowerCase() === email.toLowerCase()) {
        if (rows[i][1] !== currentPassword) {
          throw new Error('Current password is incorrect');
        }
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) {
      return false;
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[newPassword]],
      },
    });
    return true;
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
};

/**
 * Get user color palette
 */
export const getUserColorPalette = async (
  email: string,
  accessToken: string | null = null
): Promise<ColorPalette> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:G100',
    });

    const rows = response.data.values || [];
    for (const row of rows) {
      if (row[0]?.toLowerCase() === email.toLowerCase()) {
        // Convert empty strings to null
        const lightColor = row[5] && row[5].trim() !== '' ? row[5] : null;
        const darkColor = row[6] && row[6].trim() !== '' ? row[6] : null;
        return {
          lightModeColor: lightColor,
          darkModeColor: darkColor,
        };
      }
    }
    return {
      lightModeColor: null,
      darkModeColor: null,
    };
  } catch (error) {
    console.error('Error getting color palette:', error);
    return {
      lightModeColor: null,
      darkModeColor: null,
    };
  }
};

/**
 * Update user color palette
 */
export const updateUserColorPalette = async (
  email: string,
  lightModeColor: string | null,
  darkModeColor: string | null,
  accessToken: string
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:G100',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0]?.toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 2; // +2 because sheets are 1-indexed and we start from row 2
        break;
      }
    }

    if (rowIndex === -1) {
      console.error('User not found in UserDetail sheet');
      return false;
    }

    // Update columns F (lightModeColor) and G (darkModeColor)
    // Convert null to empty string for Google Sheets (empty string will be read back as null)
    const lightColorValue = lightModeColor === null ? '' : (lightModeColor || '');
    const darkColorValue = darkModeColor === null ? '' : (darkModeColor || '');
    
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: loginSpreadsheetId,
      range: `UserDetail!F${rowIndex}:G${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[lightColorValue, darkColorValue]],
      },
    });

    return true;
  } catch (error) {
    console.error('Error updating color palette:', error);
    return false;
  }
};

