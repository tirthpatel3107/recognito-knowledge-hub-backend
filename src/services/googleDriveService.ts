/**
 * Google Drive Service
 * Handles folder creation and file uploads to Google Drive
 */
import { google } from 'googleapis';
import { Readable } from 'stream';
import { GOOGLE_CONFIG } from '../config/googleConfig';
import { getGoogleToken } from './googleTokenStore';

// Base folder ID for Question Bank Images
const QUESTION_BANK_IMAGES_FOLDER_ID = '1SzaKkAhDuvPPjI352rg4FlxiG1gJEclS';

// Global OAuth2 client instance
import type { OAuth2Client } from 'google-auth-library';
let oauth2Client: OAuth2Client | null = null;
let currentAccessToken: string | null = null;

/**
 * Initialize Google Drive service
 */
export const initializeGoogleDrive = (): void => {
  if (!GOOGLE_CONFIG.CLIENT_ID || !GOOGLE_CONFIG.CLIENT_SECRET) {
    console.warn('Google Drive service not fully initialized - missing OAuth credentials');
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
 * Get Google Drive client
 */
const getDriveClient = (accessToken: string | null = null): any => {
  const token = accessToken || currentAccessToken;
  
  if (!token) {
    throw new Error('Google access token is required for Drive operations');
  }

  if (!oauth2Client) {
    initializeGoogleDrive();
  }

  if (oauth2Client) {
    oauth2Client.setCredentials({ access_token: token });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  throw new Error('Google Drive client not initialized');
};

/**
 * Find or create a folder by name in the parent folder
 */
export const findOrCreateFolder = async (
  folderName: string,
  parentFolderId: string = QUESTION_BANK_IMAGES_FOLDER_ID,
  accessToken: string | null = null
): Promise<string> => {
  try {
    const drive = getDriveClient(accessToken);

    // First, try to find the folder
    const searchResponse = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      // Folder exists, return its ID
      return searchResponse.data.files[0].id!;
    }

    // Folder doesn't exist, create it
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id, name',
    });

    if (!createResponse.data.id) {
      throw new Error('Failed to create folder: No ID returned');
    }

    return createResponse.data.id;
  } catch (error) {
    console.error('Error finding or creating folder:', error);
    throw error;
  }
};

/**
 * Upload an image file to Google Drive
 */
export const uploadImageToDrive = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
  accessToken: string | null = null
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> => {
  try {
    const drive = getDriveClient(accessToken);

    // Upload the file
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    // Convert Buffer to Stream for Google Drive API
    const stream = Readable.from(fileBuffer);

    const media = {
      mimeType: mimeType,
      body: stream,
    };

    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    if (!uploadResponse.data.id) {
      throw new Error('Failed to upload file: No ID returned');
    }

    // Make the file publicly viewable so images can be displayed
    try {
      // First, try to remove existing permissions to avoid conflicts
      try {
        const existingPermissions = await drive.permissions.list({
          fileId: uploadResponse.data.id,
        });
        
        // Remove any existing 'anyone' permissions first
        if (existingPermissions.data.permissions) {
          for (const perm of existingPermissions.data.permissions) {
            if (perm.type === 'anyone') {
              try {
                await drive.permissions.delete({
                  fileId: uploadResponse.data.id,
                  permissionId: perm.id!,
                });
              } catch (deleteError) {
                // Ignore delete errors
              }
            }
          }
        }
      } catch (listError) {
        // Ignore list errors, continue with creating permission
      }
      
      // Create public permission
      await drive.permissions.create({
        fileId: uploadResponse.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
      
      console.log(`✅ Set public permissions for file ${uploadResponse.data.id}`);
    } catch (permissionError) {
      console.warn('Warning: Could not set public permissions on file:', permissionError);
      // Continue even if permission setting fails - the file might still be accessible
    }

    // Use the direct image URL format that works best for embedding
    const directImageUrl = `https://drive.google.com/uc?export=view&id=${uploadResponse.data.id}`;

    return {
      fileId: uploadResponse.data.id,
      webViewLink: uploadResponse.data.webViewLink || `https://drive.google.com/file/d/${uploadResponse.data.id}/view`,
      webContentLink: directImageUrl, // Always use the direct format
    };
  } catch (error) {
    console.error('Error uploading image to Drive:', error);
    throw error;
  }
};

/**
 * Upload multiple images to a folder (organized by sheet name)
 */
export const uploadImagesForSheet = async (
  images: Array<{ buffer: Buffer; fileName: string; mimeType: string }>,
  sheetName: string,
  accessToken: string | null = null
): Promise<string[]> => {
  try {
    // Find or create folder for this sheet/technology
    const folderId = await findOrCreateFolder(sheetName, QUESTION_BANK_IMAGES_FOLDER_ID, accessToken);

    // Upload all images
    const uploadPromises = images.map((image) =>
      uploadImageToDrive(image.buffer, image.fileName, image.mimeType, folderId, accessToken)
    );

    const results = await Promise.all(uploadPromises);

    // Return web content links (direct image URLs)
    return results.map((result) => result.webContentLink);
  } catch (error) {
    console.error('Error uploading images for sheet:', error);
    throw error;
  }
};

/**
 * Extract file ID from Google Drive URL
 * Handles different Google Drive URL formats
 */
export const extractFileIdFromUrl = (url: string): string | null => {
  if (!url) return null;
  
  // Format 1: https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return fileMatch[1];
  }
  
  // Format 2: https://drive.google.com/uc?export=view&id=FILE_ID
  // Format 3: https://drive.google.com/uc?export=download&id=FILE_ID
  // Format 4: https://drive.google.com/open?id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return idMatch[1];
  }
  
  return null;
};

/**
 * Delete a file from Google Drive by file ID
 */
export const deleteFileFromDrive = async (
  fileId: string,
  accessToken: string | null = null
): Promise<boolean> => {
  try {
    const drive = getDriveClient(accessToken);
    
    await drive.files.delete({
      fileId: fileId,
    });
    
    return true;
  } catch (error) {
    console.error(`Error deleting file ${fileId} from Drive:`, error);
    // Don't throw - continue even if one file deletion fails
    return false;
  }
};

/**
 * Delete multiple files from Google Drive by their URLs
 */
export const deleteFilesFromDrive = async (
  imageUrls: string[],
  accessToken: string | null = null
): Promise<void> => {
  if (!imageUrls || imageUrls.length === 0) {
    return;
  }

  try {
    // Extract file IDs from URLs
    const fileIds = imageUrls
      .map(url => extractFileIdFromUrl(url))
      .filter((id): id is string => id !== null);

    if (fileIds.length === 0) {
      console.warn('No valid file IDs found in image URLs');
      return;
    }

    // Delete all files in parallel
    const deletePromises = fileIds.map(fileId => 
      deleteFileFromDrive(fileId, accessToken)
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter(r => r === true).length;
    
    console.log(`Deleted ${successCount}/${fileIds.length} image files from Drive`);
  } catch (error) {
    console.error('Error deleting files from Drive:', error);
    // Don't throw - continue with question deletion even if image deletion fails
  }
};

