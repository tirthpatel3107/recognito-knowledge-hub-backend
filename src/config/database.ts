/**
 * MongoDB Database Connection
 */
import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://NAmaZEq8z3iB3f10k3Bgr:TAmaZEq8z9iB3f10k3Bga@recognito.nnwr8af.mongodb.net/";

let isConnected = false;

export const connectDatabase = async (): Promise<void> => {
  if (isConnected) {
    console.log("[Database] Already connected to MongoDB");
    return;
  }

  try {
    const dbName = process.env.MONGODB_DB_NAME || "recognito";
    const connectionString = `${MONGODB_URI}${dbName}?retryWrites=true&w=majority`;

    console.log("[Database] Connecting to MongoDB...");
    console.log(`[Database] Connection string: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}${dbName}`);
    
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      connectTimeoutMS: 10000, // 10 seconds connection timeout
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1, // Maintain at least 1 socket connection
    });

    isConnected = true;
    console.log("[Database] ✅ Successfully connected to MongoDB");
    console.log(`[Database] Database name: ${dbName}`);
    console.log(`[Database] Connection state: ${mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"}`);
  } catch (error: any) {
    console.error("[Database] ❌ Failed to connect to MongoDB");
    
    // Check for specific error types and provide helpful messages
    if (error.name === "MongooseServerSelectionError" || error.name === "MongoServerSelectionError") {
      console.error("[Database] Server Selection Error - This usually means:");
      console.error("  1. Your IP address is not whitelisted in MongoDB Atlas");
      console.error("  2. Network connectivity issues");
      console.error("  3. MongoDB Atlas cluster is down or unreachable");
      console.error("");
      console.error("To fix IP whitelist issue:");
      console.error("  1. Go to MongoDB Atlas Dashboard: https://cloud.mongodb.com/");
      console.error("  2. Navigate to: Network Access → IP Access List");
      console.error("  3. Click 'Add IP Address'");
      console.error("  4. Click 'Add Current IP Address' or add '0.0.0.0/0' to allow all IPs (less secure)");
      console.error("  5. Wait a few minutes for changes to propagate");
      console.error("");
      console.error("Full error details:", error.message);
    } else if (error.name === "MongoNetworkError" || error.name === "MongooseError") {
      console.error("[Database] Network Error - Check your internet connection and MongoDB Atlas status");
      console.error("Full error details:", error.message);
    } else {
      console.error("[Database] Connection Error:", error.message);
      if (error.stack) {
        console.error("[Database] Stack trace:", error.stack);
      }
    }
    
    isConnected = false;
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("[Database] Disconnected from MongoDB");
  } catch (error) {
    console.error("[Database] Error disconnecting from MongoDB:", error);
    throw error;
  }
};

export const getDatabaseStatus = (): boolean => {
  return isConnected && mongoose.connection.readyState === 1;
};

