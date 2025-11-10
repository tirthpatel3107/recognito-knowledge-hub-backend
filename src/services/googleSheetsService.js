/**
 * Google Sheets Service
 * Handles all Google Sheets API operations
 */
import { google } from 'googleapis';
import {
  GOOGLE_CONFIG,
  SPREADSHEET_IDS,
} from '../config/googleConfig.js';

// Helper function to get LOGIN spreadsheet ID
// Always check process.env first (set in .env file), then fall back to config
const getLoginSpreadsheetId = () => {
  return process.env.LOGIN_SPREADSHEET_ID || SPREADSHEET_IDS.LOGIN || '';
};

// Initialize Google Sheets API
let sheets;
let oauth2Client;

export const initializeGoogleSheets = () => {
  // For read-only operations using API key
  sheets = google.sheets({
    version: 'v4',
    auth: GOOGLE_CONFIG.API_KEY,
  });
};

export const initializeOAuth2Client = () => {
  oauth2Client = new google.auth.OAuth2(
    GOOGLE_CONFIG.CLIENT_ID,
    GOOGLE_CONFIG.CLIENT_SECRET,
    GOOGLE_CONFIG.REDIRECT_URI
  );

  oauth2Client.setCredentials({
    scope: GOOGLE_CONFIG.SCOPES.join(' '),
  });

  return oauth2Client;
};

export const setUserCredentials = (accessToken) => {
  if (!oauth2Client) {
    initializeOAuth2Client();
  }
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  // Create authenticated sheets client
  sheets = google.sheets({
    version: 'v4',
    auth: oauth2Client,
  });
};

// Initialize on module load
initializeGoogleSheets();

// Helper function to fetch from Google Sheets with OAuth support
const fetchFromSheets = async (spreadsheetId, range, accessToken = null) => {
  if (accessToken) {
    // Use fetch API directly with the access token (OAuth authentication)
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch from sheet: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } else {
    // Fall back to googleapis library with API key (may fail for private sheets)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data;
  }
};

// Helper function to get spreadsheet metadata with OAuth support
const getSpreadsheetMetadata = async (spreadsheetId, accessToken = null) => {
  if (accessToken) {
    // Use fetch API directly with the access token (OAuth authentication)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch spreadsheet metadata: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } else {
    // Fall back to googleapis library with API key (may fail for private sheets)
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    return response.data;
  }
};

// Authentication
export const authenticateUser = async (email, password, accessToken = null) => {
  try {
    // Get Login spreadsheet ID (from .env file)
    const loginSpreadsheetId = getLoginSpreadsheetId();
    
    if (!loginSpreadsheetId || loginSpreadsheetId.trim() === '') {
      const errorMsg = 'LOGIN_SPREADSHEET_ID is not configured. ' +
        'Please ensure the .env file exists in the backend root directory with LOGIN_SPREADSHEET_ID set, ' +
        'and restart the server completely.';
      console.error('[authenticateUser] ERROR:', errorMsg);
      throw new Error(errorMsg);
    }

    // Use fetch API if access token is provided (doesn't require CLIENT_ID/CLIENT_SECRET)
    // Otherwise use the googleapis library with API key
    let rows = [];
    
    // Use "UserDetail" sheet name (renamed from "Sheet1")
    const sheetRange = 'UserDetail!A2:B100';
    console.log(`[authenticateUser] Using sheet range: ${sheetRange}`);
    
    if (accessToken) {
      // Use fetch API directly with the access token
      const range = encodeURIComponent(sheetRange);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${loginSpreadsheetId}/values/${range}`;
      console.log(`[authenticateUser] Fetching from URL: ${url.replace(loginSpreadsheetId, 'SPREADSHEET_ID')}`);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[authenticateUser] Google Sheets API error:', errorText);
        console.error(`[authenticateUser] Requested range: ${sheetRange}`);
        console.error(`[authenticateUser] Spreadsheet ID: ${loginSpreadsheetId.substring(0, 20)}...`);
        throw new Error(`Failed to fetch login data: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      rows = data.values || [];
      console.log(`[authenticateUser] Successfully fetched ${rows.length} rows from ${sheetRange}`);
    } else {
      // Use googleapis library with API key (for read-only access)
      console.log(`[authenticateUser] Using googleapis library with range: ${sheetRange}`);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: loginSpreadsheetId,
        range: sheetRange,
      });
      rows = response.data.values || [];
      console.log(`[authenticateUser] Successfully fetched ${rows.length} rows from ${sheetRange}`);
    }

    for (const row of rows) {
      if (
        row.length >= 2 &&
        row[0].toLowerCase() === email.toLowerCase() &&
        row[1] === password
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Authentication error:', error);
    // Provide more helpful error message for API key issues
    if (error.code === 403 && !accessToken) {
      const helpfulError = new Error(
        'API key access denied. Please check Google Cloud Console API key restrictions: ' +
        'Application restrictions should be set to "None" or "IP addresses" for server-side usage. ' +
        'Or make the spreadsheet publicly viewable.'
      );
      helpfulError.originalError = error;
      throw helpfulError;
    }
    throw error;
  }
};

// Get all technologies (sheets)
export const getTechnologies = async (accessToken = null) => {
  try {
    const data = await getSpreadsheetMetadata(SPREADSHEET_IDS.QUESTION_BANK, accessToken);
    const sheetList = data.sheets || [];

    // Filter out the first sheet (credentials)
    return sheetList.slice(1).map((sheet, index) => ({
      id: (index + 1).toString(),
      name: sheet.properties.title,
      sheetId: sheet.properties.sheetId,
    }));
  } catch (error) {
    console.error('Error fetching technologies:', error);
    throw error;
  }
};

// Create technology (sheet)
export const createTechnology = async (name) => {
  try {
    const response = await sheets.spreadsheets.batchUpdate({
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

    // Add headers to the new sheet
    const headerValues = [['No', 'Question', 'Answer', 'Image']];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${name}!A1:D1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: headerValues,
      },
    });

    return true;
  } catch (error) {
    console.error('Error creating technology:', error);
    throw error;
  }
};

// Update technology name (rename sheet)
export const updateTechnology = async (oldName, newName, sheetId) => {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
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
    throw error;
  }
};

// Delete technology (sheet)
export const deleteTechnology = async (sheetId) => {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId: sheetId,
            },
          },
        ],
      },
    });

    return true;
  } catch (error) {
    console.error('Error deleting technology:', error);
    throw error;
  }
};

// Reorder technologies
export const reorderTechnologies = async (technologyIds) => {
  try {
    const technologies = await getTechnologies();
    const requests = technologyIds.map((sheetId, newIndex) => {
      return {
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            index: newIndex + 1, // +1 to skip credentials sheet
          },
          fields: 'index',
        },
      };
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: requests,
      },
    });

    return true;
  } catch (error) {
    console.error('Error reordering technologies:', error);
    throw error;
  }
};

// Get questions for a technology
export const getQuestions = async (technologyName, accessToken = null) => {
  try {
    const data = await fetchFromSheets(
      SPREADSHEET_IDS.QUESTION_BANK,
      `${technologyName}!A2:D1000`,
      accessToken
    );

    const rows = data.values || [];

    return rows.map((row, index) => {
      const imageUrls = row[3] ? row[3].split('||').filter(Boolean) : undefined;

      return {
        id: (index + 1).toString(),
        question: row[1] || '',
        answer: row[2] || '',
        imageUrls,
      };
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    throw error;
  }
};

// Add question
export const addQuestion = async (technologyName, question) => {
  try {
    // Get current questions to determine next row number
    const questions = await getQuestions(technologyName);
    const rowNumber = questions.length + 2; // +2 for header and 1-based index

    const imageString = question.imageUrls
      ? question.imageUrls.join('||')
      : '';

    const values = [
      [
        rowNumber - 1, // Serial number
        question.question,
        question.answer,
        imageString,
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: values,
      },
    });

    return true;
  } catch (error) {
    console.error('Error adding question:', error);
    throw error;
  }
};

// Update question
export const updateQuestion = async (
  technologyName,
  rowIndex,
  question
) => {
  try {
    const rowNumber = rowIndex + 2; // +2 for header and 1-based index
    const imageString = question.imageUrls
      ? question.imageUrls.join('||')
      : '';

    const values = [
      [
        rowIndex + 1, // Serial number
        question.question,
        question.answer,
        imageString,
      ],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A${rowNumber}:D${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: values,
      },
    });

    return true;
  } catch (error) {
    console.error('Error updating question:', error);
    throw error;
  }
};

// Delete question
export const deleteQuestion = async (technologyName, rowIndex, sheetId) => {
  try {
    const rowNumber = rowIndex + 2; // +2 for header and 1-based index

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      },
    });

    return true;
  } catch (error) {
    console.error('Error deleting question:', error);
    throw error;
  }
};

// Reorder questions
export const reorderQuestions = async (
  technologyName,
  oldIndex,
  newIndex,
  sheetId
) => {
  try {
    const oldRowNumber = oldIndex + 1; // +1 to account for header
    const newRowNumber = newIndex + 1; // +1 to account for header

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: oldRowNumber,
                endIndex: oldRowNumber + 1,
              },
              destinationIndex: newRowNumber,
            },
          },
        ],
      },
    });

    // Update serial numbers
    const updatedQuestions = await getQuestions(technologyName);
    const updates = updatedQuestions.map((q, index) => ({
      range: `${technologyName}!A${index + 2}`,
      values: [[index + 1]],
    }));

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error reordering questions:', error);
    throw error;
  }
};

// Get practical tasks
export const getPracticalTasks = async (accessToken = null) => {
  try {
    const data = await fetchFromSheets(
      SPREADSHEET_IDS.PRACTICAL_TASKS,
      'Sheet1!A2:E1000',
      accessToken
    );

    const rows = data.values || [];

    return rows.map((row, index) => ({
      id: (index + 1).toString(),
      no: row[0] || '',
      question: row[1] || '',
      answer: row[2] || '',
      image: row[3] || undefined,
    }));
  } catch (error) {
    console.error('Error fetching practical tasks:', error);
    throw error;
  }
};

// Project Management Functions

// Get all projects
export const getProjects = async (accessToken = null) => {
  try {
    const data = await fetchFromSheets(
      SPREADSHEET_IDS.PROJECT_LISTING,
      'Project List!A2:C1000',
      accessToken
    );

    const rows = data.values || [];

    return rows.map((row, index) => ({
      id: (index + 1).toString(),
      no: row[0] || '',
      project: row[1] || '',
      projectId: row[2] || '',
    }));
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

// Add project
export const addProject = async (project) => {
  try {
    const projects = await getProjects();
    const rowNumber = projects.length + 2;

    const values = [[rowNumber - 1, project.project, project.projectId]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      range: `Project List!A${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: values,
      },
    });

    return true;
  } catch (error) {
    console.error('Error adding project:', error);
    throw error;
  }
};

// Update project
export const updateProject = async (rowIndex, project) => {
  try {
    const rowNumber = rowIndex + 2;

    const values = [
      [rowIndex + 1, project.project, project.projectId],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      range: `Project List!A${rowNumber}:C${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: values,
      },
    });

    return true;
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
};

// Delete project
export const deleteProject = async (rowIndex, sheetId) => {
  try {
    const rowNumber = rowIndex + 2;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      },
    });

    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
};

// Reorder projects
export const reorderProjects = async (oldIndex, newIndex, sheetId) => {
  try {
    const oldRowNumber = oldIndex + 1;
    const newRowNumber = newIndex + 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: oldRowNumber,
                endIndex: oldRowNumber + 1,
              },
              destinationIndex: newRowNumber,
            },
          },
        ],
      },
    });

    // Update serial numbers
    const updatedProjects = await getProjects();
    const updates = updatedProjects.map((p, index) => ({
      range: `Project List!A${index + 2}`,
      values: [[index + 1]],
    }));

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error reordering projects:', error);
    throw error;
  }
};

// Work Summary Functions

// Get all month sheets
export const getWorkSummaryMonthSheets = async (accessToken = null) => {
  try {
    const data = await getSpreadsheetMetadata(SPREADSHEET_IDS.WORK_SUMMARY, accessToken);
    const sheetsList = data.sheets || [];
    return sheetsList
      .map((sheet) => sheet.properties.title)
      .filter((title) => title !== 'Sheet1' && title !== 'Project List');
  } catch (error) {
    console.error('Error fetching work summary month sheets:', error);
    throw error;
  }
};

// Get work summary entries by month
export const getWorkSummaryEntriesByMonth = async (monthSheet, accessToken = null) => {
  try {
    const data = await fetchFromSheets(
      SPREADSHEET_IDS.WORK_SUMMARY,
      `${monthSheet}!A2:E1000`,
      accessToken
    );

    const rows = data.values || [];

    return rows.map((row, index) => ({
      id: (index + 1).toString(),
      no: row[0] || '',
      projectName: row[1] || '',
      workSummary: row[2] || '',
      date: row[3] || '',
    }));
  } catch (error) {
    console.error(
      `Error fetching work summary entries from ${monthSheet}:`,
      error
    );
    throw error;
  }
};

// Create month sheet
export const createWorkSummaryMonthSheet = async (monthName) => {
  try {
    await sheets.spreadsheets.batchUpdate({
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

    const headerValues = [['No', 'ProjectName', 'WorkSummary', 'Date']];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthName}!A1:D1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: headerValues,
      },
    });

    return true;
  } catch (error) {
    console.error('Error creating month sheet:', error);
    throw error;
  }
};

// Add work summary entry
export const addWorkSummaryEntry = async (monthSheet, entry) => {
  try {
    const entries = await getWorkSummaryEntriesByMonth(monthSheet);
    const rowNumber = entries.length + 2;

    const values = [
      [
        rowNumber - 1,
        entry.projectName,
        entry.workSummary,
        entry.date,
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: values,
      },
    });

    return true;
  } catch (error) {
    console.error('Error adding work summary entry:', error);
    throw error;
  }
};

// Update work summary entry
export const updateWorkSummaryEntry = async (
  monthSheet,
  rowIndex,
  entry
) => {
  try {
    const rowNumber = rowIndex + 2;

    const values = [
      [
        rowIndex + 1,
        entry.projectName,
        entry.workSummary,
        entry.date,
      ],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A${rowNumber}:D${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: values,
      },
    });

    return true;
  } catch (error) {
    console.error('Error updating work summary entry:', error);
    throw error;
  }
};

// Delete work summary entry
export const deleteWorkSummaryEntry = async (monthSheet, rowIndex, sheetId) => {
  try {
    const rowNumber = rowIndex + 2;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      },
    });

    return true;
  } catch (error) {
    console.error('Error deleting work summary entry:', error);
    throw error;
  }
};

// Helper function to get month name from date
export const getMonthNameFromDate = (dateString) => {
  try {
    const date = new Date(dateString);
    const monthNames = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${month} ${year}`;
  } catch (error) {
    console.error('Error parsing date:', error);
    return '';
  }
};

// Dashboard card order functions
export const getDashboardCardOrder = async (email, accessToken = null) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    const data = await fetchFromSheets(
      loginSpreadsheetId,
      'DashboardOrder!A:Z',
      accessToken
    );

    const rows = data.values || [];

    for (const row of rows) {
      if (row.length > 0 && row[0].toLowerCase() === email.toLowerCase()) {
        return row.slice(1).filter(Boolean);
      }
    }

    return [];
  } catch (error) {
    console.error('Error fetching dashboard card order:', error);
    throw error;
  }
};

export const saveDashboardCardOrder = async (email, cardOrder) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'DashboardOrder!A:Z',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && rows[i][0].toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }

    const values = [[email, ...cardOrder]];

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: loginSpreadsheetId,
        range: `DashboardOrder!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: loginSpreadsheetId,
        range: 'DashboardOrder!A:Z',
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error saving dashboard card order:', error);
    throw error;
  }
};

// User mode functions
// Helper function to ensure Mode sheet exists
const ensureModeSheetExists = async (sheetsClient) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    // Try to get the spreadsheet to check if Mode sheet exists
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: loginSpreadsheetId,
    });

    const sheetsList = spreadsheet.data.sheets || [];
    const modeSheet = sheetsList.find(
      (sheet) => sheet.properties.title === 'Mode'
    );

    if (!modeSheet) {
      // Create the Mode sheet
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: loginSpreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Mode',
                },
              },
            },
          ],
        },
      });

      // Add headers to the new sheet
      const headerValues = [['Email', 'Mode']];
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: loginSpreadsheetId,
        range: 'Mode!A1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          values: headerValues,
        },
      });

      console.log('Mode sheet created successfully');
    }
  } catch (error) {
    // If error is about sheet already existing, that's fine
    if (error.message && error.message.includes('already exists')) {
      console.log('Mode sheet already exists');
    } else {
      console.error('Error ensuring Mode sheet exists:', error);
      throw error;
    }
  }
};

export const getUserMode = async (email, accessToken = null) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    // Ensure Mode sheet exists before trying to read from it
    // Note: ensureModeSheetExists uses the sheets client, which may need OAuth
    // For now, we'll try to read first and handle errors
    let data;
    try {
      data = await fetchFromSheets(
        loginSpreadsheetId,
        'Mode!A2:B',
        accessToken
      );
    } catch (error) {
      // If sheet doesn't exist, try to create it (requires OAuth)
      if (accessToken) {
        await ensureModeSheetExists(sheets);
        data = await fetchFromSheets(
          loginSpreadsheetId,
          'Mode!A2:B',
          accessToken
        );
      } else {
        throw error;
      }
    }

    const rows = data.values || [];

    for (const row of rows) {
      if (row.length >= 2 && row[0].toLowerCase() === email.toLowerCase()) {
        return row[1] || 'Light';
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching user mode:', error);
    throw error;
  }
};

export const updateUserMode = async (email, mode) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    // Ensure Mode sheet exists before trying to write to it
    await ensureModeSheetExists(sheets);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'Mode!A2:B', // Start from row 2 to skip header
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    // Search for existing user (skip header row, so rowIndex starts at 2)
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && rows[i][0].toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 2; // +2 because we start from row 2 (after header)
        break;
      }
    }

    const values = [[email, mode]];

    if (rowIndex > 0) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId: loginSpreadsheetId,
        range: `Mode!A${rowIndex}:B${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
      console.log(`Updated mode for ${email} at row ${rowIndex}`);
    } else {
      // Append new row (will be added after existing data)
      await sheets.spreadsheets.values.append({
        spreadsheetId: loginSpreadsheetId,
        range: 'Mode!A2:B', // Start from row 2 to skip header
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
      console.log(`Appended new mode for ${email}`);
    }

    return true;
  } catch (error) {
    console.error('Error updating user mode:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });
    throw error;
  }
};

// Color palette functions
// ColorPalette sheet structure: A:Email, B:LightModeColor, C:DarkModeColor
// Colors are stored as HSL string: "hue saturation% lightness%"

// Helper function to ensure ColorPalette sheet exists
const ensureColorPaletteSheetExists = async (sheetsClient) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    // Try to get the spreadsheet to check if ColorPalette sheet exists
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: loginSpreadsheetId,
    });

    const sheetsList = spreadsheet.data.sheets || [];
    const colorPaletteSheet = sheetsList.find(
      (sheet) => sheet.properties.title === 'ColorPalette'
    );

    if (!colorPaletteSheet) {
      // Create the ColorPalette sheet
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: loginSpreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'ColorPalette',
                },
              },
            },
          ],
        },
      });

      // Add headers to the new sheet
      const headerValues = [['Email', 'LightModeColor', 'DarkModeColor']];
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: loginSpreadsheetId,
        range: 'ColorPalette!A1:C1',
        valueInputOption: 'RAW',
        requestBody: {
          values: headerValues,
        },
      });

      console.log('ColorPalette sheet created successfully');
    }
  } catch (error) {
    // If error is about sheet already existing, that's fine
    if (error.message && error.message.includes('already exists')) {
      console.log('ColorPalette sheet already exists');
    } else {
      console.error('Error ensuring ColorPalette sheet exists:', error);
      throw error;
    }
  }
};

export const getUserColorPalette = async (email, accessToken = null) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    const data = await fetchFromSheets(
      loginSpreadsheetId,
      'ColorPalette!A:C',
      accessToken
    );

    const rows = data.values || [];

    for (const row of rows) {
      if (row.length >= 1 && row[0].toLowerCase() === email.toLowerCase()) {
        // Convert empty strings to null for consistency
        const lightColor = row[1] && row[1].trim() !== '' ? row[1] : null;
        const darkColor = row[2] && row[2].trim() !== '' ? row[2] : null;
        return {
          lightModeColor: lightColor,
          darkModeColor: darkColor,
        };
      }
    }

    return { lightModeColor: null, darkModeColor: null };
  } catch (error) {
    // If sheet doesn't exist or access denied, return default values
    if (error.message && (error.message.includes('Unable to parse range') || error.message.includes('403'))) {
      console.log('ColorPalette sheet does not exist yet or access denied, returning default values');
      return { lightModeColor: null, darkModeColor: null };
    }
    console.error('Error fetching user color palette:', error);
    throw error;
  }
};

export const updateUserColorPalette = async (email, lightModeColor, darkModeColor, accessToken = null) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    // Use OAuth if access token is provided, otherwise use API key (read-only)
    let sheetsClient = sheets;
    
    if (accessToken) {
      const tempOAuth2Client = new google.auth.OAuth2(
        GOOGLE_CONFIG.CLIENT_ID,
        GOOGLE_CONFIG.CLIENT_SECRET,
        GOOGLE_CONFIG.REDIRECT_URI
      );
      tempOAuth2Client.setCredentials({ access_token: accessToken });
      sheetsClient = google.sheets({
        version: 'v4',
        auth: tempOAuth2Client,
      });
    } else {
      throw new Error('Access token is required to update color palette');
    }

    // Ensure sheet exists before reading/writing
    await ensureColorPaletteSheetExists(sheetsClient);

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'ColorPalette!A:C',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && rows[i][0].toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }

    // Convert null to empty string for Google Sheets (empty string means default/not set)
    const lightColorValue = lightModeColor === null || lightModeColor === undefined ? '' : lightModeColor;
    const darkColorValue = darkModeColor === null || darkModeColor === undefined ? '' : darkModeColor;
    
    const values = [[email, lightColorValue, darkColorValue]];

    if (rowIndex > 0) {
      // Update existing row
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: loginSpreadsheetId,
        range: `ColorPalette!A${rowIndex}:C${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
    } else {
      // Append new row
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId: loginSpreadsheetId,
        range: 'ColorPalette!A:C',
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error updating user color palette:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });
    throw error;
  }
};

// User profile functions
// UserDetail structure: A:Email, B:Password, C:Username, D:Photo
export const getUserProfile = async (email, accessToken = null) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    // Use "UserDetail" sheet name
    const sheetRange = 'UserDetail!A2:D100';
    let rows = [];
    
    if (accessToken) {
      // Use fetch API directly with the access token (OAuth authentication)
      const range = encodeURIComponent(sheetRange);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${loginSpreadsheetId}/values/${range}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[getUserProfile] Google Sheets API error:', errorText);
        throw new Error(`Failed to fetch user profile: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      rows = data.values || [];
    } else {
      // Fall back to googleapis library with API key (may fail for private sheets)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: loginSpreadsheetId,
        range: sheetRange,
      });
      rows = response.data.values || [];
    }

    for (const row of rows) {
      if (row.length >= 2 && row[0].toLowerCase() === email.toLowerCase()) {
        return {
          email: row[0] || '',
          password: row[1] || '',
          username: row[2] || 'NA', // Default to 'NA' if username not set
          photo: row[3] || '', // Photo as base64 or URL
        };
      }
    }

    // Return default if user not found
    return {
      email: email,
      password: '',
      username: 'NA',
      photo: '',
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

export const updateUserProfile = async (email, username, photo = null) => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:D100',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    // Find the row for the current user's email
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && rows[i][0].toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 2; // +2 because sheets are 1-indexed and we start from row 2
        break;
      }
    }

    if (rowIndex > 0) {
      // Update username (column C) and photo (column D) if provided
      // Use individual updates for better reliability, especially with large base64 images
      
      if (username !== undefined) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: loginSpreadsheetId,
          range: `UserDetail!C${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[username || 'NA']],
          },
        });
      }
      
      if (photo !== null && photo !== undefined) {
        // For base64 images, truncate if too long (Google Sheets cell limit is ~50,000 characters)
        // But we'll try to save it as-is first
        const photoValue = photo || '';
        
        // Check if photo is a base64 data URL and if it's too large
        if (photoValue.startsWith('data:') && photoValue.length > 50000) {
          console.warn('Photo is very large, attempting to save anyway');
        }
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: loginSpreadsheetId,
          range: `UserDetail!D${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[photoValue]],
          },
        });
      }
    } else {
      // User not found, but we won't create a new row here
      // This should only be called for authenticated users
      throw new Error('User not found');
    }

    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Update user photo from Google account during authentication
export const updateUserPhotoFromGoogle = async (email, photoUrl, accessToken = null) => {
  try {
    // Get LOGIN spreadsheet ID
    const loginSpreadsheetId = getLoginSpreadsheetId();
    
    if (!loginSpreadsheetId || loginSpreadsheetId.trim() === '') {
      console.warn('LOGIN_SPREADSHEET_ID not available, skipping photo update');
      return false;
    }

    // Use fetch API if access token is provided, otherwise use sheets client
    let rows = [];
    
    if (accessToken) {
      // Use fetch API directly with the access token
      const range = encodeURIComponent('UserDetail!A2:D100');
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${loginSpreadsheetId}/values/${range}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching user data for photo update:', errorText);
        return false;
      }

      const data = await response.json();
      rows = data.values || [];
    } else {
      // Use googleapis library
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: loginSpreadsheetId,
        range: 'UserDetail!A2:D100',
      });
      rows = response.data.values || [];
    }

    let rowIndex = -1;

    // Find the row for the current user's email
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && rows[i][0].toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex > 0) {
      // Only update if photo column is empty (don't overwrite user's uploaded photo)
      const currentPhoto = rows[rowIndex - 2][3] || '';
      if (!currentPhoto || currentPhoto.trim() === '') {
        if (accessToken) {
          // Use fetch API for update
          const updateRange = encodeURIComponent(`UserDetail!D${rowIndex}`);
          const updateResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${loginSpreadsheetId}/values/${updateRange}?valueInputOption=RAW`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                values: [[photoUrl || '']],
              }),
            }
          );

          if (!updateResponse.ok) {
            console.error('Error updating photo:', await updateResponse.text());
            return false;
          }
        } else {
          // Use googleapis library for update
          await sheets.spreadsheets.values.update({
            spreadsheetId: loginSpreadsheetId,
            range: `UserDetail!D${rowIndex}`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [[photoUrl || '']],
            },
          });
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error updating user photo from Google:', error);
    // Don't throw error - photo update is optional
    return false;
  }
};

// Update user password
// UserDetail structure: A:Email, B:Password, C:Username, D:Photo
export const updateUserPassword = async (email, currentPassword, newPassword) => {
  try {
    // First verify the current password
    const isValid = await authenticateUser(email, currentPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const loginSpreadsheetId = getLoginSpreadsheetId();
    if (!loginSpreadsheetId) {
      throw new Error('LOGIN_SPREADSHEET_ID is not configured');
    }

    // Get the spreadsheet to find the user's row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'UserDetail!A2:D100',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    // Find the row for the current user's email
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && rows[i][0].toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 2; // +2 because sheets are 1-indexed and we start from row 2
        break;
      }
    }

    if (rowIndex > 0) {
      // Update password in column B
      await sheets.spreadsheets.values.update({
        spreadsheetId: loginSpreadsheetId,
        range: `UserDetail!B${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[newPassword]],
        },
      });
    } else {
      throw new Error('User not found');
    }

    return true;
  } catch (error) {
    console.error('Error updating user password:', error);
    throw error;
  }
};