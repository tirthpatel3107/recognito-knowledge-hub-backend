/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  // Check if JWT_SECRET is configured
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const authenticateGoogleToken = (req, res, next) => {
  // Check for Google token in X-Google-Token header first, then Authorization
  const googleToken =
    req.headers['x-google-token'] ||
    (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!googleToken) {
    return res
      .status(401)
      .json({ error: 'Google access token required for write operations' });
  }

  // Store Google token in request for use in service layer
  req.googleToken = googleToken;
  next();
};
