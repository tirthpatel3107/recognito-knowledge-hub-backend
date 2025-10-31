/**
 * Practical Tasks Routes
 */
import express from 'express';
import { getPracticalTasks } from '../services/googleSheetsService.js';

const router = express.Router();

// Get all practical tasks (read-only)
router.get('/', async (req, res) => {
  try {
    const tasks = await getPracticalTasks();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching practical tasks:', error);
    res.status(500).json({ error: 'Failed to fetch practical tasks' });
  }
});

export default router;
