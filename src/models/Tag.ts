/**
 * Tag Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface ITag extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  order: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
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

// Compound index - userId and name should be unique together
TagSchema.index({ userId: 1, name: 1 }, { unique: true });
TagSchema.index({ userId: 1, order: 1 });

export const Tag = mongoose.model<ITag>("Tag", TagSchema);

