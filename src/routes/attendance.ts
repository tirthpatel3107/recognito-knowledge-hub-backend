/**
 * Attendance Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as attendanceController from "../controllers/attendanceController";

const router = express.Router();

// Get attendance for a specific day
router.get("/day", authenticateToken, attendanceController.getDayAttendanceHandler);

// Save attendance for a specific day
router.post("/day", authenticateToken, attendanceController.saveDayAttendanceHandler);

// Get attendance for an entire month
router.get("/month", authenticateToken, attendanceController.getMonthAttendanceHandler);

// Get user attendance summaries (for "All Users" page)
router.get("/summaries", authenticateToken, attendanceController.getUserSummariesHandler);

export default router;

