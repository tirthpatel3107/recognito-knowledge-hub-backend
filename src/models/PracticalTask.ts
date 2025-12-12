/**
 * Practical Task Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IPracticalTask extends Document {
  technologyName: string;
  no: string;
  question: string;
  answer: string;
  example?: string;
  priority?: "low" | "medium" | "high";
  order: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PracticalTaskSchema = new Schema<IPracticalTask>(
  {
    technologyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    no: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    example: {
      type: String,
      default: "",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
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

// Compound index for technology and order
PracticalTaskSchema.index({ technologyName: 1, order: 1 });

export const PracticalTask = mongoose.model<IPracticalTask>(
  "PracticalTask",
  PracticalTaskSchema,
);

