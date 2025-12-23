/**
 * Entity Model
 * Similar to Tag, used for categorizing attendance entries
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IEntity extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  order: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EntitySchema = new Schema<IEntity>(
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
EntitySchema.index({ userId: 1, name: 1 }, { unique: true });
EntitySchema.index({ userId: 1, order: 1 });

export const Entity = mongoose.model<IEntity>("Entity", EntitySchema);

