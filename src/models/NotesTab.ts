/**
 * Notes Tab Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface INotesTab extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  pinned?: boolean;
  order: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotesTabSchema = new Schema<INotesTab>(
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
    pinned: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
      min: 0, // Order must be non-negative
      // Note: Order values are assigned separately for pinned (0,1,2...) and unpinned (0,1,2...) tabs
      // The backend sorts by: pinned (desc), order (asc), createdAt (asc)
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
NotesTabSchema.index({ userId: 1, name: 1 }, { unique: true });

// Index for efficient sorting: pinned (desc), order (asc), createdAt (asc)
// This matches the sort order used in getTabs: { pinned: -1, order: 1, createdAt: 1 }
NotesTabSchema.index({ userId: 1, pinned: -1, order: 1, createdAt: 1 });

// Index for order-based queries (backward compatibility and migration)
NotesTabSchema.index({ userId: 1, order: 1 });

export const NotesTab = mongoose.model<INotesTab>("NotesTab", NotesTabSchema);

