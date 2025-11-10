/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
import jwt from 'jsonwebtoken';
import { getServiceConfigValue } from '../config/googleConfig.js';
import { getGoogleToken } from '../services/googleTokenStore.js';

const getJwtSecret = () => getServiceConfigValue('JWT_SECRET');

export const authenticateToken = (req, res, next) => {
  const jwtSecret = getJwtSecret();

  if (!jwtSecret) {
    console.error('JWT secret is not configured in the Config sheet');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const authenticateGoogleToken = (req, res, next) => {
  let googleToken =
    req.headers['x-google-token'] ||
    (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!googleToken && req.user && req.user.email) {
    googleToken = getGoogleToken(req.user.email);
  }

  if (!googleToken) {
    return res
      .status(401)
      .json({ error: 'Google access token required for write operations' });
  }

  req.googleToken = googleToken;
  next();
};
