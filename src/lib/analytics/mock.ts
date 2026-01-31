/**
 * Mock analytics implementations for testing.
 */

import type {
  ClientAnalytics,
  ClientAnalyticsEvents,
  ServerAnalytics,
  ServerAnalyticsEvents,
  UserProperties,
} from "./types";

// Mock for client-side analytics
export class MockClientAnalytics implements ClientAnalytics {
  public events: Array<{ event: string; properties: unknown }> = [];
  public identifyCalls: Array<{ userId: string; properties?: UserProperties }> =
    [];
  public exceptions: Error[] = [];
  public initialized = false;

  init() {
    this.initialized = true;
  }

  track<E extends keyof ClientAnalyticsEvents>(
    event: E,
    properties: ClientAnalyticsEvents[E],
  ) {
    this.events.push({ event, properties });
  }

  identify(userId: string, properties?: UserProperties) {
    this.identifyCalls.push({ userId, properties });
  }

  reset() {
    this.identifyCalls = [];
  }

  captureException(error: Error) {
    this.exceptions.push(error);
  }

  getSessionId() {
    return "mock-session-id";
  }

  getDistinctId() {
    return "mock-distinct-id";
  }

  pageView() {}

  // Test helpers
  clear() {
    this.events = [];
    this.identifyCalls = [];
    this.exceptions = [];
  }

  findEvent<E extends keyof ClientAnalyticsEvents>(event: E) {
    return this.events.find((e) => e.event === event);
  }

  hasEvent(event: keyof ClientAnalyticsEvents) {
    return this.events.some((e) => e.event === event);
  }
}

// Mock for server-side analytics
export class MockServerAnalytics implements ServerAnalytics {
  public events: Array<{
    event: string;
    properties: unknown;
    distinctId?: string;
  }> = [];
  public exceptions: Array<{ error: Error; distinctId?: string }> = [];

  track<E extends keyof ServerAnalyticsEvents>(
    event: E,
    properties: ServerAnalyticsEvents[E],
    distinctId?: string,
  ) {
    this.events.push({ event, properties, distinctId });
  }

  captureException(
    error: Error,
    _context?: Record<string, unknown>,
    distinctId?: string,
  ) {
    this.exceptions.push({ error, distinctId });
  }

  async shutdown() {}

  // Test helpers
  clear() {
    this.events = [];
    this.exceptions = [];
  }

  findEvent<E extends keyof ServerAnalyticsEvents>(event: E) {
    return this.events.find((e) => e.event === event);
  }

  hasEvent(event: keyof ServerAnalyticsEvents) {
    return this.events.some((e) => e.event === event);
  }
}

export const mockClientAnalytics = new MockClientAnalytics();
export const mockServerAnalytics = new MockServerAnalytics();
