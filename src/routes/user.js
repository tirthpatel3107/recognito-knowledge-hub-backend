/**
 * User Preferences Routes
 */
import express from 'express';
import {
  getDashboardCardOrder,
  saveDashboardCardOrder,
  getUserMode,
  updateUserMode,
} from '../services/googleSheetsService.js';
import { authenticateToken, authenticateGoogleToken } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard card order
router.get('/dashboard-order', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    const cardOrder = await getDashboardCardOrder(email);
    res.json(cardOrder);
  } catch (error) {
    console.error('Error fetching dashboard card order:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard card order' });
  }
});

// Save dashboard card order
router.post(
  '/dashboard-order',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      const email = req.user.email;
      const { cardOrder } = req.body;

      if (!Array.isArray(cardOrder)) {
        return res.status(400).json({ error: 'cardOrder must be an array' });
      }

      const success = await saveDashboardCardOrder(email, cardOrder);

      if (success) {
        res.json({
          success: true,
          message: 'Dashboard card order saved successfully',
        });
      } else {
        res.status(500).json({ error: 'Failed to save dashboard card order' });
      }
    } catch (error) {
      console.error('Error saving dashboard card order:', error);
      res.status(500).json({ error: 'Failed to save dashboard card order' });
    }
  }
);

// Get user mode preference
router.get('/mode', authenticateToken, async (req, res) => {
  try {
    const email = req.user.email;
    const mode = await getUserMode(email);
    res.json({ mode: mode || 'Light' });
  } catch (error) {
    console.error('Error fetching user mode:', error);
    res.status(500).json({ error: 'Failed to fetch user mode' });
  }
});

// Update user mode preference
router.post(
  '/mode',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      const email = req.user.email;
      const { mode } = req.body;

      if (!mode || !['Light', 'Dark'].includes(mode)) {
        return res.status(400).json({ error: 'Mode must be Light or Dark' });
      }

      const success = await updateUserMode(email, mode);

      if (success) {
        res.json({ success: true, message: 'User mode updated successfully' });
      } else {
        res.status(500).json({ error: 'Failed to update user mode' });
      }
    } catch (error) {
      console.error('Error updating user mode:', error);
      res.status(500).json({ error: 'Failed to update user mode' });
    }
  }
);

export default router;
