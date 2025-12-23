/**
 * Attendance Model
 * Stores attendance data for users on a monthly basis
 */
import mongoose, { Schema, Document } from "mongoose";

export interface IAttendanceEntry {
  name: string;
  reason?: string;
  inTime?: string; // Time format: "HH:mm"
  outTime?: string; // Time format: "HH:mm"
  hours?: number; // Calculated hours
  entityId?: string; // Reference to Entity
}

export interface IAttendance extends Document {
  userId: mongoose.Types.ObjectId;
  targetUserId: mongoose.Types.ObjectId; // User whose attendance this is
  year: number;
  month: number; // 1-12
  date: number; // Day of month (1-31)
  entries: IAttendanceEntry[];
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceEntrySchema = new Schema<IAttendanceEntry>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      default: "",
    },
    inTime: {
      type: String,
      default: "",
    },
    outTime: {
      type: String,
      default: "",
    },
    hours: {
      type: Number,
      default: 0,
    },
    entityId: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    date: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    entries: {
      type: [AttendanceEntrySchema],
      default: [],
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
AttendanceSchema.index({ userId: 1, targetUserId: 1, year: 1, month: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ targetUserId: 1, year: 1, month: 1, date: 1 });

export const Attendance = mongoose.model<IAttendance>("Attendance", AttendanceSchema);

