/**
 * Type definitions for Google Sheets Service
 */

export interface Technology {
  id: string;
  name: string;
  sheetId: number;
}

export interface Question {
  id: string;
  question: string;
  answer: string;
  example?: string;
  priority?: "low" | "medium" | "high";
}

export interface QuestionInput {
  question: string;
  answer: string;
  example?: string;
  priority?: "low" | "medium" | "high";
}

export interface PracticalTask {
  id: string;
  no: string;
  question: string;
  answer: string;
  example?: string;
  priority?: "low" | "medium" | "high";
}

export interface Project {
  id: string;
  no: string;
  project: string;
  projectId: string;
}

export interface ProjectInput {
  project: string;
  projectId: string;
}

export interface WorkSummaryEntry {
  id: string;
  no: string;
  projectName: string;
  workSummary: string;
  date: string;
}

export interface WorkSummaryEntryInput {
  projectName: string;
  workSummary: string;
  date: string;
}

export interface UserProfile {
  email: string;
  password: string;
  username: string;
  photo: string;
}

export interface ColorPalette {
  lightModeColor: string | null;
  darkModeColor: string | null;
}

export interface Tag {
  id: string;
  no: string;
  name: string;
}

export interface TagInput {
  name: string;
}

export interface SpreadsheetValuesResponse {
  values?: string[][];
}

export interface SpreadsheetMetadata {
  sheets?: Array<{
    properties: {
      title: string;
      sheetId: number;
    };
  }>;
}
