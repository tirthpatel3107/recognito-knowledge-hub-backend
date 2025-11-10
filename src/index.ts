/**
 * Main Server Entry Point
 */
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables (LOGIN_SPREADSHEET_ID lives here)
// Use explicit path resolution to ensure .env is loaded from the correct directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the backend root directory (parent of src)
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Verify LOGIN_SPREADSHEET_ID is loaded
if (!process.env.LOGIN_SPREADSHEET_ID) {
  console.warn('⚠️  WARNING: LOGIN_SPREADSHEET_ID is not set in environment variables.');
  console.warn(`   Looking for .env file at: ${envPath}`);
  console.warn('   Please ensure .env file exists and contains LOGIN_SPREADSHEET_ID');
} else {
  console.log('✅ LOGIN_SPREADSHEET_ID loaded from .env file');
}

// Import routes
import authRoutes from './routes/auth.js';
import technologiesRoutes from './routes/technologies.js';
import questionsRoutes from './routes/questions.js';
import projectsRoutes from './routes/projects.js';
import workSummaryRoutes from './routes/workSummary.js';
import practicalTasksRoutes from './routes/practicalTasks.js';
import userRoutes from './routes/user.js';

// Import services to initialize
import { initializeGoogleSheets } from './services/googleSheetsService.js';
import { getServiceConfigValue } from './config/googleConfig.js';
import { errorHandler } from './utils/errorHandler.js';

const app = express();
const PORT = Number(getServiceConfigValue('PORT')) || 3001;
const NODE_ENV = getServiceConfigValue('NODE_ENV') || 'development';

// Initialize Google Sheets service (will be refreshed after config loads)
initializeGoogleSheets();

// Dynamic CORS middleware that reads from config (allows config to be loaded after server starts)
// Default allowed origins before config is loaded from Google Sheet
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

// Get allowed origins (dynamic based on config)
const getAllowedOrigins = (): string[] => {
  try {
    const configuredOrigin = getServiceConfigValue('FRONTEND_URL') as string;
    const nodeEnv = getServiceConfigValue('NODE_ENV') || 'development';

    if (configuredOrigin && configuredOrigin.trim()) {
      const origin = configuredOrigin.trim();
      console.log(`[CORS] Using configured origin: ${origin}`);

      // In development mode, also allow common localhost origins for flexibility
      // This helps when frontend port changes or multiple dev servers are running
      if (nodeEnv === 'development' || nodeEnv === 'dev') {
        const developmentOrigins = [
          origin, // Primary configured origin
          ...DEFAULT_ALLOWED_ORIGINS.filter((o) => o !== origin), // Other localhost origins
        ];
        console.log(
          `[CORS] Development mode: Allowing multiple localhost origins: ${developmentOrigins.join(', ')}`
        );
        return developmentOrigins;
      }

      // In production, only allow the configured origin
      return [origin];
    }
  } catch (error) {
    console.error('[CORS] Error reading FRONTEND_URL from config:', error);
  }

  // Return default origins if config not loaded yet
  console.log(
    `[CORS] Using default origins (config not loaded): ${DEFAULT_ALLOWED_ORIGINS.join(', ')}`
  );
  return DEFAULT_ALLOWED_ORIGINS;
};

// Normalize origin for comparison (trim, lowercase)
const normalizeOrigin = (origin: string | undefined): string | null => {
  if (!origin) return null;
  return origin.trim().toLowerCase();
};

// CORS configuration with dynamic origin support
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  const configuredOrigin = getServiceConfigValue('FRONTEND_URL') as string;

  // Normalize for comparison
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedAllowedOrigins = allowedOrigins.map(normalizeOrigin);

  // Log CORS checks for debugging
  if (req.method === 'OPTIONS' || req.method === 'POST') {
    console.log(`[CORS] ${req.method} request from origin: ${origin || 'none'}`);
    console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
    console.log(`[CORS] Normalized origin: ${normalizedOrigin || 'none'}`);
    console.log(`[CORS] Is allowed: ${!origin || normalizedAllowedOrigins.includes(normalizedOrigin)}`);
  }

  // Check if origin is allowed (allow requests with no origin for same-origin requests)
  const isOriginAllowed = !origin || normalizedAllowedOrigins.includes(normalizedOrigin);

  // Handle preflight OPTIONS requests first
  if (req.method === 'OPTIONS') {
    if (isOriginAllowed) {
      // Set CORS headers for allowed origin
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        if (!configuredOrigin) {
          console.log(`[CORS] ✓ Preflight approved for origin ${origin} (config not loaded yet)`);
        } else {
          console.log(
            `[CORS] ✓ Preflight approved for origin ${origin} (matches configured: ${configuredOrigin})`
          );
        }
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Google-Token, X-Requested-With, Accept'
      );
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      return res.status(200).end();
    } else {
      // Origin not allowed - respond without CORS headers (browser will block)
      console.warn(
        `[CORS] ✗ Preflight blocked for origin: ${origin} (allowed: ${allowedOrigins.join(', ')})`
      );
      return res.status(403).end();
    }
  }

  // For non-OPTIONS requests, set CORS headers if origin is allowed
  if (isOriginAllowed) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Authorization');
  } else {
    console.warn(
      `[CORS] ✗ Request blocked for origin: ${origin} (allowed: ${allowedOrigins.join(', ')})`
    );
    // Don't set CORS headers - browser will block the response
  }

  next();
});

// Increase body size limit to handle large base64 images (10MB limit)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/technologies', technologiesRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/work-summary', workSummaryRoutes);
app.use('/api/practical-tasks', practicalTasksRoutes);
app.use('/api/user', userRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler - ensure CORS headers are set even on errors
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});

