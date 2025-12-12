/**
 * Demo Users and Modules Seeder Script
 * Seeds the database with demo users and their module access
 * 
 * Usage:
 *   npm run seed:demo
 *   or
 *   tsx scripts/seedDemo.ts
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { User } from "../src/models/User.js";
import { UserProfile } from "../src/models/UserProfile.js";

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

// Demo users with their module assignments
interface DemoUser {
  email: string;
  password: string;
  username: string;
  photo: string;
  accessibleModules: string[];
}

const demoUsers: DemoUser[] = [
  {
    email: "demo.",
    password: "DemoAdmin123!",
    username: "Demo Admin",
    photo: "",
    accessibleModules: [
      "question-bank",
      "work-summary",
      "practical-task",
      "kanban-board",
      "notes",
    ],
  },
];

/**
 * Seed demo users and their modules into the database
 */
const seedDemo = async () => {
  try {
    console.log("[Seeder] Connecting to database...");
    await connectDatabase();

    console.log("[Seeder] Starting demo users and modules seeding...\n");

    let usersCreated = 0;
    let usersSkipped = 0;
    let modulesUpdated = 0;
    let modulesSkipped = 0;
    let errorCount = 0;

    for (const userData of demoUsers) {
      try {
        // Normalize email
        const normalizedEmail = userData.email.toLowerCase().trim();

        // Step 1: Create or skip user
        let user = await User.findOne({ email: normalizedEmail });

        if (user) {
          console.log(
            `[Seeder] ⚠️  User with email ${normalizedEmail} already exists. Skipping user creation...`,
          );
          usersSkipped++;
        } else {
          // Create new user (password will be hashed by the model's pre-save hook)
          user = new User({
            email: normalizedEmail,
            password: userData.password, // Will be hashed automatically
            username: userData.username,
            photo: userData.photo,
          });

          await user.save();
          console.log(
            `[Seeder] ✅ Created user: ${normalizedEmail} (${userData.username})`,
          );
          usersCreated++;
        }

        // Step 2: Assign modules to user
        // Validate modules
        const validModules = userData.accessibleModules.filter((module) =>
          AVAILABLE_MODULES.includes(module as any),
        );

        if (validModules.length === 0) {
          console.log(
            `[Seeder] ⚠️  No valid modules for ${normalizedEmail}. Skipping module assignment...`,
          );
          modulesSkipped++;
          continue;
        }

        // Update or create user profile with accessible modules
        let profile = await UserProfile.findOne({ email: normalizedEmail });

        if (!profile) {
          // Create new profile
          profile = new UserProfile({
            email: normalizedEmail,
            accessibleModules: validModules,
          });
          await profile.save();
          console.log(
            `[Seeder] ✅ Created profile with modules for ${normalizedEmail}: ${validModules.join(", ")}`,
          );
          modulesUpdated++;
        } else {
          // Update existing profile
          profile.accessibleModules = validModules;
          await profile.save();
          console.log(
            `[Seeder] ✅ Updated modules for ${normalizedEmail}: ${validModules.join(", ")}`,
          );
          modulesUpdated++;
        }
      } catch (error: any) {
        if (error.code === 11000) {
          // Duplicate key error (email already exists)
          console.log(
            `[Seeder] ⚠️  User with email ${userData.email} already exists. Skipping...`,
          );
          usersSkipped++;
        } else {
          console.error(
            `[Seeder] ❌ Error processing user ${userData.email}:`,
            error.message,
          );
          errorCount++;
        }
      }
    }

    console.log("\n[Seeder] ========================================");
    console.log(`[Seeder] Seeding completed!`);
    console.log(`[Seeder] Users created: ${usersCreated}`);
    console.log(`[Seeder] Users skipped: ${usersSkipped} (already exist)`);
    console.log(`[Seeder] Modules updated: ${modulesUpdated}`);
    console.log(`[Seeder] Modules skipped: ${modulesSkipped}`);
    console.log(`[Seeder] Errors: ${errorCount}`);
    console.log(`[Seeder] ========================================\n`);
  } catch (error) {
    console.error("[Seeder] ❌ Fatal error during seeding:", error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    console.log("[Seeder] Database connection closed.");
    process.exit(0);
  }
};

// Run the seeder
seedDemo();

