/**
 * Main Server Entry Point
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize Google Sheets service
initializeGoogleSheets();

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req, res) => {
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
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
