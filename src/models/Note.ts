/**
 * Note Model
 */
import mongoose, { Schema, Document } from "mongoose";

export interface INote extends Document {
  userId: mongoose.Types.ObjectId;
  tabId: string;
  title: string;
  description?: string;
  description2?: string;
  description3?: string;
  starred?: boolean;
  order?: number; // Sequence/order field for tracking note order within a tab
  allOrder?: number; // Sequence/order field for tracking note order in "All" view
  starredOrder?: number; // Sequence/order field for tracking note order in "Starred" view
  // Legacy fields for backward compatibility
  columnIndex?: number;
  columnLetter?: string;
  heading?: string;
  content?: string;
  rowIndex?: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tabId: {
      type: String,
      required: true,
      trim: true,
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
    description2: {
      type: String,
      default: "",
    },
    description3: {
      type: String,
      default: "",
    },
    starred: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
      min: 0, // Order must be non-negative
      // Used to track the sequence/order of notes within a tab
    },
    allOrder: {
      type: Number,
      default: 0,
      min: 0, // Order must be non-negative
      // Used to track the sequence/order of notes in "All" view
    },
    starredOrder: {
      type: Number,
      default: 0,
      min: 0, // Order must be non-negative
      // Used to track the sequence/order of notes in "Starred" view
    },
    // Legacy fields
    columnIndex: {
      type: Number,
    },
    columnLetter: {
      type: String,
    },
    heading: {
      type: String,
    },
    content: {
      type: String,
    },
    rowIndex: {
      type: Number,
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
NoteSchema.index({ userId: 1, tabId: 1 });

// Index for efficient sorting by order within a tab
NoteSchema.index({ userId: 1, tabId: 1, order: 1, createdAt: 1 });

export const Note = mongoose.model<INote>("Note", NoteSchema);

