/**
 * User Controller
 * Handles user preferences and profile operations
 */
import { Request, Response } from 'express';
import {
  getDashboardCardOrder,
  saveDashboardCardOrder,
  getUserMode,
  updateUserMode,
  getUserProfile,
  updateUserProfile,
  updateUserPassword,
  setUserCredentials,
  getUserColorPalette,
  updateUserColorPalette,
} from '../services/googleSheetsService';
import { getGoogleToken } from '../services/googleTokenStore';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError, sendValidationError, sendUnauthorized } from '../utils/responseHelper';
import { getGoogleTokenFromRequest } from '../utils/googleTokenHelper';

/**
 * Get dashboard card order
 */
export const getDashboardCardOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user!.email;
  const googleToken = getGoogleTokenFromRequest(req);
  const cardOrder = await getDashboardCardOrder(email, googleToken);
  return sendSuccess(res, cardOrder);
});

/**
 * Save dashboard card order
 */
export const saveDashboardCardOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user!.email;
  const googleToken = getGoogleTokenFromRequest(req);
  const { cardOrder } = req.body;

  if (!Array.isArray(cardOrder)) {
    return sendValidationError(res, 'cardOrder must be an array');
  }

  const success = await saveDashboardCardOrder(email, cardOrder, googleToken);

  if (success) {
    return sendSuccess(res, null, 'Dashboard card order saved successfully');
  } else {
    return sendError(res, 'Failed to save dashboard card order', 500);
  }
});

/**
 * Get user mode preference
 */
export const getUserModeHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user!.email;
  const googleToken = getGoogleTokenFromRequest(req);
  const mode = await getUserMode(email, googleToken);
  return sendSuccess(res, { mode: mode || 'Light' });
});

/**
 * Update user mode preference
 */
export const updateUserModeHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const email = req.user!.email;
  let { mode } = req.body;

  console.log('Updating user mode:', { email, mode, body: req.body });

  // Normalize mode to handle case-insensitive input
  if (mode && typeof mode === 'string') {
    mode = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
  }

  if (!mode || !['Light', 'Dark'].includes(mode)) {
    return sendValidationError(res, 'Mode must be Light or Dark', { received: mode });
  }

  const success = await updateUserMode(email, mode);

  if (success) {
    return sendSuccess(res, null, 'User mode updated successfully');
  } else {
    console.error('updateUserMode returned false');
    return sendError(
      res,
      'Failed to update user mode',
      500,
      { details: 'updateUserMode function returned false' }
    );
  }
});

/**
 * Get user profile
 */
export const getUserProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user!.email;
  const googleToken = getGoogleTokenFromRequest(req);
  const profile = await getUserProfile(email, googleToken);
  return sendSuccess(res, profile);
});

/**
 * Update user profile
 */
export const updateUserProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user!.email;
  const googleToken = getGoogleTokenFromRequest(req);
  const { username, photo } = req.body;

  // Username is optional (can be updated separately), but validate if provided
  if (username !== undefined && username !== null && username.trim() === '') {
    return sendValidationError(res, 'Username cannot be empty');
  }

  try {
    const success = await updateUserProfile(
      email,
      username !== undefined ? username.trim() : undefined,
      photo !== undefined ? photo : null,
      googleToken
    );

    if (success) {
      return sendSuccess(res, null, 'Profile updated successfully');
    } else {
      return sendError(res, 'Failed to update profile', 500);
    }
  } catch (error) {
    console.error('Error in updateUserProfileHandler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
    return sendError(res, errorMessage, 500);
  }
});

/**
 * Change user password
 */
export const updateUserPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const email = req.user!.email;
  const { currentPassword, newPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword) {
    return sendValidationError(res, 'Current password and new password are required');
  }

  if (newPassword.length < 6) {
    return sendValidationError(res, 'New password must be at least 6 characters long');
  }

  if (currentPassword === newPassword) {
    return sendValidationError(res, 'New password must be different from current password');
  }

  try {
    const success = await updateUserPassword(email, currentPassword, newPassword);

    if (success) {
      return sendSuccess(res, null, 'Password changed successfully');
    } else {
      return sendError(res, 'Failed to change password', 500);
    }
  } catch (error: any) {
    // Provide specific error message for incorrect password
    const errorMessage = error.message || 'Failed to change password';
    const statusCode = error.message === 'Current password is incorrect' ? 401 : 500;
    return sendError(
      res,
      errorMessage,
      statusCode,
      { details: error.stack }
    );
  }
});

/**
 * Get user color palette preference
 */
export const getUserColorPaletteHandler = asyncHandler(async (req: Request, res: Response) => {
  const email = req.user!.email;
  const googleToken = getGoogleTokenFromRequest(req);
  const palette = await getUserColorPalette(email, googleToken);
  return sendSuccess(res, palette);
});

/**
 * Update user color palette preference
 */
export const updateUserColorPaletteHandler = asyncHandler(async (req: Request, res: Response) => {
  setUserCredentials(req.googleToken!);
  const email = req.user!.email;
  const { lightModeColor, darkModeColor } = req.body;

  // Validate colors are strings (HSL format: "hue saturation% lightness%")
  // Allow null/empty to reset to default
  if (lightModeColor !== undefined && lightModeColor !== null && typeof lightModeColor !== 'string') {
    return sendValidationError(res, 'lightModeColor must be a string or null');
  }
  if (darkModeColor !== undefined && darkModeColor !== null && typeof darkModeColor !== 'string') {
    return sendValidationError(res, 'darkModeColor must be a string or null');
  }

  // Convert empty strings to null, but preserve null values
  const lightColorValue = lightModeColor === null || lightModeColor === undefined || lightModeColor === '' ? null : lightModeColor;
  const darkColorValue = darkModeColor === null || darkModeColor === undefined || darkModeColor === '' ? null : darkModeColor;

  const success = await updateUserColorPalette(
    email,
    lightColorValue,
    darkColorValue,
    req.googleToken!
  );

  if (success) {
    return sendSuccess(res, null, 'Color palette updated successfully');
  } else {
    return sendError(res, 'Failed to update color palette', 500);
  }
});

