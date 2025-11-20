/**
 * Security Headers Middleware
 * Adds security headers to prevent common attacks
 */
import { Request, Response, NextFunction } from "express";
import helmet from "helmet";

// Configure helmet with security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some frontend frameworks
        "https://apis.google.com",
        "https://accounts.google.com",
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://www.googleapis.com",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com",
      ],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for Google OAuth iframes
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow Google resources
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  xssFilter: true,
  noSniff: true,
  frameguard: {
    action: "sameorigin", // Allow same-origin iframes (needed for OAuth)
  },
});

// Additional custom security headers
export const customSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // XSS Protection (legacy, but still useful)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );

  next();
};
