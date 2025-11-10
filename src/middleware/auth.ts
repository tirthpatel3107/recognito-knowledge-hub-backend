/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getServiceConfigValue } from '../config/googleConfig';
import { getGoogleToken } from '../services/googleTokenStore';

interface UserPayload {
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      googleToken?: string;
    }
  }
}

const getJwtSecret = (): string | null => {
  const secret = getServiceConfigValue('JWT_SECRET');
  return typeof secret === 'string' ? secret : null;
};

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const jwtSecret = getJwtSecret();

  if (!jwtSecret) {
    console.error('JWT secret is not configured in the Config sheet');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const authenticateGoogleToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let googleToken =
    (req.headers['x-google-token'] as string) ||
    (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!googleToken && req.user && req.user.email) {
    googleToken = getGoogleToken(req.user.email) || undefined;
  }

  if (!googleToken) {
    res
      .status(401)
      .json({ error: 'Google access token required for write operations' });
    return;
  }

  req.googleToken = googleToken;
  next();
};

