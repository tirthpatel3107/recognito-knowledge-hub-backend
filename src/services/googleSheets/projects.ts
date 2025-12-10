/**
 * Google Sheets Projects Service
 * Handles project CRUD operations
 */
import type { Project, ProjectInput } from "../../types/googleSheets";
import {
  getSheetsClient,
  findSheetByName,
  updateSerialNumbers,
  isServiceAccountInitialized,
} from "./utils";
import { getUserWorkSummarySpreadsheetId } from "./userProfile";

/**
 * Get the Project List sheet name
 */
const getProjectListSheetName = async (
  spreadsheetId: string,
  accessToken: string | null = null,
): Promise<string> => {
  if (!spreadsheetId) {
    return "Project List";
  }
  const result = await findSheetByName(
    spreadsheetId,
    "Project List",
    accessToken,
  );
  return result.sheetName;
};

/**
 * Get all projects
 */
export const getProjects = async (
  email: string | null = null,
  accessToken: string | null = null,
): Promise<Project[]> => {
  try {
    // Get user-specific spreadsheet ID from UserDetail tab
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);

    // Check if service account is initialized (required for WORK_SUMMARY spreadsheet)
    if (!isServiceAccountInitialized()) {
      console.error(
        "Service account is not initialized. Cannot access Project List sheet.",
      );
      throw new Error(
        "Service account is not initialized. Please configure SERVICE_ACCOUNT_KEY in your config sheet.",
      );
    }

    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );
    const sheetName = await getProjectListSheetName(spreadsheetId, accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A2:C1000`,
    });

    const rows = response?.data?.values || [];
    return rows.map((row: any[], index: number) => ({
      id: `project-${index}`,
      no: row[0]?.toString() || "",
      project: row[1] || "",
      projectId: row[2] || "",
    }));
  } catch (error: any) {
    console.error("Error getting projects:", error);
    
    // Provide more specific error messages for common issues
    if (error?.response?.status === 404) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || "";
      if (errorMessage.includes("spreadsheet") || errorMessage.includes("404")) {
        throw new Error(
          `Work Summary spreadsheet not found. Please verify that WORK_SUMMARY_SPREADSHEET_ID is set in the UserDetail tab (column J) for your user and the service account has access to it.`,
        );
      }
    }
    
    // Re-throw the error so the API can return a proper error response
    throw error;
  }
};

/**
 * Add a project
 */
export const addProject = async (
  projectData: ProjectInput,
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );
    const sheetName = await getProjectListSheetName(spreadsheetId, accessToken);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`,
    });
    const rowCount = (response?.data?.values?.length || 1) + 1;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
  oldProjectName?: string,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );
    const sheetName = await getProjectListSheetName(spreadsheetId, accessToken);
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A${actualRow}:C${actualRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[rowIndex + 1, projectData.project, projectData.projectId]],
      },
    });

    // If project name changed, update all WorkSummary entries
    if (oldProjectName && oldProjectName !== projectData.project) {
      // Import the function dynamically to avoid circular dependencies
      const { updateProjectNameInWorkSummary } = await import("./workSummary");
      const workSummaryUpdateSuccess = await updateProjectNameInWorkSummary(
        oldProjectName,
        projectData.project,
        email,
        accessToken,
      );

      if (!workSummaryUpdateSuccess) {
        // Failed to update project name in work summary sheets, but project was updated successfully
        // Don't fail the entire operation, but log the error
        console.error(
          `Failed to update project name in work summary sheets. Project was updated but work summary entries may still have the old name: ${oldProjectName}`,
        );
      }
    }

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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );
    const actualRow = rowIndex + 2;

    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
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
  email: string | null = null,
  accessToken: string | null = null,
): Promise<boolean> => {
  try {
    const spreadsheetId = await getUserWorkSummarySpreadsheetId(email, accessToken);
    const sheetsClient = getSheetsClient(
      accessToken,
      null,
      spreadsheetId,
    );
    const actualOldRow = oldIndex + 2;
    const actualNewRow = newIndex + 2;

    // Move the row
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
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
    const updatedProjects = await getProjects(email, accessToken);
    const sheetName = await getProjectListSheetName(spreadsheetId, accessToken);
    await updateSerialNumbers(
      spreadsheetId,
      sheetName,
      updatedProjects.length,
      accessToken,
    );

    return true;
  } catch (error) {
    return false;
  }
};
