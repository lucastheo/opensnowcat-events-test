export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export interface LoggerOptions {
  level?: LogLevel;
  silent?: boolean;
}

export class Logger {
  private level: LogLevel;
  private silent: boolean;

  constructor(options: LoggerOptions = {}) {
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    this.level = options.level ?? (envLevel && envLevel in LOG_LEVEL_PRIORITY ? envLevel : 'info');
    this.silent = options.silent ?? false;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  isSilent(): boolean {
    return this.silent || this.level === 'silent';
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isSilent()) return false;
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  debug = (message: string, ...args: unknown[]): void => {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  };

  info = (message: string, ...args: unknown[]): void => {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args);
    }
  };

  warn = (message: string, ...args: unknown[]): void => {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  };

  error = (message: string, ...args: unknown[]): void => {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  };

  logProgress = (completed: number, total: number, stats?: Record<string, unknown>): void => {
    if (this.shouldLog('info')) {
      const percentage = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
      const statsStr = stats && Object.keys(stats).length > 0
        ? ` | ${Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(', ')}`
        : '';
      console.log(`[PROGRESS] ${completed}/${total} (${percentage}%)${statsStr}`);
    }
  };
}

export const logger = new Logger();

export const debug = logger.debug;
export const info = logger.info;
export const warn = logger.warn;
export const error = logger.error;
export const logProgress = logger.logProgress;
