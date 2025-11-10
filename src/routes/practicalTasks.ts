/**
 * Practical Tasks Routes
 */
import express from 'express';
import * as practicalTasksController from '../controllers/practicalTasksController';

const router = express.Router();

// Get all practical tasks (read-only, but supports OAuth if available)
router.get('/', practicalTasksController.getAllPracticalTasks);

export default router;

