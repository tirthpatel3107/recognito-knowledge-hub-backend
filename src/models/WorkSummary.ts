/**
 * Work Summary Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IWorkSummary extends Document {
  userId: mongoose.Types.ObjectId;
  monthSheet: string; // Format: "YYYY-MM" (e.g., "2024-01")
  projectName: string;
  workSummary: string;
  date: Date;
  order: number; // For sorting within the month
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkSummarySchema = new Schema<IWorkSummary>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    monthSheet: {
      type: String,
      required: true,
      trim: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    workSummary: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
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

// Compound index for efficient queries
WorkSummarySchema.index({ userId: 1, monthSheet: 1, order: 1 });

export const WorkSummary = mongoose.model<IWorkSummary>(
  "WorkSummary",
  WorkSummarySchema,
);

