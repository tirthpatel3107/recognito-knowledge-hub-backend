/**
 * Remove Soft-Deleted Records Script
 * Permanently removes soft-deleted records from the database, module-wise
 * 
 * Usage:
 *   npm run remove:soft-deleted [module-name]
 *   or
 *   tsx scripts/removeSoftDeleted.ts [module-name]
 * 
 * Examples:
 *   tsx scripts/removeSoftDeleted.ts question-bank
 *   tsx scripts/removeSoftDeleted.ts notes
 *   tsx scripts/removeSoftDeleted.ts (removes from all modules)
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { Question } from "../src/models/Question.js";
import { Technology } from "../src/models/Technology.js";
import { WorkSummary } from "../src/models/WorkSummary.js";
import { Project } from "../src/models/Project.js";
import { PracticalTask } from "../src/models/PracticalTask.js";
import { KanbanTask } from "../src/models/KanbanTask.js";
import { Tag } from "../src/models/Tag.js";
import { Note } from "../src/models/Note.js";
import { NotesTab } from "../src/models/NotesTab.js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "..", ".env");
dotenv.config({ path: envPath });

// Available modules
const AVAILABLE_MODULES = [
  "question-bank",
  "work-summary",
  "practical-task",
  "kanban-board",
  "notes",
] as const;

type ModuleName = typeof AVAILABLE_MODULES[number];

// Module to models mapping
const MODULE_MODELS: Record<ModuleName, Array<{ name: string; model: any }>> = {
  "question-bank": [
    { name: "Question", model: Question },
    { name: "Technology", model: Technology },
  ],
  "work-summary": [
    { name: "WorkSummary", model: WorkSummary },
    { name: "Project", model: Project },
  ],
  "practical-task": [
    { name: "PracticalTask", model: PracticalTask },
  ],
  "kanban-board": [
    { name: "KanbanTask", model: KanbanTask },
    { name: "Tag", model: Tag },
  ],
  "notes": [
    { name: "Note", model: Note },
    { name: "NotesTab", model: NotesTab },
  ],
};

/**
 * Remove soft-deleted records for a specific module
 */
const removeSoftDeletedForModule = async (moduleName: ModuleName) => {
  const models = MODULE_MODELS[moduleName];
  const results: Record<string, number> = {};

  console.log(`\n[Cleanup] Processing module: ${moduleName}`);
  console.log(`[Cleanup] ========================================`);

  for (const { name, model } of models) {
    try {
      // Count soft-deleted records
      const count = await model.countDocuments({ deletedAt: { $ne: null } });

      if (count > 0) {
        // Permanently delete soft-deleted records
        const deleteResult = await model.deleteMany({ deletedAt: { $ne: null } });
        results[name] = deleteResult.deletedCount || 0;
        console.log(
          `[Cleanup] ✅ ${name}: Removed ${results[name]} soft-deleted record(s)`,
        );
      } else {
        results[name] = 0;
        console.log(`[Cleanup] ℹ️  ${name}: No soft-deleted records found`);
      }
    } catch (error: any) {
      console.error(`[Cleanup] ❌ Error processing ${name}:`, error.message);
      results[name] = -1; // -1 indicates error
    }
  }

  return results;
};

/**
 * Main cleanup function
 */
const removeSoftDeleted = async () => {
  try {
    console.log("[Cleanup] Connecting to database...");
    await connectDatabase();

    // Get module name from command line arguments
    const moduleArg = process.argv[2];

    if (moduleArg) {
      // Validate module name
      if (!AVAILABLE_MODULES.includes(moduleArg as ModuleName)) {
        console.error(`[Cleanup] ❌ Invalid module name: ${moduleArg}`);
        console.error(`[Cleanup] Available modules: ${AVAILABLE_MODULES.join(", ")}`);
        process.exit(1);
      }

      // Remove soft-deleted records for specified module
      const results = await removeSoftDeletedForModule(moduleArg as ModuleName);

      console.log(`\n[Cleanup] ========================================`);
      console.log(`[Cleanup] Cleanup completed for module: ${moduleArg}`);
      console.log(`[Cleanup] ========================================`);
      Object.entries(results).forEach(([model, count]) => {
        if (count >= 0) {
          console.log(`[Cleanup] ${model}: ${count} record(s) removed`);
        } else {
          console.log(`[Cleanup] ${model}: Error occurred`);
        }
      });
    } else {
      // Remove soft-deleted records for all modules
      console.log("[Cleanup] No module specified. Processing all modules...\n");

      const allResults: Record<string, Record<string, number>> = {};
      let totalRemoved = 0;

      for (const moduleName of AVAILABLE_MODULES) {
        const results = await removeSoftDeletedForModule(moduleName);
        allResults[moduleName] = results;
        totalRemoved += Object.values(results).reduce(
          (sum, count) => sum + (count > 0 ? count : 0),
          0,
        );
      }

      console.log(`\n[Cleanup] ========================================`);
      console.log(`[Cleanup] Cleanup completed for all modules`);
      console.log(`[Cleanup] ========================================`);
      console.log(`[Cleanup] Total records removed: ${totalRemoved}\n`);

      // Detailed summary
      for (const [moduleName, results] of Object.entries(allResults)) {
        console.log(`[Cleanup] Module: ${moduleName}`);
        Object.entries(results).forEach(([model, count]) => {
          if (count >= 0) {
            console.log(`[Cleanup]   ${model}: ${count} record(s) removed`);
          } else {
            console.log(`[Cleanup]   ${model}: Error occurred`);
          }
        });
        console.log();
      }
    }
  } catch (error) {
    console.error("[Cleanup] ❌ Fatal error during cleanup:", error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    console.log("[Cleanup] Database connection closed.");
    process.exit(0);
  }
};

// Run the cleanup
removeSoftDeleted();

