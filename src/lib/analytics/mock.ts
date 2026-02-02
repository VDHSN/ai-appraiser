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

  isInitialized(): boolean {
    return this.initialized;
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
  public exceptions: Error[] = [];
  public featureFlags: Record<string, Record<string, boolean | string>> = {};

  track<E extends keyof ServerAnalyticsEvents>(
    event: E,
    properties: ServerAnalyticsEvents[E],
    distinctId?: string,
  ) {
    this.events.push({ event, properties, distinctId });
  }

  captureException(error: Error) {
    this.exceptions.push(error);
  }

  async shutdown() {}

  // Feature flag methods
  async isFeatureEnabled(
    flagKey: string,
    distinctId: string,
    defaultValue: boolean = false,
  ): Promise<boolean> {
    const userFlags = this.featureFlags[distinctId];
    if (userFlags && flagKey in userFlags) {
      return userFlags[flagKey] === true;
    }
    return defaultValue;
  }

  async getAllFeatureFlags(
    distinctId: string,
  ): Promise<Record<string, boolean | string>> {
    return this.featureFlags[distinctId] ?? {};
  }

  clearFlagCache(_distinctId?: string): void {
    // No-op for mock
  }

  // Test helpers for feature flags
  setFeatureFlag(
    distinctId: string,
    flagKey: string,
    value: boolean | string,
  ): void {
    if (!this.featureFlags[distinctId]) {
      this.featureFlags[distinctId] = {};
    }
    this.featureFlags[distinctId][flagKey] = value;
  }

  clearFeatureFlags(): void {
    this.featureFlags = {};
  }

  // Test helpers
  clear() {
    this.events = [];
    this.exceptions = [];
    this.featureFlags = {};
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
