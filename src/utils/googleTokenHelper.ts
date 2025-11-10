/**
 * Google Token Helper Utility
 * Common utility for extracting Google tokens from requests
 */
import { Request } from 'express';
import { getGoogleToken } from '../services/googleTokenStore';

/**
 * Get Google token from request headers or user's stored token
 */
export const getGoogleTokenFromRequest = (req: Request): string | null => {
  // Try to get from x-google-token header first
  const headerToken = req.headers['x-google-token'] as string | undefined;
  if (headerToken) {
    return headerToken;
  }

  // Try to get from stored token if user is authenticated
  if (req.user?.email) {
    return getGoogleToken(req.user.email);
  }

  return null;
};

