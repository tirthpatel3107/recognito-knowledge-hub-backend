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
    // Check if QUESTION_BANK spreadsheet ID is configured
    if (!SPREADSHEET_IDS.QUESTION_BANK || SPREADSHEET_IDS.QUESTION_BANK.trim() === '') {
      const errorMsg = 'QUESTION_BANK_SPREADSHEET_ID is not configured. Please authenticate to load configuration.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

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
  } catch (error: any) {
    console.error('Error getting technologies:', error);
    // Re-throw the error so the controller can handle it properly
    throw error;
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
export const deleteTechnology = async (sheetId: number): Promise<{ success: boolean; error?: string }> => {
  try {
    const sheetsClient = getSheetsClient();
    
    // First, check how many sheets exist
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
    });
    
    const sheets = spreadsheet.data.sheets || [];
    
    // Google Sheets requires at least one sheet, so prevent deleting the last one
    if (sheets.length <= 1) {
      return {
        success: false,
        error: "Cannot delete the last sheet. A spreadsheet must have at least one sheet."
      };
    }
    
    // Proceed with deletion
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
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting technology:', error);
    
    // Check for specific Google Sheets API error
    if (error?.message?.includes("You can't remove all the sheets")) {
      return {
        success: false,
        error: "Cannot delete the last sheet. A spreadsheet must have at least one sheet."
      };
    }
    
    return {
      success: false,
      error: error?.message || 'Failed to delete technology'
    };
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
 * Split text into chunks of max 50,000 characters (Google Sheets cell limit)
 */
const splitTextIntoChunks = (text: string, maxLength: number = 50000): string[] => {
  if (text.length <= maxLength) {
    return [text];
  }
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.substring(i, i + maxLength));
  }
  return chunks;
};

/**
 * Convert column index (0-based) to column letter (A, B, ..., Z, AA, AB, ...)
 */
const getColumnLetter = (colIndex: number): string => {
  let result = '';
  let num = colIndex;
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
};

/**
 * Get questions for a technology
 * Handles text that may be split across multiple columns
 * Structure: A=Serial, B=Q1, C=A1, D=Images1, E=FirstImage1, F=Q2, G=A2, H=Images2, I=FirstImage2, ...
 */
export const getQuestions = async (
  technologyName: string,
  accessToken: string | null = null
): Promise<Question[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    // Read up to column Z to handle split text
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A2:Z1000`,
    });

    const rows = response.data.values || [];
    return rows.map((row: any[], index: number) => {
      // Reconstruct question, answer, imageUrls, and firstImage from multiple columns
      // Each group is 4 columns: [Q, A, Images, FirstImage]
      let question = '';
      let answer = '';
      let imageUrlsString = '';
      let firstImage = '';

      // Process in groups of 4 columns starting from index 1 (after Serial number)
      for (let i = 1; i < row.length; i += 4) {
        if (row[i]) question += row[i]; // Question chunk
        if (row[i + 1]) answer += row[i + 1]; // Answer chunk
        if (row[i + 2]) imageUrlsString += row[i + 2]; // Image URLs chunk
        if (row[i + 3]) firstImage += row[i + 3]; // First image chunk
      }

      // Parse image URLs (combine all chunks and split by delimiter)
      // Use ||| as delimiter to avoid conflicts with base64 data URLs which contain commas
      // Support backward compatibility with comma delimiter for old data
      let imageUrls: string[] = [];
      if (imageUrlsString) {
        // Try new format first (||| delimiter)
        if (imageUrlsString.includes('|||')) {
          imageUrls = imageUrlsString.split('|||').map((url: string) => url.trim()).filter(Boolean);
        } else {
          // Old format: comma delimiter
          // Base64 data URLs have format: data:image/png;base64,<data>
          // When split by comma, single image becomes: ["data:image/png;base64", "<data>"]
          // We need to detect this pattern and reconstruct the URL
          const commaSplit = imageUrlsString.split(',');
          if (commaSplit.length === 2 && commaSplit[0].includes('base64') && !commaSplit[1].includes('data:')) {
            // This is likely a single base64 image that was incorrectly split
            // Reconstruct it by joining with comma
            imageUrls = [commaSplit.join(',')];
          } else {
            // Multiple images or different format - try to reconstruct intelligently
            const reconstructed: string[] = [];
            let current = '';
            for (let i = 0; i < commaSplit.length; i++) {
              const part = commaSplit[i].trim();
              if (!part) continue;
              
              if (part.startsWith('data:') || part.startsWith('http://') || part.startsWith('https://')) {
                // This is a new URL start
                if (current) {
                  reconstructed.push(current);
                }
                current = part;
              } else if (current) {
                // This is continuation of current URL (base64 data after the comma)
                current += ',' + part;
              }
            }
            if (current) {
              reconstructed.push(current);
            }
            imageUrls = reconstructed.length > 0 ? reconstructed : commaSplit.filter(Boolean);
          }
        }
      }

      return {
        id: `q-${index}`,
        question,
        answer,
        imageUrls,
      };
    });
  } catch (error) {
    console.error('Error getting questions:', error);
    return [];
  }
};

/**
 * Add a question
 * Splits long text across multiple cells to handle Google Sheets 50,000 character limit
 * No validation - automatically handles unlimited characters by chunking
 */
export const addQuestion = async (
  technologyName: string,
  questionData: QuestionInput
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    
    // Get current row count
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A:A`,
    });
    const rowCount = (response.data.values?.length || 1) + 1;

    // Split all text fields into chunks if they exceed 50,000 characters
    const questionChunks = splitTextIntoChunks(questionData.question || '');
    const answerChunks = splitTextIntoChunks(questionData.answer || '');
    // Use ||| as delimiter to avoid conflicts with base64 data URLs which contain commas
    const imageUrlsString = questionData.imageUrls?.join('|||') || '';
    const imageUrlsChunks = splitTextIntoChunks(imageUrlsString);
    const firstImage = questionData.imageUrls?.[0] || '';
    const firstImageChunks = splitTextIntoChunks(firstImage);

    // Build the row array: [Serial, Q1, A1, Images1, FirstImage1, Q2, A2, Images2, FirstImage2, ...]
    // Structure: A=Serial, B=Q1, C=A1, D=Images1, E=FirstImage1, F=Q2, G=A2, H=Images2, I=FirstImage2, ...
    const rowData: any[] = [
      rowCount - 1, // Serial number (A)
    ];

    // Add chunks in groups: [Q, A, Images, FirstImage] for each chunk index
    const maxChunks = Math.max(
      questionChunks.length,
      answerChunks.length,
      imageUrlsChunks.length,
      firstImageChunks.length
    );

    for (let i = 0; i < maxChunks; i++) {
      rowData.push(questionChunks[i] || ''); // Question chunk
      rowData.push(answerChunks[i] || ''); // Answer chunk
      rowData.push(imageUrlsChunks[i] || ''); // Image URLs chunk
      rowData.push(firstImageChunks[i] || ''); // First image chunk
    }

    // Determine the end column based on how many chunks we have
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${rowCount}:${endColumn}${rowCount}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
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
 * Splits long text across multiple cells to handle Google Sheets 50,000 character limit
 * No validation - automatically handles unlimited characters by chunking
 */
export const updateQuestion = async (
  technologyName: string,
  rowIndex: number,
  questionData: QuestionInput
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2; // +2 for header and 0-indexing

    // Split all text fields into chunks if they exceed 50,000 characters
    const questionChunks = splitTextIntoChunks(questionData.question || '');
    const answerChunks = splitTextIntoChunks(questionData.answer || '');
    // Use ||| as delimiter to avoid conflicts with base64 data URLs which contain commas
    const imageUrlsString = questionData.imageUrls?.join('|||') || '';
    const imageUrlsChunks = splitTextIntoChunks(imageUrlsString);
    const firstImage = questionData.imageUrls?.[0] || '';
    const firstImageChunks = splitTextIntoChunks(firstImage);

    // Build the row array: [Serial, Q1, A1, Images1, FirstImage1, Q2, A2, Images2, FirstImage2, ...]
    const rowData: any[] = [
      rowIndex + 1, // Serial number (A)
    ];

    // Add chunks in groups: [Q, A, Images, FirstImage] for each chunk index
    const maxChunks = Math.max(
      questionChunks.length,
      answerChunks.length,
      imageUrlsChunks.length,
      firstImageChunks.length
    );

    for (let i = 0; i < maxChunks; i++) {
      rowData.push(questionChunks[i] || ''); // Question chunk
      rowData.push(answerChunks[i] || ''); // Answer chunk
      rowData.push(imageUrlsChunks[i] || ''); // Image URLs chunk
      rowData.push(firstImageChunks[i] || ''); // First image chunk
    }

    // First, read current row to see how many columns are used (to clear old data if needed)
    const currentRowResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A${actualRow}:ZZ${actualRow}`,
    });
    const currentRow = currentRowResponse.data.values?.[0] || [];
    const maxCurrentCol = currentRow.length;

    // Determine the end column based on how many chunks we have
    const endColumnIndex = Math.max(maxCurrentCol, rowData.length);
    const endColumn = getColumnLetter(endColumnIndex - 1);
    const range = `${technologyName}!A${actualRow}:${endColumn}${actualRow}`;

    // If we're writing fewer columns than exist, extend rowData with empty strings to clear old data
    if (rowData.length < maxCurrentCol) {
      while (rowData.length < maxCurrentCol) {
        rowData.push('');
      }
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
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
  sheetId: number,
  accessToken: string | null = null
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const actualRow = rowIndex + 2; // +2 for header and 0-indexing

    // Delete the row
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

    // Update serial numbers for all remaining questions after deletion
    const updatedQuestions = await getQuestions(technologyName, accessToken);
    
    // Build updates for serial numbers in column A
    const updates = updatedQuestions.map((q, index) => ({
      range: `${technologyName}!A${index + 2}`, // +2 for header and 1-based index
      values: [[index + 1]], // Serial number
    }));

    // Batch update all serial numbers
    if (updates.length > 0) {
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

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
    // Handle no-op case
    if (oldIndex === newIndex) {
      return true;
    }

    const sheetsClient = getSheetsClient();
    // Convert indices to actual row numbers (accounting for header row)
    // In 0-based indexing: row 0 is header, row 1 is first data row
    const oldRowNumber = oldIndex + 1; // +1 to account for header
    const newRowNumber = newIndex + 1; // +1 to account for header

    // Move the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId,
                dimension: 'ROWS',
                startIndex: oldRowNumber,
                endIndex: oldRowNumber + 1,
              },
              destinationIndex: newRowNumber > oldRowNumber ? newRowNumber + 1 : newRowNumber,
            },
          },
        ],
      },
    });

    // Update serial numbers for all questions after the move
    const updatedQuestions = await getQuestions(technologyName);
    
    // Build updates for serial numbers in column A
    const updates = updatedQuestions.map((q, index) => ({
      range: `${technologyName}!A${index + 2}`, // +2 for header and 1-based index
      values: [[index + 1]], // Serial number
    }));

    // Batch update all serial numbers
    if (updates.length > 0) {
      await sheetsClient.spreadsheets.values.batchUpdate({
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

    // Move the row
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

    // Update serial numbers for all projects after the move
    const updatedProjects = await getProjects();
    
    // Build updates for serial numbers in column A
    const updates = updatedProjects.map((p, index) => ({
      range: `Project List!A${index + 2}`, // +2 for header and 1-based index
      values: [[index + 1]], // Serial number
    }));

    // Batch update all serial numbers
    if (updates.length > 0) {
      await sheetsClient.spreadsheets.values.batchUpdate({
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
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'DashboardOrder!A:Z',
    });

    const rows = response.data.values || [];
    
    // Find the row for the current user's email
    for (const row of rows) {
      if (row.length > 0 && row[0]?.toLowerCase() === email.toLowerCase()) {
        // Return the card IDs (excluding the email column)
        return row.slice(1).filter((id: string) => id && id.trim() !== '');
      }
    }

    // Return empty array if user not found (will use default order)
    return [];
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
  cardOrder: string[],
  accessToken: string | null = null
): Promise<boolean> => {
  try {
    const loginSpreadsheetId = getLoginSpreadsheetId();
    const sheetsClient = getSheetsClient(accessToken);
    
    // First, try to find if user already has a row
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: loginSpreadsheetId,
      range: 'DashboardOrder!A:Z',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    // Find the row for the current user's email
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length > 0 && rows[i][0]?.toLowerCase() === email.toLowerCase()) {
        rowIndex = i + 1; // +1 because sheets are 1-indexed
        break;
      }
    }

    const values = [[email, ...cardOrder]];

    if (rowIndex > 0) {
      // Update existing row
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: loginSpreadsheetId,
        range: `DashboardOrder!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: values,
        },
      });
    } else {
      // Append new row
      await sheetsClient.spreadsheets.values.append({
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
  photo?: string | null,
  accessToken: string | null = null
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
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) {
      console.error('User not found in UserDetail sheet:', email);
      return false;
    }

    // Validate photo size (Google Sheets cell limit is 50,000 characters)
    if (photo !== undefined && photo !== null && photo.length > 50000) {
      console.error('Photo data too large:', photo.length, 'characters (max 50,000)');
      throw new Error('Photo is too large. Please use a smaller image (max size: ~37KB when base64 encoded)');
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
      console.log('Profile updated successfully for user:', email);
    }
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    if (error instanceof Error) {
      throw error; // Re-throw to pass error message to caller
    }
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

