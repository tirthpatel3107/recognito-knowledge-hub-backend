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
import { getServiceConfigValue, loadPersistedConfig } from './config/googleConfig.js';
import { errorHandler } from './utils/errorHandler.js';

const app = express();

// Load persisted config from disk first (so JWT_SECRET is available after restarts)
await loadPersistedConfig();

const PORT = Number(getServiceConfigValue('PORT')) || 3001;
const NODE_ENV = getServiceConfigValue('NODE_ENV') || 'development';

// Initialize Google Sheets service (will be refreshed after config loads)
initializeGoogleSheets();

// CORS configuration - Allow all origins (no restrictions)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // Log CORS requests for debugging
  if (req.method === 'OPTIONS' || req.method === 'POST') {
    console.log(`[CORS] ${req.method} request from origin: ${origin || 'none'}`);
  }

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    // Allow any origin - set to requesting origin (required when credentials are true)
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Google-Token, X-Requested-With, Accept, Cache-Control, Pragma, Expires'
    );
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    console.log(`[CORS] ✓ Preflight approved for origin: ${origin || 'all'}`);
    return res.status(200).end();
  }

  // For non-OPTIONS requests, set CORS headers to allow any origin
  // Note: When credentials are true, we must set specific origin, not '*'
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Authorization');

  next();
});

// Disable ETags to prevent 304 responses - we always want status 200 with actual data
app.set('etag', false);

// Middleware to add cache-control headers to prevent 304 responses
app.use((req: Request, res: Response, next: NextFunction) => {
  // Always set cache-control headers to prevent 304 responses
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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

