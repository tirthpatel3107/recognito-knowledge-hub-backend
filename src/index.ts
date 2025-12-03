/**
 * Main Server Entry Point
 */
import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables (LOGIN_SPREADSHEET_ID lives here)
// Use explicit path resolution to ensure .env is loaded from the correct directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the backend root directory (parent of src)
const envPath = join(__dirname, "..", ".env");
console.log(`[Backend] Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

// Verify LOGIN_SPREADSHEET_ID is loaded
if (!process.env?.LOGIN_SPREADSHEET_ID) {
  console.warn(
    `[Backend] WARNING: LOGIN_SPREADSHEET_ID is not set in environment variables`,
  );
  console.warn(`[Backend] Looking for .env file at: ${envPath}`);
  console.warn(
    `[Backend] Please ensure .env file exists and contains LOGIN_SPREADSHEET_ID`,
  );
} else {
  console.log(`[Backend] LOGIN_SPREADSHEET_ID loaded from .env file`);
}

// Import routes
import authRoutes from "./routes/auth.js";
import technologiesRoutes from "./routes/technologies.js";
import questionsRoutes from "./routes/questions.js";
import projectsRoutes from "./routes/projects.js";
import workSummaryRoutes from "./routes/workSummary.js";
import practicalTasksRoutes from "./routes/practicalTasks.js";
import practicalTaskTechnologiesRoutes from "./routes/practicalTaskTechnologies.js";
import userRoutes from "./routes/user.js";
import tagsRoutes from "./routes/tags.js";
import kanbanRoutes from "./routes/kanban.js";
import notesRoutes from "./routes/notes.js";

// Import services to initialize
import { initializeGoogleSheets } from "./services/googleSheets/index.js";
import { getServiceConfigValue } from "./config/googleConfig.js";
import { errorHandler } from "./utils/errorHandler.js";
import {
  securityHeaders,
  customSecurityHeaders,
} from "./middleware/securityHeaders.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

const app = express();

const PORT = Number(getServiceConfigValue("PORT")) || 3001;

// Initialize Google Sheets service (will be refreshed after config loads)
console.log(`[Backend] Initializing Google Sheets service...`);
try {
  initializeGoogleSheets();
  console.log(`[Backend] Google Sheets service initialized successfully`);
} catch (error) {
  console.error(
    `[Backend] ERROR: Failed to initialize Google Sheets service:`,
    error,
  );
  throw error;
}

// CORS configuration - Allow all origins (no restrictions)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Google-Token, X-Requested-With, Accept, Cache-Control, Pragma, Expires",
    );
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
    return res.status(200).end();
  }

  // For non-OPTIONS requests, set CORS headers
  // Note: When credentials are true, we must set specific origin, not '*'
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Expose-Headers", "Content-Type, Authorization");

  next();
});

// Security headers middleware (must be early in the middleware chain)
app.use(securityHeaders);
app.use(customSecurityHeaders);

// Disable ETags to prevent 304 responses - we always want status 200 with actual data
app.set("etag", false);

// Middleware to add cache-control headers to prevent 304 responses
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Apply rate limiting to all API routes
app.use("/api", apiLimiter);

// Increase body size limit to handle large base64 images (10MB limit)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", message: "Server is running" });
});

// API Routes
console.log(`[Backend] Registering API routes...`);
app.use("/api/auth", authRoutes);
app.use("/api/technologies", technologiesRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/work-summary", workSummaryRoutes);
app.use("/api/practical-tasks", practicalTasksRoutes);
app.use("/api/practical-task-technologies", practicalTaskTechnologiesRoutes);
app.use("/api/user", userRoutes);
app.use("/api/tags", tagsRoutes);
app.use("/api/kanban", kanbanRoutes);
app.use("/api/notes", notesRoutes);
console.log(`[Backend] All API routes registered successfully`);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler - ensure CORS headers are set even on errors
app.use(errorHandler);

// Start server
console.log(`[Backend] Starting server on port ${PORT}...`);
try {
  app.listen(PORT, () => {
    console.log(`[Backend] ✅ Server started successfully!`);
    console.log(`[Backend] Server is running on http://localhost:${PORT}`);
    console.log(
      `[Backend] Health check available at http://localhost:${PORT}/health`,
    );
  });
} catch (error) {
  console.error(`[Backend] ❌ ERROR: Failed to start server:`, error);
  process.exit(1);
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error(`[Backend] ❌ UNCAUGHT EXCEPTION:`, error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    `[Backend] ❌ UNHANDLED REJECTION at:`,
    promise,
    `reason:`,
    reason,
  );
  process.exit(1);
});
