/**
 * Error logging utilities.
 * Helper functions for consistent error logging across the application.
 */

import type { ILogger, LogProperties } from "./types";

/**
 * Log an error and re-throw it.
 * Use at error boundaries where you want to log but not handle the error.
 */
export function logAndThrow(
  log: ILogger,
  error: Error,
  context?: LogProperties,
): never {
  log.error(error.message, { stack: error.stack, ...context });
  throw error;
}

/**
 * Log an error without throwing.
 * Use when handling errors and continuing execution.
 */
export function logError(
  log: ILogger,
  error: unknown,
  context?: LogProperties,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  log.error(message, { stack, ...context });
}

/**
 * Wrap an async function with error logging.
 * Logs errors before re-throwing, preserving the call stack.
 */
export function withErrorLogging<T extends unknown[], R>(
  log: ILogger,
  fn: (...args: T) => Promise<R>,
  context?: LogProperties,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(log, error, context);
      throw error;
    }
  };
}
