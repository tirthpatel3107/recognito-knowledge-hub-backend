/**
 * Question Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IQuestion extends Document {
  technologyName: string;
  question: string;
  answer: string;
  example?: string;
  priority?: "low" | "medium" | "high";
  order: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    technologyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
QuestionSchema.index({ technologyName: 1, order: 1 });

export const Question = mongoose.model<IQuestion>("Question", QuestionSchema);

