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
NotesTabSchema.index({ userId: 1, order: 1 });

export const NotesTab = mongoose.model<INotesTab>("NotesTab", NotesTabSchema);

