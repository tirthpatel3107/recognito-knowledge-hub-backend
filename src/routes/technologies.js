/**
 * Technologies Routes
 */
import express from 'express';
import {
  getTechnologies,
  createTechnology,
  updateTechnology,
  deleteTechnology,
  reorderTechnologies,
  setUserCredentials,
} from '../services/googleSheetsService.js';
import { authenticateToken, authenticateGoogleToken } from '../middleware/auth.js';

const router = express.Router();

// Get all technologies (read-only, no auth needed)
router.get('/', async (req, res) => {
  try {
    const technologies = await getTechnologies();
    res.json(technologies);
  } catch (error) {
    console.error('Error fetching technologies:', error);
    res.status(500).json({ error: 'Failed to fetch technologies' });
  }
});

// Create technology (requires Google auth)
router.post(
  '/',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Technology name is required' });
      }

      const success = await createTechnology(name);

      if (success) {
        res.json({ success: true, message: 'Technology created successfully' });
      } else {
        res.status(500).json({ error: 'Failed to create technology' });
      }
    } catch (error) {
      console.error('Error creating technology:', error);
      res.status(500).json({ error: 'Failed to create technology' });
    }
  }
);

// Update technology (requires Google auth)
router.put(
  '/:sheetId',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { sheetId } = req.params;
      const { oldName, newName } = req.body;

      if (!oldName || !newName) {
        return res
          .status(400)
          .json({ error: 'Old name and new name are required' });
      }

      const success = await updateTechnology(
        oldName,
        newName,
        parseInt(sheetId)
      );

      if (success) {
        res.json({ success: true, message: 'Technology updated successfully' });
      } else {
        res.status(500).json({ error: 'Failed to update technology' });
      }
    } catch (error) {
      console.error('Error updating technology:', error);
      res.status(500).json({ error: 'Failed to update technology' });
    }
  }
);

// Delete technology (requires Google auth)
router.delete(
  '/:sheetId',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { sheetId } = req.params;

      const success = await deleteTechnology(parseInt(sheetId));

      if (success) {
        res.json({ success: true, message: 'Technology deleted successfully' });
      } else {
        res.status(500).json({ error: 'Failed to delete technology' });
      }
    } catch (error) {
      console.error('Error deleting technology:', error);
      res.status(500).json({ error: 'Failed to delete technology' });
    }
  }
);

// Reorder technologies (requires Google auth)
router.post(
  '/reorder',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { technologyIds } = req.body;

      if (!Array.isArray(technologyIds)) {
        return res
          .status(400)
          .json({ error: 'technologyIds must be an array' });
      }

      const success = await reorderTechnologies(technologyIds);

      if (success) {
        res.json({ success: true, message: 'Technologies reordered successfully' });
      } else {
        res.status(500).json({ error: 'Failed to reorder technologies' });
      }
    } catch (error) {
      console.error('Error reordering technologies:', error);
      res.status(500).json({ error: 'Failed to reorder technologies' });
    }
  }
);

export default router;
