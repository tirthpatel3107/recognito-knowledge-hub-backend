/**
 * User Profile Model
 * Stores user-specific settings and preferences
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IUserProfile extends Document {
  email: string;
  colorPalette?: {
    lightModeColor?: string | null;
    darkModeColor?: string | null;
  };
  accessibleModules?: string[]; // Modules the user has access to, in display order (e.g., ["question-bank", "work-summary"])
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    colorPalette: {
      lightModeColor: {
        type: String,
        default: null,
      },
      darkModeColor: {
        type: String,
        default: null,
      },
    },
    accessibleModules: {
      type: [String],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const UserProfile = mongoose.model<IUserProfile>(
  "UserProfile",
  UserProfileSchema,
);

