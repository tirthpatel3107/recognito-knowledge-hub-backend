/**
 * Google Sheets Service
 * Handles all Google Sheets API operations
 */
import { google } from 'googleapis';
import {
  GOOGLE_CONFIG,
  SPREADSHEET_IDS,
} from '../config/googleConfig.js';

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

// Authentication
export const authenticateUser = async (email, password) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.LOGIN,
      range: 'Sheet1!A2:B100',
    });

    const rows = response.data.values || [];

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
    throw error;
  }
};

// Get all technologies (sheets)
export const getTechnologies = async () => {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
    });

    const sheetList = response.data.sheets || [];

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
export const getQuestions = async (technologyName) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A2:D1000`,
    });

    const rows = response.data.values || [];

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
export const getPracticalTasks = async () => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: 'Sheet1!A2:E1000',
    });

    const rows = response.data.values || [];

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
export const getProjects = async () => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PROJECT_LISTING,
      range: 'Project List!A2:C1000',
    });

    const rows = response.data.values || [];

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
export const getWorkSummaryMonthSheets = async () => {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });

    const sheetsList = response.data.sheets || [];
    return sheetsList
      .map((sheet) => sheet.properties.title)
      .filter((title) => title !== 'Sheet1' && title !== 'Project List');
  } catch (error) {
    console.error('Error fetching work summary month sheets:', error);
    throw error;
  }
};

// Get work summary entries by month
export const getWorkSummaryEntriesByMonth = async (monthSheet) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A2:E1000`,
    });

    const rows = response.data.values || [];

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
export const getDashboardCardOrder = async (email) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.LOGIN,
      range: 'DashboardOrder!A:Z',
    });

    const rows = response.data.values || [];

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
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.LOGIN,
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
        spreadsheetId: SPREADSHEET_IDS.LOGIN,
        range: `DashboardOrder!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_IDS.LOGIN,
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
export const getUserMode = async (email) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.LOGIN,
      range: 'Mode!A:B',
    });

    const rows = response.data.values || [];

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
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.LOGIN,
      range: 'Mode!A:B',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && rows[i][0].toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }

    const values = [[email, mode]];

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_IDS.LOGIN,
        range: `Mode!A${rowIndex}:B${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_IDS.LOGIN,
        range: 'Mode!A:B',
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error updating user mode:', error);
    throw error;
  }
};
