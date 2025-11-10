/**
 * Questions Routes
 */
import express from 'express';
import {
  getQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  getTechnologies,
  setUserCredentials,
} from '../services/googleSheetsService.js';
import { authenticateToken, authenticateGoogleToken } from '../middleware/auth.js';
import { getGoogleToken } from '../services/googleTokenStore.js';

const router = express.Router();

// Get questions for a technology (read-only, but supports OAuth if available)
router.get('/:technologyName', async (req, res) => {
  try {
    const { technologyName } = req.params;
    // Try to get Google OAuth token for authenticated access to private sheets
    const googleToken = req.headers['x-google-token'] || (req.user?.email ? getGoogleToken(req.user.email) : null);
    const questions = await getQuestions(technologyName, googleToken);
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Add question (requires Google auth)
router.post(
  '/:technologyName',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { technologyName } = req.params;
      const { question, answer, imageUrls } = req.body;

      if (!question || !answer) {
        return res
          .status(400)
          .json({ error: 'Question and answer are required' });
      }

      const success = await addQuestion(technologyName, {
        question,
        answer,
        imageUrls,
      });

      if (success) {
        res.json({ success: true, message: 'Question added successfully' });
      } else {
        res.status(500).json({ error: 'Failed to add question' });
      }
    } catch (error) {
      console.error('Error adding question:', error);
      res.status(500).json({ error: 'Failed to add question' });
    }
  }
);

// Update question (requires Google auth)
router.put(
  '/:technologyName/:rowIndex',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { technologyName, rowIndex } = req.params;
      const { question, answer, imageUrls } = req.body;

      if (!question || !answer) {
        return res
          .status(400)
          .json({ error: 'Question and answer are required' });
      }

      const success = await updateQuestion(
        technologyName,
        parseInt(rowIndex),
        { question, answer, imageUrls }
      );

      if (success) {
        res.json({ success: true, message: 'Question updated successfully' });
      } else {
        res.status(500).json({ error: 'Failed to update question' });
      }
    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({ error: 'Failed to update question' });
    }
  }
);

// Delete question (requires Google auth)
router.delete(
  '/:technologyName/:rowIndex',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { technologyName, rowIndex } = req.params;

      // Get sheet ID for the technology
      const technologies = await getTechnologies(req.googleToken);
      const tech = technologies.find((t) => t.name === technologyName);

      if (!tech || tech.sheetId === undefined) {
        return res.status(404).json({ error: 'Technology not found' });
      }

      const success = await deleteQuestion(
        technologyName,
        parseInt(rowIndex),
        tech.sheetId
      );

      if (success) {
        res.json({ success: true, message: 'Question deleted successfully' });
      } else {
        res.status(500).json({ error: 'Failed to delete question' });
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  }
);

// Reorder questions (requires Google auth)
router.post(
  '/:technologyName/reorder',
  authenticateToken,
  authenticateGoogleToken,
  async (req, res) => {
    try {
      setUserCredentials(req.googleToken);
      const { technologyName } = req.params;
      const { oldIndex, newIndex } = req.body;

      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        typeof oldIndex !== 'number' ||
        typeof newIndex !== 'number'
      ) {
        return res
          .status(400)
          .json({ error: 'oldIndex and newIndex are required numbers' });
      }

      // Get sheet ID for the technology
      const technologies = await getTechnologies(req.googleToken);
      const tech = technologies.find((t) => t.name === technologyName);

      if (!tech || tech.sheetId === undefined) {
        return res.status(404).json({ error: 'Technology not found' });
      }

      const success = await reorderQuestions(
        technologyName,
        oldIndex,
        newIndex,
        tech.sheetId
      );

      if (success) {
        res.json({ success: true, message: 'Questions reordered successfully' });
      } else {
        res.status(500).json({ error: 'Failed to reorder questions' });
      }
    } catch (error) {
      console.error('Error reordering questions:', error);
      res.status(500).json({ error: 'Failed to reorder questions' });
    }
  }
);

export default router;
