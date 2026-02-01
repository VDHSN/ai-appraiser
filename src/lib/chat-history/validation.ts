/**
 * Session validation utilities.
 * Pure functions for validating session IDs and retrieving session data.
 */

import type { ChatSession } from "./types";
import { getSession } from "./storage";

export interface ValidationResult {
  valid: boolean;
  session: ChatSession | null;
}

/**
 * Validate a session ID and retrieve the session if it exists.
 * Returns { valid: true, session } if found, { valid: false, session: null } otherwise.
 */
export function validateSession(sessionId: string): ValidationResult {
  const session = getSession(sessionId);
  return {
    valid: session !== null,
    session,
  };
}
