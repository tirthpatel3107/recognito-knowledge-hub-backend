/**
 * MongoDB Attendance Service
 */
import { Attendance, IAttendanceEntry } from "../../models/Attendance.js";
import { User } from "../../models/User.js";

export interface AttendanceDayData {
  date: number;
  entries: IAttendanceEntry[];
  totalHours: number;
}

export interface AttendanceMonthData {
  year: number;
  month: number;
  days: AttendanceDayData[];
  summary: {
    totalDays: number;
    totalHours: number;
    totalAmount: number; // Price per day * total days
  };
}

export interface UserAttendanceSummary {
  userId: string;
  userName: string;
  userEmail: string;
  price: number; // Price per day
  total: number; // Total amount
  entityId?: string;
}

/**
 * Get or create attendance for a specific day
 */
export const getAttendanceByDay = async (
  userId: string,
  targetUserId: string,
  year: number,
  month: number,
  date: number,
): Promise<IAttendanceEntry[]> => {
  const attendance = await Attendance.findOne({
    userId,
    targetUserId,
    year,
    month,
    date,
    deletedAt: null,
  });

  return attendance?.entries || [];
};

/**
 * Save attendance for a specific day
 */
export const saveAttendanceByDay = async (
  userId: string,
  targetUserId: string,
  year: number,
  month: number,
  date: number,
  entries: IAttendanceEntry[],
): Promise<boolean> => {
  try {
    await Attendance.findOneAndUpdate(
      {
        userId,
        targetUserId,
        year,
        month,
        date,
        deletedAt: null,
      },
      {
        userId,
        targetUserId,
        year,
        month,
        date,
        entries,
      },
      { upsert: true, new: true },
    );
    return true;
  } catch (error) {
    console.error("Error saving attendance:", error);
    return false;
  }
};

/**
 * Get attendance for an entire month
 */
export const getAttendanceByMonth = async (
  userId: string,
  targetUserId: string,
  year: number,
  month: number,
): Promise<AttendanceMonthData> => {
  const attendances = await Attendance.find({
    userId,
    targetUserId,
    year,
    month,
    deletedAt: null,
  });

  // Calculate days in month
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: AttendanceDayData[] = [];

  // Create map of date -> entries
  const attendanceMap = new Map<number, IAttendanceEntry[]>();
  attendances.forEach((att) => {
    const totalHours = att.entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    attendanceMap.set(att.date, att.entries);
    days.push({
      date: att.date,
      entries: att.entries,
      totalHours,
    });
  });

  // Fill in missing days with empty entries
  for (let date = 1; date <= daysInMonth; date++) {
    if (!attendanceMap.has(date)) {
      days.push({
        date,
        entries: [],
        totalHours: 0,
      });
    }
  }

  // Sort by date
  days.sort((a, b) => a.date - b.date);

  // Calculate summary
  const totalDays = days.filter((d) => d.entries.length > 0).length;
  const totalHours = days.reduce((sum, d) => sum + d.totalHours, 0);

  return {
    year,
    month,
    days,
    summary: {
      totalDays,
      totalHours,
      totalAmount: 0, // Will be calculated on frontend with price
    },
  };
};

/**
 * Get user attendance summaries for all users (for "All Users" page)
 * Note: Only returns data for users that the current user has access to (same userId = same user's view)
 */
export const getUserAttendanceSummaries = async (
  userId: string,
  year?: number,
  month?: number,
  searchQuery?: string,
): Promise<UserAttendanceSummary[]> => {
  try {
    // First, get all distinct targetUserIds for this userId
    const query: any = { userId, deletedAt: null };
    if (year !== undefined && month !== undefined) {
      query.year = year;
      query.month = month;
    }

    const distinctTargetUsers = await Attendance.distinct("targetUserId", query);

    // Get user details for each targetUserId
    const users = await User.find({
      _id: { $in: distinctTargetUsers },
      deletedAt: null,
    });

    // Filter by search query if provided
    let filteredUsers = users;
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filteredUsers = users.filter(
        (user) =>
          user.username.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower),
      );
    }

    // Get attendance data for each user
    const summaries: UserAttendanceSummary[] = await Promise.all(
      filteredUsers.map(async (user) => {
        const targetUserId = user._id.toString();
        
        // Get all attendance records for this user in the specified month/year or all
        const attendanceQuery: any = {
          userId,
          targetUserId,
          deletedAt: null,
        };
        
        if (year !== undefined && month !== undefined) {
          attendanceQuery.year = year;
          attendanceQuery.month = month;
        }

        const attendances = await Attendance.find(attendanceQuery);

        // Calculate totals
        let totalDays = 0;
        let totalHours = 0;

        attendances.forEach((att) => {
          if (att.entries.length > 0) {
            totalDays++;
            totalHours += att.entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
          }
        });

        // Price and total will be set on frontend or from a user profile setting
        // For now, we'll return 0 and let frontend handle it
        return {
          userId: targetUserId,
          userName: user.username,
          userEmail: user.email,
          price: 0,
          total: 0,
        };
      }),
    );

    return summaries;
  } catch (error) {
    console.error("Error getting user attendance summaries:", error);
    return [];
  }
};

/**
 * Calculate total hours from entries
 */
export const calculateTotalHours = (entries: IAttendanceEntry[]): number => {
  return entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
};

/**
 * Format hours to "X Hour Y Minutes" format
 */
export const formatHours = (totalHours: number): string => {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  
  if (hours === 0 && minutes === 0) {
    return "0 Hours";
  }
  
  const hourText = hours === 1 ? "Hour" : "Hours";
  const minuteText = minutes === 1 ? "Minute" : "Minutes";
  
  if (hours === 0) {
    return `${minutes} ${minuteText}`;
  }
  
  if (minutes === 0) {
    return `${hours} ${hourText}`;
  }
  
  return `${hours} ${hourText} ${minutes} ${minuteText}`;
};

