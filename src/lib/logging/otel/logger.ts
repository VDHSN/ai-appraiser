/**
 * OTEL Logger implementation.
 * Implements ILogger interface using OpenTelemetry SDK.
 */

import { Logger, SeverityNumber } from "@opentelemetry/api-logs";
import type { ILogger, LogLevel, LogProperties } from "../types";
import { flattenProperties } from "./attributes";

const SEVERITY_MAP: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

/**
 * OpenTelemetry-based logger implementing ILogger interface.
 */
export class OtelLogger implements ILogger {
  constructor(
    private readonly logger: Logger,
    private readonly baseAttributes: Record<string, string | boolean | number>,
    private readonly defaultProperties: LogProperties = {},
  ) {}

  private emit(
    level: LogLevel,
    message: string,
    properties?: LogProperties,
  ): void {
    const mergedProperties = { ...this.defaultProperties, ...properties };
    const flatProps = flattenProperties(mergedProperties);

    this.logger.emit({
      severityNumber: SEVERITY_MAP[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes: {
        ...this.baseAttributes,
        ...flatProps,
      },
    });
  }

  debug(message: string, properties?: LogProperties): void {
    this.emit("debug", message, properties);
  }

  info(message: string, properties?: LogProperties): void {
    this.emit("info", message, properties);
  }

  warn(message: string, properties?: LogProperties): void {
    this.emit("warn", message, properties);
  }

  error(message: string, properties?: LogProperties): void {
    this.emit("error", message, properties);
  }

  child(defaultProperties: LogProperties): ILogger {
    return new OtelLogger(this.logger, this.baseAttributes, {
      ...this.defaultProperties,
      ...defaultProperties,
    });
  }
}
