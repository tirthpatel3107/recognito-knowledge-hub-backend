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
    await mongoose.connect(connectionString);

    isConnected = true;
    console.log("[Database] ✅ Successfully connected to MongoDB");
  } catch (error) {
    console.error("[Database] ❌ Failed to connect to MongoDB:", error);
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

