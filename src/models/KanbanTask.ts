/**
 * Kanban Task Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IKanbanTask extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  createdDate: Date;
  columnId: "todo" | "in-progress" | "done" | "close";
  tags?: string[];
  priority?: "low" | "medium" | "high";
  order: number; // For ordering within a column
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KanbanTaskSchema = new Schema<IKanbanTask>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    createdDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    columnId: {
      type: String,
      enum: ["todo", "in-progress", "done", "close"],
      required: true,
      default: "todo",
    },
    tags: {
      type: [String],
      default: [],
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

// Compound index for efficient queries
KanbanTaskSchema.index({ userId: 1, columnId: 1, order: 1 });

export const KanbanTask = mongoose.model<IKanbanTask>(
  "KanbanTask",
  KanbanTaskSchema,
);

