/**
 * Practical Tasks Routes
 */
import express from 'express';
import { getPracticalTasks } from '../services/googleSheetsService.js';
import { getGoogleToken } from '../services/googleTokenStore.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all practical tasks (read-only, but supports OAuth if available)
router.get('/', async (req, res) => {
  try {
    // Try to get Google OAuth token for authenticated access to private sheets
    const googleToken = req.headers['x-google-token'] || (req.user?.email ? getGoogleToken(req.user.email) : null);
    const tasks = await getPracticalTasks(googleToken);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching practical tasks:', error);
    res.status(500).json({ error: 'Failed to fetch practical tasks' });
  }
});

export default router;
