/**
 * Project Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
  userId: mongoose.Types.ObjectId;
  project: string;
  projectId: string;
  order: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    project: {
      type: String,
      required: true,
      trim: true,
    },
    projectId: {
      type: String,
      required: true,
      trim: true,
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

// Compound index - userId and projectId should be unique together
ProjectSchema.index({ userId: 1, projectId: 1 }, { unique: true });
ProjectSchema.index({ userId: 1, order: 1 });

export const Project = mongoose.model<IProject>("Project", ProjectSchema);

