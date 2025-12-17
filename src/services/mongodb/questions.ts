/**
 * MongoDB Questions Service
 */
import { Question } from "../../models/Question.js";
import { PaginatedResponse } from "./types.js";

export interface QuestionResult {
  id: string;
  question: string;
  answer: string;
  example?: string;
  priority?: "low" | "medium" | "high";
}

export type { PaginatedResponse };

/**
 * Get questions for a technology
 */
export const getQuestions = async (
  technologyName: string,
  page?: number,
  limit?: number,
): Promise<QuestionResult[] | PaginatedResponse<QuestionResult>> => {
  const query = { technologyName, deletedAt: null };

  if (page !== undefined && limit !== undefined) {
    const skip = (page - 1) * limit;
    const [questions, total] = await Promise.all([
      Question.find(query).sort({ order: 1 }).skip(skip).limit(limit),
      Question.countDocuments(query),
    ]);

    return {
      data: questions.map((q) => ({
        id: q._id.toString(),
        question: q.question,
        answer: q.answer,
        example: q.example,
        priority: q.priority,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  const questions = await Question.find(query).sort({ order: 1 });
  return questions.map((q) => ({
    id: q._id.toString(),
    question: q.question,
    answer: q.answer,
    example: q.example,
    priority: q.priority,
  }));
};

/**
 * Add a question
 */
export const addQuestion = async (
  technologyName: string,
  questionData: {
    question: string;
    answer: string;
    example?: string;
    priority?: "low" | "medium" | "high";
  },
): Promise<boolean> => {
  try {
    // Get max order for this technology
    const maxOrder = await Question.findOne({ 
      technologyName,
      deletedAt: null,
    })
      .sort({ order: -1 })
      .select("order");
    const newOrder = maxOrder ? maxOrder.order + 1 : 0;

    await Question.create({
      technologyName,
      ...questionData,
      order: newOrder,
    });
    return true;
  } catch (error) {
    console.error("Error adding question:", error);
    return false;
  }
};

/**
 * Update a question
 */
export const updateQuestion = async (
  technologyName: string,
  questionId: string,
  questionData: {
    question: string;
    answer: string;
    example?: string;
    priority?: "low" | "medium" | "high";
  },
): Promise<boolean> => {
  try {
    await Question.findOneAndUpdate(
      { _id: questionId, technologyName, deletedAt: null },
      questionData,
    );
    return true;
  } catch (error) {
    console.error("Error updating question:", error);
    return false;
  }
};

/**
 * Delete a question
 */
export const deleteQuestion = async (
  technologyName: string,
  questionId: string,
): Promise<boolean> => {
  try {
    await Question.findOneAndUpdate(
      { _id: questionId, technologyName, deletedAt: null },
      { deletedAt: new Date() },
    );
    return true;
  } catch (error) {
    console.error("Error deleting question:", error);
    return false;
  }
};

/**
 * Reorder questions by oldIndex/newIndex
 */
export const reorderQuestions = async (
  technologyName: string,
  oldIndex: number,
  newIndex: number,
): Promise<boolean> => {
  try {
    // Get all questions for this technology, sorted by current order
    const questions = await Question.find({
      technologyName,
      deletedAt: null,
    }).sort({ order: 1 });

    if (questions.length === 0) {
      return true; // Nothing to reorder
    }

    // Validate indices
    if (
      oldIndex < 0 ||
      oldIndex >= questions.length ||
      newIndex < 0 ||
      newIndex >= questions.length
    ) {
      throw new Error(
        `Invalid indices: oldIndex=${oldIndex}, newIndex=${newIndex}, totalQuestions=${questions.length}`,
      );
    }

    // Reorder the array
    const [movedQuestion] = questions.splice(oldIndex, 1);
    questions.splice(newIndex, 0, movedQuestion);

    // Update order for all questions
    const updates = questions.map((question, index) =>
      Question.findOneAndUpdate(
        { _id: question._id, technologyName, deletedAt: null },
        { order: index },
      ),
    );

    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error("Error reordering questions:", error);
    return false;
  }
};

/**
 * Reorder questions by array of IDs (backward compatibility)
 */
export const reorderQuestionsByIds = async (
  technologyName: string,
  questionIds: string[],
): Promise<boolean> => {
  try {
    const updates = questionIds.map((id, index) =>
      Question.findOneAndUpdate(
        { _id: id, technologyName, deletedAt: null },
        { order: index },
      ),
    );
    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error("Error reordering questions by IDs:", error);
    return false;
  }
};

