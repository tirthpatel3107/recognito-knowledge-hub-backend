/**
 * Authentication Routes
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateUser } from '../services/googleSheetsService.js';
import { setUserCredentials } from '../services/googleSheetsService.js';
import { GOOGLE_CONFIG } from '../config/googleConfig.js';
import { google } from 'googleapis';

const router = express.Router();

// Login with email and password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required' });
    }

    const isValid = await authenticateUser(email, password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

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
    const { accessToken, expectedEmail } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    // Verify token with Google
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CONFIG.CLIENT_ID,
      GOOGLE_CONFIG.CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const googleEmail = userInfo.data.email;

    // If expected email provided, verify it matches
    if (expectedEmail && googleEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
      return res.status(403).json({
        error: 'Email mismatch',
        expected: expectedEmail,
        received: googleEmail,
      });
    }

    // Set user credentials for subsequent API calls
    setUserCredentials(accessToken);

    res.json({
      success: true,
      email: googleEmail,
      message: 'Google authentication verified',
    });
  } catch (error) {
    console.error('Google verification error:', error);
    res.status(401).json({ error: 'Invalid Google access token' });
  }
});

// Refresh token endpoint (if needed)
router.post('/refresh', (req, res) => {
  // TODO: Implement token refresh logic if needed
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
