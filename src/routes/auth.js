/**
 * Authentication Routes
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import {
  authenticateUser,
  updateUserPhotoFromGoogle,
  setUserCredentials,
  initializeGoogleSheets,
} from '../services/googleSheetsService.js';
import { loadConfigFromSheet } from '../config/sheetConfigLoader.js';
import {
  GOOGLE_CONFIG,
  getServiceConfigValue,
  requireServiceConfigValue,
} from '../config/googleConfig.js';
import { storeGoogleToken } from '../services/googleTokenStore.js';

const router = express.Router();

const extractTokenTtl = (accessTokenExpiresIn, expiresIn) => {
  if (typeof accessTokenExpiresIn === 'number') {
    return accessTokenExpiresIn;
  }
  if (typeof expiresIn === 'number') {
    return expiresIn;
  }
  return null;
};

// Login with email, password, and one-time Google OAuth token
router.post('/login', async (req, res) => {
  try {
    const { email, password, googleAccessToken, accessTokenExpiresIn, expiresIn } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!googleAccessToken) {
      return res.status(400).json({ error: 'Google access token is required for login' });
    }

    const isValid = await authenticateUser(email, password, googleAccessToken);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await loadConfigFromSheet(googleAccessToken);

    initializeGoogleSheets();

    const tokenTtlSeconds = extractTokenTtl(accessTokenExpiresIn, expiresIn);
    storeGoogleToken(email, googleAccessToken, { expiresInSeconds: tokenTtlSeconds });

    const jwtSecret = requireServiceConfigValue('JWT_SECRET');
    const jwtExpiresIn = getServiceConfigValue('JWT_EXPIRES_IN') || '24h';

    const token = jwt.sign({ email }, jwtSecret, { expiresIn: jwtExpiresIn });

    res.json({
      success: true,
      token,
      email,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Google OAuth token and get user info
router.post('/google/verify', async (req, res) => {
  try {
    const { accessToken, expectedEmail, accessTokenExpiresIn, expiresIn } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    // First, verify the token by calling Google's userinfo API directly
    // This doesn't require CLIENT_ID/CLIENT_SECRET - just the access token
    let googleEmail;
    let googlePhoto;
    
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('Google userinfo API error:', errorText);
        return res.status(401).json({ error: 'Invalid Google access token' });
      }

      const userInfo = await userInfoResponse.json();
      googleEmail = userInfo.email;
      googlePhoto = userInfo.picture || '';

      // Verify email matches if expected
      if (expectedEmail && googleEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
        return res.status(403).json({
          error: 'Email mismatch',
          expected: expectedEmail,
          received: googleEmail,
        });
      }
    } catch (tokenError) {
      console.error('Error verifying Google token:', tokenError);
      return res.status(401).json({ error: 'Invalid Google access token' });
    }

    // Now load config from the sheet using the verified token
    try {
      await loadConfigFromSheet(accessToken);
      initializeGoogleSheets();
    } catch (configError) {
      console.error('Error loading config from sheet:', configError);
      // If config loading fails, we can still proceed but log the error
      // The token is valid, so we can store it and return success
    }

    // Store the token for future use
    const tokenTtlSeconds = extractTokenTtl(accessTokenExpiresIn, expiresIn);
    storeGoogleToken(googleEmail, accessToken, { expiresInSeconds: tokenTtlSeconds });

    // Set user credentials for Google Sheets API (if config was loaded)
    try {
      setUserCredentials(accessToken);
    } catch (credError) {
      console.warn('Could not set user credentials (config may not be loaded):', credError);
    }

    // Try to update user photo (optional, don't fail if this errors)
    if (googlePhoto) {
      try {
        await updateUserPhotoFromGoogle(googleEmail, googlePhoto, accessToken);
      } catch (photoError) {
        console.error('Error saving Google photo to sheet:', photoError);
        // Don't fail the request if photo update fails
      }
    }

    res.json({
      success: true,
      email: googleEmail,
      picture: googlePhoto,
      message: 'Google authentication verified',
    });
  } catch (error) {
    console.error('Google verification error:', error);
    res.status(500).json({ error: 'Internal server error during Google verification' });
  }
});

// Refresh token endpoint (if needed)
router.post('/refresh', (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
