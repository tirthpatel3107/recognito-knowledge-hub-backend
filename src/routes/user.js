/**
 * User Preferences Routes
 */
import express from 'express';
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
} from '../services/googleSheetsService.js';
import { authenticateToken, authenticateGoogleToken } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard card order
router.get('/dashboard-order', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    const cardOrder = await getDashboardCardOrder(email);
    res.json(cardOrder);
  } catch (error) {
    console.error('Error fetching dashboard card order:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard card order' });
  }
});

// Save dashboard card order
router.post(
  '/dashboard-order',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      const email = req.user.email;
      const { cardOrder } = req.body;

      if (!Array.isArray(cardOrder)) {
        return res.status(400).json({ error: 'cardOrder must be an array' });
      }

      const success = await saveDashboardCardOrder(email, cardOrder);

      if (success) {
        res.json({
          success: true,
          message: 'Dashboard card order saved successfully',
        });
      } else {
        res.status(500).json({ error: 'Failed to save dashboard card order' });
      }
    } catch (error) {
      console.error('Error saving dashboard card order:', error);
      res.status(500).json({ error: 'Failed to save dashboard card order' });
    }
  }
);

// Get user mode preference
router.get('/mode', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    const mode = await getUserMode(email);
    res.json({ mode: mode || 'Light' });
  } catch (error) {
    console.error('Error fetching user mode:', error);
    res.status(500).json({ error: 'Failed to fetch user mode' });
  }
});

// Update user mode preference
router.post(
  '/mode',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const email = req.user.email;
      let { mode } = req.body;

      console.log('Updating user mode:', { email, mode, body: req.body });

      // Normalize mode to handle case-insensitive input
      if (mode && typeof mode === 'string') {
        mode = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
      }

      if (!mode || !['Light', 'Dark'].includes(mode)) {
        return res.status(400).json({ 
          error: 'Mode must be Light or Dark',
          received: mode 
        });
      }

      const success = await updateUserMode(email, mode);

      if (success) {
        res.json({ success: true, message: 'User mode updated successfully' });
      } else {
        console.error('updateUserMode returned false');
        res.status(500).json({ 
          error: 'Failed to update user mode',
          details: 'updateUserMode function returned false'
        });
      }
    } catch (error) {
      console.error('Error updating user mode:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: 'Failed to update user mode',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Get user profile (username and email from Sheet1)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    const profile = await getUserProfile(email);
    res.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile (username and photo in Sheet1)
router.post(
  '/profile',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const email = req.user.email;
      const { username, photo } = req.body;

      // Username is optional (can be updated separately), but validate if provided
      if (username !== undefined && username !== null && username.trim() === '') {
        return res.status(400).json({ error: 'Username cannot be empty' });
      }

      // Validate photo size if provided (base64 images can be large)
      if (photo !== undefined && photo !== null && photo !== '') {
        // Check if it's a base64 data URL
        if (photo.startsWith('data:')) {
          // Google Sheets cell limit is ~50,000 characters
          if (photo.length > 50000) {
            return res.status(400).json({ 
              error: 'Photo is too large. Please use a smaller image (max ~37KB base64)' 
            });
          }
        }
      }

      const success = await updateUserProfile(
        email,
        username !== undefined ? username.trim() : undefined,
        photo !== undefined ? photo : null
      );

      if (success) {
        res.json({
          success: true,
          message: 'Profile updated successfully',
        });
      } else {
        res.status(500).json({ error: 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      // Provide more detailed error message
      const errorMessage = error.message || 'Failed to update user profile';
      res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Change user password
router.post(
  '/password',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const email = req.user.email;
      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must be different from current password' });
      }

      const success = await updateUserPassword(email, currentPassword, newPassword);

      if (success) {
        res.json({
          success: true,
          message: 'Password changed successfully',
        });
      } else {
        res.status(500).json({ error: 'Failed to change password' });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      // Provide specific error message for incorrect password
      const errorMessage = error.message || 'Failed to change password';
      const statusCode = error.message === 'Current password is incorrect' ? 401 : 500;
      res.status(statusCode).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Get user color palette preference
router.get('/color-palette', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    const palette = await getUserColorPalette(email);
    res.json(palette);
  } catch (error) {
    console.error('Error fetching user color palette:', error);
    res.status(500).json({ error: 'Failed to fetch user color palette' });
  }
});

// Update user color palette preference
router.post(
  '/color-palette',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      const email = req.user.email;
      const { lightModeColor, darkModeColor } = req.body;

      // Validate colors are strings (HSL format: "hue saturation% lightness%")
      // Allow null/empty to reset to default
      if (lightModeColor !== undefined && lightModeColor !== null && typeof lightModeColor !== 'string') {
        return res.status(400).json({ error: 'lightModeColor must be a string or null' });
      }
      if (darkModeColor !== undefined && darkModeColor !== null && typeof darkModeColor !== 'string') {
        return res.status(400).json({ error: 'darkModeColor must be a string or null' });
      }

      // Convert empty strings to null, but preserve null values
      const lightColorValue = lightModeColor === null || lightModeColor === undefined || lightModeColor === '' ? null : lightModeColor;
      const darkColorValue = darkModeColor === null || darkModeColor === undefined || darkModeColor === '' ? null : darkModeColor;

      const success = await updateUserColorPalette(
        email,
        lightColorValue,
        darkColorValue,
        req.googleToken
      );

      if (success) {
        res.json({ success: true, message: 'Color palette updated successfully' });
      } else {
        res.status(500).json({ error: 'Failed to update color palette' });
      }
    } catch (error) {
      console.error('Error updating user color palette:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      const errorMessage = error.message || 'Failed to update user color palette';
      res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.response?.data : undefined
      });
    }
  }
);

export default router;
