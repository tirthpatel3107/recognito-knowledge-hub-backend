/**
 * Kanban Board Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as kanbanController from "../controllers/kanbanController";

const router = express.Router();

// Get all kanban tasks
router.get("/tasks", authenticateToken, kanbanController.getTasks);

// Save all kanban tasks
router.post("/tasks", authenticateToken, kanbanController.saveTasks);

export default router;

