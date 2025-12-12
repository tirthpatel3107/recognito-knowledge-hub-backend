/**
 * Shared Types for MongoDB Services
 */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TechnologyResult {
  id: string;
  name: string;
  sheetId: number;
}

