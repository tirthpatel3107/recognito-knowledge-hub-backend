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
  // Legacy fields for backward compatibility
  columnIndex?: number;
  columnLetter?: string;
  heading?: string;
  content?: string;
  imageUrls?: string[];
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
    imageUrls: {
      type: [String],
      default: [],
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

export const Note = mongoose.model<INote>("Note", NoteSchema);

