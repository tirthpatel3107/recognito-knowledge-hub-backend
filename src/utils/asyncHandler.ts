/**
 * Async Handler Utility
 * Wraps async functions to automatically handle errors and avoid try-catch blocks
 */
import { Request, Response, NextFunction } from 'express';

type AsyncFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Wraps an async route handler to automatically catch errors
 * @param fn - Async function to wrap
 * @returns Wrapped function that handles errors
 */
export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wraps a service function to automatically catch and handle errors
 * @param fn - Async service function to wrap
 * @returns Wrapped function that returns a result or throws an error
 */
export const serviceWrapper = <T extends (...args: any[]) => Promise<any>>(
  fn: T
): T => {
  return ((...args: Parameters<T>) => {
    return fn(...args).catch((error: Error) => {
      console.error(`Error in service function ${fn.name}:`, error);
      throw error;
    });
  }) as T;
};

