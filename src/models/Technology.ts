/**
 * Technology Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface ITechnology extends Document {
  name: string;
  order: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TechnologySchema = new Schema<ITechnology>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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

// Index for ordering
TechnologySchema.index({ order: 1 });

export const Technology = mongoose.model<ITechnology>(
  "Technology",
  TechnologySchema,
);

