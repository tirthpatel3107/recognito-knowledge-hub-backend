/**
 * Entity Routes
 */
import express from "express";
import { authenticateToken } from "../middleware/auth";
import * as entityController from "../controllers/entityController";

const router = express.Router();

// Get all entities (requires auth to get user-specific entities)
router.get("/", authenticateToken, entityController.getAllEntities);

// Add entity (requires auth)
router.post(
  "/",
  authenticateToken,
  entityController.addEntityHandler,
);

// Update entity (requires auth)
router.put(
  "/:rowIndex",
  authenticateToken,
  entityController.updateEntityHandler,
);

// Delete entity (requires auth)
router.delete(
  "/:rowIndex",
  authenticateToken,
  entityController.deleteEntityHandler,
);

export default router;

