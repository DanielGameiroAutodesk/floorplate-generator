/**
 * Floorplate Generator - Logging Utility
 *
 * Configurable logging with levels that can be disabled in production.
 * Replaces scattered console.log statements throughout the codebase.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

let currentLevel: LogLevel = LogLevel.WARN;
const warnCounts = new Map<string, number>();
const WARN_REPEAT_THRESHOLDS = new Set([2, 5, 10, 25, 50, 100]);

/**
 * Logger with configurable levels.
 * Default level is WARN - only warnings and errors are shown.
 * Set to DEBUG during development to see all algorithm trace output.
 */
export const Logger = {
  /**
   * Set the current log level
   */
  setLevel: (level: LogLevel): void => {
    currentLevel = level;
  },

  /**
   * Get the current log level
   */
  getLevel: (): LogLevel => currentLevel,

  /**
   * Debug-level logging for algorithm tracing
   * Use for: unit counts, corner eligibility, segment distribution, geometry optimization
   */
  debug: (msg: string, ...args: unknown[]): void => {
    if (currentLevel <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${msg}`, ...args);
    }
  },

  /**
   * Info-level logging for major algorithm steps
   * Use for: version markers, generation start/end, strategy selection
   */
  info: (msg: string, ...args: unknown[]): void => {
    if (currentLevel <= LogLevel.INFO) {
      console.log(`[INFO] ${msg}`, ...args);
    }
  },

  /**
   * Warning-level logging for unexpected but non-fatal conditions
   * Use for: fallback to defaults, constraint violations that are auto-corrected
   */
  warn: (msg: string, ...args: unknown[]): void => {
    if (currentLevel <= LogLevel.WARN) {
      // Cap the map size to prevent unbounded growth from unique messages
      if (warnCounts.size > 10000) {
        warnCounts.clear();
      }
      const count = (warnCounts.get(msg) ?? 0) + 1;
      warnCounts.set(msg, count);

      if (count === 1) {
        console.warn(`[WARN] ${msg}`, ...args);
      } else if (WARN_REPEAT_THRESHOLDS.has(count)) {
        console.warn(`[WARN] ${msg} (repeated ${count}x)`);
      }

    }
  },

  /**
   * Error-level logging for failures
   * Use for: invalid inputs, algorithm failures, assertion violations
   */
  error: (msg: string, ...args: unknown[]): void => {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${msg}`, ...args);
    }
  }
};

/**
 * Convenience function to enable debug logging during development
 */
export function enableDebugLogging(): void {
  Logger.setLevel(LogLevel.DEBUG);
}

/**
 * Convenience function to disable all logging (production mode)
 */
export function disableLogging(): void {
  Logger.setLevel(LogLevel.NONE);
}
