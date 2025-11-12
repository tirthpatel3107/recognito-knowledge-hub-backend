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
    const response = await sheetsClient.spreadsheets.batchUpdate({
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

    // Add header row to the new sheet
    const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (newSheetId !== undefined) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
        range: `${name}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['No', 'Question', 'Answer', 'Image']],
        },
      });
    }

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

// ==================== Practical Task Technologies ====================

/**
 * Get all practical task technologies
 */
export const getPracticalTaskTechnologies = async (accessToken: string | null = null): Promise<Technology[]> => {
  try {
    // Check if PRACTICAL_TASKS spreadsheet ID is configured
    if (!SPREADSHEET_IDS.PRACTICAL_TASKS || SPREADSHEET_IDS.PRACTICAL_TASKS.trim() === '') {
      const errorMsg = 'PRACTICAL_TASKS_SPREADSHEET_ID is not configured. Please authenticate to load configuration.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
    });

    const sheets = response.data.sheets || [];
    return sheets.map((sheet: any, index: number) => ({
      id: `tech-${sheet.properties.sheetId}`,
      name: sheet.properties.title,
      sheetId: sheet.properties.sheetId,
    }));
  } catch (error: any) {
    console.error('Error getting practical task technologies:', error);
    // Re-throw the error so the controller can handle it properly
    throw error;
  }
};

/**
 * Create a new practical task technology (sheet)
 */
export const createPracticalTaskTechnology = async (name: string): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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

    // Add header row to the new sheet
    const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (newSheetId !== undefined) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
        range: `${name}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['No', 'Question', 'Answer', 'Image']],
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error creating practical task technology:', error);
    return false;
  }
};

/**
 * Update practical task technology name
 */
export const updatePracticalTaskTechnology = async (
  oldName: string,
  newName: string,
  sheetId: number
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
    console.error('Error updating practical task technology:', error);
    return false;
  }
};

/**
 * Delete practical task technology (sheet)
 */
export const deletePracticalTaskTechnology = async (sheetId: number): Promise<{ success: boolean; error?: string }> => {
  try {
    const sheetsClient = getSheetsClient();
    
    // First, check how many sheets exist
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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
    console.error('Error deleting practical task technology:', error);
    
    // Check for specific Google Sheets API error
    if (error?.message?.includes("You can't remove all the sheets")) {
      return {
        success: false,
        error: "Cannot delete the last sheet. A spreadsheet must have at least one sheet."
      };
    }
    
    return {
      success: false,
      error: error?.message || 'Failed to delete practical task technology'
    };
  }
};

/**
 * Reorder practical task technologies
 */
export const reorderPracticalTaskTechnologies = async (technologyIds: number[]): Promise<boolean> => {
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
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      requestBody: { requests },
    });
    return true;
  } catch (error) {
    console.error('Error reordering practical task technologies:', error);
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
 * Ensure Question Bank sheet has correct headers
 */
const ensureQuestionBankHeaders = async (
  technologyName: string,
  accessToken: string | null = null
): Promise<void> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    // Check if headers exist
    const headerResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
      range: `${technologyName}!A1:D1`,
    });

    const headerRow = headerResponse.data.values?.[0] || [];
    const expectedHeaders = ['No', 'Question', 'Answer', 'Image'];
    
    // Check if headers match expected format (at least first 4 columns)
    const headersMatch = headerRow.length >= 4 &&
      headerRow[0] === expectedHeaders[0] &&
      headerRow[1] === expectedHeaders[1] &&
      headerRow[2] === expectedHeaders[2] &&
      headerRow[3] === expectedHeaders[3];

    // If headers don't exist or don't match, create/update them
    if (!headersMatch) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
        range: `${technologyName}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [expectedHeaders],
        },
      });
    }
  } catch (error) {
    // If sheet doesn't exist or range is empty, try to create headers
    if (error instanceof Error && (error.message.includes('Unable to parse range') || error.message.includes('does not exist'))) {
      try {
        const sheetsClient = getSheetsClient(accessToken);
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_IDS.QUESTION_BANK,
          range: `${technologyName}!A1:D1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['No', 'Question', 'Answer', 'Image']],
          },
        });
      } catch (updateError) {
        console.error('Error creating Question Bank headers:', updateError);
      }
    } else {
      console.error('Error checking Question Bank headers:', error);
    }
  }
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
  // Ensure headers exist before reading data
  await ensureQuestionBankHeaders(technologyName, accessToken);
  
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
    // Ensure headers exist before adding data
    await ensureQuestionBankHeaders(technologyName);
    
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
 * Helper to find the "Project List" sheet in the WORK_SUMMARY spreadsheet
 * Returns both the sheet name (with correct casing) and sheet ID
 * Note: Project List sheet (tab) is inside the WORK_SUMMARY spreadsheet, not PROJECT_LISTING
 */
const findProjectListSheet = async (accessToken: string | null = null): Promise<{ 
  sheetName: string; 
  sheetId?: number; 
  availableSheets: string[] 
}> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    
    if (!SPREADSHEET_IDS.WORK_SUMMARY) {
      console.error('WORK_SUMMARY spreadsheet ID is not configured');
      return { sheetName: 'Project List', availableSheets: [] };
    }

    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });

    const sheetsList = response.data.sheets || [];
    const availableSheets = sheetsList.map((sheet: any) => sheet.properties?.title).filter(Boolean);
    
    // Case-insensitive search for "Project List" sheet (tab)
    // Normalize the search: remove all whitespace and convert to lowercase for comparison
    let projectListSheet = sheetsList.find(
      (sheet) => {
        const title = sheet.properties?.title || '';
        // Remove all whitespace (spaces, tabs, etc.) and compare
        const normalized = title.replace(/\s+/g, ' ').trim().toLowerCase();
        return normalized === 'project list';
      }
    );

    // If not found, try partial match (contains both "project" and "list" in any order)
    if (!projectListSheet) {
      projectListSheet = sheetsList.find(
        (sheet) => {
          const title = (sheet.properties?.title || '').toLowerCase();
          // Check if title contains both words (in any order)
          return title.includes('project') && title.includes('list');
        }
      );
    }

    // If still not found, try to find by exact name match (case-sensitive) from available sheets
    if (!projectListSheet) {
      projectListSheet = sheetsList.find(
        (sheet) => {
          const title = sheet.properties?.title || '';
          return title === 'Project List';
        }
      );
    }

    if (!projectListSheet?.properties?.title) {
      const sheetsListStr = availableSheets.join(', ');
      console.error('Project List sheet (tab) not found in WORK_SUMMARY spreadsheet.');
      console.error('Available sheets (tabs):', sheetsListStr);
      return { sheetName: 'Project List', availableSheets };
    }

    return {
      sheetName: projectListSheet.properties.title,
      sheetId: projectListSheet.properties?.sheetId,
      availableSheets
    };
  } catch (error) {
    console.error('Error finding Project List sheet:', error);
    return { sheetName: 'Project List', availableSheets: [] };
  }
};

/**
 * Helper to get the actual sheet name (with correct casing) for "Project List"
 * This ensures range references work correctly regardless of sheet name casing
 */
const getProjectListSheetName = async (accessToken: string | null = null): Promise<string> => {
  const result = await findProjectListSheet(accessToken);
  return result.sheetName;
};

/**
 * Get all projects
 */
export const getProjects = async (accessToken: string | null = null): Promise<Project[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const sheetName = await getProjectListSheetName(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${sheetName}!A2:C1000`,
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
    const sheetName = await getProjectListSheetName();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${sheetName}!A:A`,
    });
    const rowCount = (response.data.values?.length || 1) + 1;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${sheetName}!A${rowCount}`,
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
    const sheetName = await getProjectListSheetName();
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${sheetName}!A${actualRow}:C${actualRow}`,
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
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
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
    const sheetName = await getProjectListSheetName();
    const updates = updatedProjects.map((p, index) => ({
      range: `${sheetName}!A${index + 2}`, // +2 for header and 1-based index
      values: [[index + 1]], // Serial number
    }));

    // Batch update all serial numbers
    if (updates.length > 0) {
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
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
    // Filter out Sheet1 and Project List (the project listing table) - case-insensitive
    return sheets
      .map((sheet: any) => sheet.properties.title)
      .filter((title: string) => {
        const lowerTitle = title?.toLowerCase().trim();
        return lowerTitle !== 'sheet1' && lowerTitle !== 'project list';
      });
  } catch (error) {
    console.error('Error getting month sheets:', error);
    return [];
  }
};

/**
 * Ensure Work Summary sheet has correct headers
 */
const ensureWorkSummaryHeaders = async (
  monthSheet: string,
  accessToken: string | null = null
): Promise<void> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    // Check if headers exist
    const headerResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A1:D1`,
    });

    const headerRow = headerResponse.data.values?.[0] || [];
    const expectedHeaders = ['No', 'ProjectName', 'WorkSummary', 'Date'];
    
    // Check if headers match expected format
    const headersMatch = headerRow.length === 4 &&
      headerRow[0] === expectedHeaders[0] &&
      headerRow[1] === expectedHeaders[1] &&
      headerRow[2] === expectedHeaders[2] &&
      headerRow[3] === expectedHeaders[3];

    // If headers don't exist or don't match, create/update them
    if (!headersMatch) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
        range: `${monthSheet}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [expectedHeaders],
        },
      });
    }
  } catch (error) {
    // If sheet doesn't exist or range is empty, try to create headers
    if (error instanceof Error && (error.message.includes('Unable to parse range') || error.message.includes('does not exist'))) {
      try {
        const sheetsClient = getSheetsClient(accessToken);
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
          range: `${monthSheet}!A1:D1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['No', 'ProjectName', 'WorkSummary', 'Date']],
          },
        });
      } catch (updateError) {
        console.error('Error creating Work Summary headers:', updateError);
      }
    } else {
      console.error('Error checking Work Summary headers:', error);
    }
  }
};

/**
 * Get work summary entries for a month
 */
export const getWorkSummaryEntriesByMonth = async (
  monthSheet: string,
  accessToken: string | null = null
): Promise<WorkSummaryEntry[]> => {
  // Ensure headers exist before reading data
  await ensureWorkSummaryHeaders(monthSheet, accessToken);
  
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
      date: parseDateFromGoogleSheets(row[3] || ''), // Convert date from DD MMM YYYY to YYYY-MM-DD
    }));
  } catch (error) {
    console.error('Error getting work summary entries:', error);
    return [];
  }
};

/**
 * Parse month name (e.g., "JAN 25") to date for sorting
 * Returns timestamp for comparison, or 0 if parsing fails
 */
const parseMonthNameToDate = (monthName: string): number => {
  try {
    const monthNames = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
    ];
    
    const parts = monthName.trim().toUpperCase().split(/\s+/);
    if (parts.length !== 2) return 0;
    
    const month = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[1]);
    
    if (month === -1 || isNaN(year)) return 0;
    
    // Convert 2-digit year to 4-digit (assume 2000-2099 range)
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    
    return new Date(fullYear, month, 1).getTime();
  } catch (error) {
    return 0;
  }
};

/**
 * Reorder Work Summary sheets in descending order (newest first)
 * Project List stays at index 0, month sheets are sorted by date descending
 */
const reorderWorkSummarySheets = async (
  accessToken: string | null = null
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });

    const sheets = response.data.sheets || [];
    
    // Categorize sheets
    const projectListSheet = sheets.find((sheet: any) => {
      const title = sheet.properties.title?.toLowerCase().trim();
      return title === 'project list';
    });
    
    const monthSheets: any[] = [];
    const otherSheets: any[] = [];

    sheets.forEach((sheet: any) => {
      const title = sheet.properties.title?.toLowerCase().trim();
      if (title === 'project list') {
        // Skip, already have it
        return;
      } else if (parseMonthNameToDate(sheet.properties.title) > 0) {
        // This is a month sheet (can be parsed as a date)
        monthSheets.push(sheet);
      } else {
        // Other sheets (Sheet1, etc.)
        otherSheets.push(sheet);
      }
    });

    // Sort month sheets by date in descending order (newest first)
    monthSheets.sort((a: any, b: any) => {
      const dateA = parseMonthNameToDate(a.properties.title);
      const dateB = parseMonthNameToDate(b.properties.title);
      return dateB - dateA; // Descending order
    });

    // Build ordered sheets: Project List first, then month sheets, then others
    const orderedSheets: any[] = [];
    let currentIndex = 0;

    // Add Project List at index 0 if it exists
    if (projectListSheet) {
      orderedSheets.push({
        sheetId: projectListSheet.properties.sheetId,
        index: currentIndex++,
      });
    }

    // Add month sheets in descending order
    monthSheets.forEach((sheet: any) => {
      orderedSheets.push({
        sheetId: sheet.properties.sheetId,
        index: currentIndex++,
      });
    });

    // Add other sheets at the end
    otherSheets.forEach((sheet: any) => {
      orderedSheets.push({
        sheetId: sheet.properties.sheetId,
        index: currentIndex++,
      });
    });

    // Update sheet positions
    const requests = orderedSheets.map((sheet) => ({
      updateSheetProperties: {
        properties: {
          sheetId: sheet.sheetId,
          index: sheet.index,
        },
        fields: 'index',
      },
    }));

    if (requests.length > 0) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
        requestBody: { requests },
      });
    }

    return true;
  } catch (error) {
    console.error('Error reordering Work Summary sheets:', error);
    return false;
  }
};

/**
 * Create a new month sheet
 */
export const createWorkSummaryMonthSheet = async (monthName: string): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.batchUpdate({
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

    // Add header row to the new sheet
    const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (newSheetId !== undefined) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
        range: `${monthName}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['No', 'ProjectName', 'WorkSummary', 'Date']],
        },
      });
    }

    // Reorder sheets in descending order after creating new sheet
    await reorderWorkSummarySheets();

    return true;
  } catch (error) {
    console.error('Error creating month sheet:', error);
    return false;
  }
};

/**
 * Format date from YYYY-MM-DD to DD MMM YYYY format (e.g., "11 NOV 2025")
 */
const formatDateForGoogleSheets = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // If parsing fails, return original string
      return dateString;
    }
    
    const day = date.getDate(); // Day without leading zero (1-31)
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  } catch (error) {
    // If any error occurs, return original string
    return dateString;
  }
};

/**
 * Parse date from DD MMM YYYY format (e.g., "11 NOV 2025") or YYYY-MM-DD format to YYYY-MM-DD
 * This handles dates read from Google Sheets that may be in either format
 */
const parseDateFromGoogleSheets = (dateString: string): string => {
  if (!dateString) return '';
  
  // Check if it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // Try to parse DD MMM YYYY format (e.g., "11 NOV 2025")
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    // If parsing fails, return original string
  }
  
  return dateString;
};

/**
 * Convert HTML to formatted plain text while preserving line breaks and structure
 * This ensures the work summary appears in Google Sheets the same way it appears in the table
 */
const convertHtmlToFormattedText = (html: string): string => {
  if (!html) return '';
  
  let text = html;
  
  // First, handle list items - convert <li> to newlines with bullet preservation
  // This preserves bullet points (➤, •, etc.) that are in the text content
  text = text.replace(/<li[^>]*>/gi, '\n');
  text = text.replace(/<\/li>/gi, '');
  
  // Replace <br> and <br/> tags with newlines (handle various formats)
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Handle block-level elements - they create line breaks
  // Replace closing tags first to preserve content structure
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  text = text.replace(/<\/ul>/gi, '\n');
  text = text.replace(/<\/ol>/gi, '\n');
  text = text.replace(/<\/blockquote>/gi, '\n');
  
  // Replace opening block tags (will be removed, but newlines already handled)
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<div[^>]*>/gi, '');
  text = text.replace(/<h[1-6][^>]*>/gi, '');
  text = text.replace(/<ul[^>]*>/gi, '');
  text = text.replace(/<ol[^>]*>/gi, '');
  text = text.replace(/<blockquote[^>]*>/gi, '');
  
  // Remove all remaining HTML tags but preserve their text content
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities (common ones)
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
  
  // Handle HTML entity codes (e.g., &#8217;)
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Split into lines and process each line
  const lines = text.split('\n');
  const processedLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Keep non-empty lines and lines with only whitespace that might be intentional
    if (trimmed.length > 0) {
      processedLines.push(trimmed);
    }
  }
  
  // Join lines with newlines
  text = processedLines.join('\n');
  
  // Final trim
  return text.trim();
};

/**
 * Add a work summary entry (inserts in ascending date order)
 */
export const addWorkSummaryEntry = async (
  monthSheet: string,
  entryData: WorkSummaryEntryInput
): Promise<boolean> => {
  try {
    // Ensure headers exist before adding data
    await ensureWorkSummaryHeaders(monthSheet);
    
    const sheetsClient = getSheetsClient();
    
    // Get the sheet ID for the month sheet
    const spreadsheetResponse = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });
    
    const sheets = spreadsheetResponse.data.sheets || [];
    const targetSheet = sheets.find((sheet: any) => sheet.properties.title === monthSheet);
    
    if (!targetSheet) {
      console.error(`Sheet ${monthSheet} not found`);
      return false;
    }
    
    const sheetId = targetSheet.properties.sheetId;
    
    // Get all existing entries
    const entriesResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${monthSheet}!A2:D1000`,
    });
    
    const existingRows = entriesResponse.data.values || [];
    const newEntryDate = new Date(entryData.date).getTime();
    
    // Find the insertion point (ascending date order - oldest first)
    let insertIndex = existingRows.length;
    for (let i = 0; i < existingRows.length; i++) {
      const rowDate = existingRows[i][3]; // Date is in column D (index 3)
      if (rowDate) {
        try {
          const rowDateValue = new Date(rowDate).getTime();
          if (!isNaN(rowDateValue) && newEntryDate < rowDateValue) {
            insertIndex = i;
            break;
          }
        } catch (e) {
          // If date parsing fails, skip this row in comparison
          continue;
        }
      }
    }
    
    // Calculate the actual row number (row 1 is header, so data starts at row 2)
    // insertIndex is 0-based for the data rows, so row 2 = index 0
    const insertRowNumber = insertIndex + 2;
    
    // Prepare batch update requests
    const requests: any[] = [];
    
    // 1. Insert a new row at the insertion point
    requests.push({
      insertDimension: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: insertRowNumber - 1, // Convert to 0-based index (row 2 = index 1)
          endIndex: insertRowNumber,
        },
      },
    });
    
    // 2. Update the new row with entry data
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: insertRowNumber - 1, // 0-based index
          endRowIndex: insertRowNumber,
          startColumnIndex: 0, // Column A
          endColumnIndex: 4, // Columns A-D
        },
        rows: [
          {
              values: [
              { userEnteredValue: { numberValue: insertIndex + 1 } }, // Serial number
              { userEnteredValue: { stringValue: entryData.projectName } },
              { userEnteredValue: { stringValue: convertHtmlToFormattedText(entryData.workSummary) } }, // Convert HTML to formatted text
              { userEnteredValue: { stringValue: formatDateForGoogleSheets(entryData.date) } }, // Format date as DD MMM YYYY
            ],
          },
        ],
        fields: 'userEnteredValue',
      },
    });
    
    // Execute the batch update (insert row and add data)
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests,
      },
    });
    
    // 3. Update serial numbers for all rows after the insertion point
    // After inserting, all rows that were at insertIndex or later need their serial numbers updated
    if (insertIndex < existingRows.length) {
      const serialNumberUpdates = [];
      // Update rows that were originally at insertIndex and later
      // After insertion, these rows shifted down by 1 row
      for (let originalIndex = insertIndex; originalIndex < existingRows.length; originalIndex++) {
        // After insertion, the row that was at originalIndex is now at sheet row:
        // originalIndex + 2 (header at row 1, data starts at row 2) + 1 (inserted row) = originalIndex + 3
        const newRowNumber = originalIndex + 3;
        // The new serial number: insertIndex + 2 (serial for row right after insertion) + (originalIndex - insertIndex)
        // = insertIndex + 2 + originalIndex - insertIndex = originalIndex + 2
        // But actually, we want: the row that was at insertIndex gets serial insertIndex + 2
        // the row that was at insertIndex + 1 gets serial insertIndex + 3, etc.
        const newSerialNumber = originalIndex + 2;
        serialNumberUpdates.push({
          range: `${monthSheet}!A${newRowNumber}`,
          values: [[newSerialNumber]],
        });
      }
      
      if (serialNumberUpdates.length > 0) {
        await sheetsClient.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
          requestBody: {
            valueInputOption: 'RAW',
            data: serialNumberUpdates,
          },
        });
      }
    }
    
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
    
    // Get the sheet ID for the month sheet
    const spreadsheetResponse = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
    });
    
    const sheets = spreadsheetResponse.data.sheets || [];
    const targetSheet = sheets.find((sheet: any) => sheet.properties.title === monthSheet);
    
    if (!targetSheet) {
      console.error(`Sheet ${monthSheet} not found`);
      return false;
    }
    
    const sheetId = targetSheet.properties.sheetId;
    const actualRow = rowIndex + 2;
    
    // Update the row with entry data using updateCells to preserve HTML format exactly as displayed
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId,
                startRowIndex: actualRow - 1, // 0-based index
                endRowIndex: actualRow,
                startColumnIndex: 0, // Column A
                endColumnIndex: 4, // Columns A-D
              },
              rows: [
                {
                  values: [
                    { userEnteredValue: { numberValue: rowIndex + 1 } }, // Serial number
                    { userEnteredValue: { stringValue: entryData.projectName } },
                    { userEnteredValue: { stringValue: convertHtmlToFormattedText(entryData.workSummary) } }, // Convert HTML to formatted text
                    { userEnteredValue: { stringValue: formatDateForGoogleSheets(entryData.date) } }, // Format date as DD MMM YYYY
                  ],
                },
              ],
              fields: 'userEnteredValue',
            },
          },
        ],
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
    const monthNames = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${month} ${year}`;
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

/**
 * Ensure practical task headers exist for a technology sheet
 */
const ensurePracticalTaskHeaders = async (technologyName: string): Promise<void> => {
  try {
    const sheetsClient = getSheetsClient();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: `${technologyName}!A1:D1`,
    });

    const existingHeaders = response.data.values?.[0];
    if (!existingHeaders || existingHeaders.length < 4) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
        range: `${technologyName}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['No', 'Question', 'Answer', 'Image']],
        },
      });
    }
  } catch (error: any) {
    // If sheet doesn't exist, the error will be handled by the caller
    if (error?.message?.includes('Unable to parse range')) {
      // Sheet might not exist, but that's okay - headers will be created when adding first task
      return;
    }
    throw error;
  }
};

/**
 * Get practical tasks by technology
 */
export const getPracticalTasksByTechnology = async (
  technologyName: string,
  accessToken: string | null = null
): Promise<PracticalTask[]> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: `${technologyName}!A2:Z1000`,
    });

    const rows = response.data.values || [];
    return rows.map((row: any[], index: number) => {
      // Handle chunked data similar to questions
      let question = '';
      let answer = '';
      let image = '';

      // Process in groups of 3 columns starting from index 1 (after Serial number)
      for (let i = 1; i < row.length; i += 3) {
        if (row[i]) question += row[i]; // Question chunk
        if (row[i + 1]) answer += row[i + 1]; // Answer chunk
        if (row[i + 2]) image += row[i + 2]; // Image chunk
      }

      return {
        id: `pt-${index}`,
        no: row[0]?.toString() || (index + 1).toString(),
        question,
        answer,
        image: image || row[3] || '', // Fallback to column D if no chunks
      };
    });
  } catch (error: any) {
    if (error?.message?.includes('Unable to parse range')) {
      // Sheet doesn't exist yet, return empty array
      return [];
    }
    console.error('Error getting practical tasks by technology:', error);
    return [];
  }
};

/**
 * Add a practical task
 * Splits long text across multiple cells to handle Google Sheets 50,000 character limit
 */
export const addPracticalTask = async (
  technologyName: string,
  taskData: { question: string; answer: string; image?: string }
): Promise<boolean> => {
  try {
    // Ensure headers exist before adding data
    await ensurePracticalTaskHeaders(technologyName);
    
    const sheetsClient = getSheetsClient();
    
    // Get current row count
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: `${technologyName}!A:A`,
    });
    const rowCount = (response.data.values?.length || 1) + 1;

    // Split all text fields into chunks if they exceed 50,000 characters
    const questionChunks = splitTextIntoChunks(taskData.question || '');
    const answerChunks = splitTextIntoChunks(taskData.answer || '');
    const imageChunks = splitTextIntoChunks(taskData.image || '');

    // Build the row array: [Serial, Q1, A1, I1, Q2, A2, I2, ...]
    const rowData: any[] = [
      rowCount - 1, // Serial number (A)
    ];

    // Add chunks in groups: [Q, A, I] for each chunk index
    const maxChunks = Math.max(
      questionChunks.length,
      answerChunks.length,
      imageChunks.length
    );

    for (let i = 0; i < maxChunks; i++) {
      rowData.push(questionChunks[i] || ''); // Question chunk
      rowData.push(answerChunks[i] || ''); // Answer chunk
      rowData.push(imageChunks[i] || ''); // Image chunk
    }

    // Determine the end column based on how many chunks we have
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${rowCount}:${endColumn}${rowCount}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
      },
    });
    return true;
  } catch (error) {
    console.error('Error adding practical task:', error);
    return false;
  }
};

/**
 * Update a practical task
 * Splits long text across multiple cells to handle Google Sheets 50,000 character limit
 */
export const updatePracticalTask = async (
  technologyName: string,
  rowIndex: number,
  taskData: { question: string; answer: string; image?: string }
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient();
    const actualRow = rowIndex + 2; // +2 for header and 0-indexing

    // Split all text fields into chunks if they exceed 50,000 characters
    const questionChunks = splitTextIntoChunks(taskData.question || '');
    const answerChunks = splitTextIntoChunks(taskData.answer || '');
    const imageChunks = splitTextIntoChunks(taskData.image || '');

    // Build the row array: [Serial, Q1, A1, I1, Q2, A2, I2, ...]
    const rowData: any[] = [
      rowIndex + 1, // Serial number (A)
    ];

    // Add chunks in groups: [Q, A, I] for each chunk index
    const maxChunks = Math.max(
      questionChunks.length,
      answerChunks.length,
      imageChunks.length
    );

    for (let i = 0; i < maxChunks; i++) {
      rowData.push(questionChunks[i] || ''); // Question chunk
      rowData.push(answerChunks[i] || ''); // Answer chunk
      rowData.push(imageChunks[i] || ''); // Image chunk
    }

    // Determine the end column based on how many chunks we have
    const endColumn = getColumnLetter(rowData.length - 1);
    const range = `${technologyName}!A${actualRow}:${endColumn}${actualRow}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
      },
    });
    return true;
  } catch (error) {
    console.error('Error updating practical task:', error);
    return false;
  }
};

/**
 * Delete a practical task
 */
export const deletePracticalTask = async (
  technologyName: string,
  rowIndex: number,
  accessToken: string | null = null
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(accessToken);
    const actualRow = rowIndex + 2; // +2 for header and 0-indexing

    // Get the sheet ID for the technology
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
    });
    const sheet = spreadsheet.data.sheets?.find(
      (s: any) => s.properties.title === technologyName
    );
    if (!sheet) {
      console.error(`Sheet ${technologyName} not found`);
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
                dimension: 'ROWS',
                startIndex: actualRow - 1,
                endIndex: actualRow,
              },
            },
          },
        ],
      },
    });

    // Update serial numbers for remaining rows
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
      range: `${technologyName}!A2:Z1000`,
    });
    const rows = response.data.values || [];
    
    if (rows.length > 0) {
      const updateRequests = rows.map((row: any[], index: number) => {
        const newSerial = index + 1;
        return {
          range: `${technologyName}!A${index + 2}`,
          values: [[newSerial]],
        };
      });

      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
        requestBody: {
          valueInputOption: 'RAW',
          data: updateRequests,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error deleting practical task:', error);
    return false;
  }
};

/**
 * Reorder practical tasks
 */
export const reorderPracticalTasks = async (
  technologyName: string,
  oldIndex: number,
  newIndex: number
): Promise<boolean> => {
  try {
    // Handle no-op case
    if (oldIndex === newIndex) {
      return true;
    }

    const sheetsClient = getSheetsClient();
    
    // Get the sheet ID for the technology
    const spreadsheet = await sheetsClient.spreadsheets.get({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
    });
    const sheet = spreadsheet.data.sheets?.find(
      (s: any) => s.properties.title === technologyName
    );
    if (!sheet) {
      console.error(`Sheet ${technologyName} not found`);
      return false;
    }
    const sheetId = sheet.properties.sheetId;

    // Convert indices to actual row numbers (accounting for header row)
    // In 0-based indexing: row 0 is header, row 1 is first data row
    const oldRowNumber = oldIndex + 1; // +1 to account for header
    const newRowNumber = newIndex + 1; // +1 to account for header

    // Move the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
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

    // Update serial numbers for all tasks after the move
    const updatedTasks = await getPracticalTasksByTechnology(technologyName);
    
    // Build updates for serial numbers in column A
    const updates = updatedTasks.map((task, index) => ({
      range: `${technologyName}!A${index + 2}`, // +2 for header and 1-based index
      values: [[index + 1]], // Serial number
    }));

    // Batch update all serial numbers
    if (updates.length > 0) {
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_IDS.PRACTICAL_TASKS,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error reordering practical tasks:', error);
    return false;
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

