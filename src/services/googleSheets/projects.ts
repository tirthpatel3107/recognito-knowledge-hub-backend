/**
 * Google Sheets Projects Service
 * Handles project CRUD operations
 */
import { SPREADSHEET_IDS } from "../../config/googleConfig";
import type { Project, ProjectInput } from "../../types/googleSheets";
import { getSheetsClient, findSheetByName, updateSerialNumbers } from "./utils";

/**
 * Get the Project List sheet name
 */
const getProjectListSheetName = async (
  accessToken: string | null = null,
): Promise<string> => {
  if (!SPREADSHEET_IDS.WORK_SUMMARY) {
    return "Project List";
  }
  const result = await findSheetByName(
    SPREADSHEET_IDS.WORK_SUMMARY,
    "Project List",
    accessToken,
  );
  return result.sheetName;
};

/**
 * Get all projects
 */
export const getProjects = async (
  accessToken: string | null = null,
): Promise<Project[]> => {
  try {
    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      SPREADSHEET_IDS.WORK_SUMMARY,
    );
    const sheetName = await getProjectListSheetName(accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${sheetName}!A2:C1000`,
    });

    const rows = response?.data?.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `project-${index}`,
      no: row[0]?.toString() || "",
      project: row[1] || "",
      projectId: row[2] || "",
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Add a project
 */
export const addProject = async (
  projectData: ProjectInput,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.WORK_SUMMARY,
    );
    const sheetName = await getProjectListSheetName();
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${sheetName}!A:A`,
    });
    const rowCount = (response?.data?.values?.length || 1) + 1;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${sheetName}!A${rowCount}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[rowCount - 1, projectData.project, projectData.projectId]],
      },
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Update a project
 */
export const updateProject = async (
  rowIndex: number,
  projectData: ProjectInput,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.WORK_SUMMARY,
    );
    const sheetName = await getProjectListSheetName();
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      range: `${sheetName}!A${actualRow}:C${actualRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[rowIndex + 1, projectData.project, projectData.projectId]],
      },
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (
  rowIndex: number,
  sheetId: number,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.WORK_SUMMARY,
    );
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: actualRow - 1,
                endIndex: actualRow,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Reorder projects
 */
export const reorderProjects = async (
  oldIndex: number,
  newIndex: number,
  sheetId: number,
): Promise<boolean> => {
  try {
    const sheetsClient = getSheetsClient(
      null,
      null,
      SPREADSHEET_IDS.WORK_SUMMARY,
    );
    const actualOldRow = oldIndex + 2;
    const actualNewRow = newIndex + 2;

    // Move the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_IDS.WORK_SUMMARY,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId,
                dimension: "ROWS",
                startIndex: actualOldRow - 1,
                endIndex: actualOldRow,
              },
              destinationIndex: actualNewRow - 1,
            },
          },
        ],
      },
    });

    // Update serial numbers
    const updatedProjects = await getProjects();
    const sheetName = await getProjectListSheetName();
    await updateSerialNumbers(
      SPREADSHEET_IDS.WORK_SUMMARY,
      sheetName,
      updatedProjects.length,
    );

    return true;
  } catch (error) {
    return false;
  }
};
