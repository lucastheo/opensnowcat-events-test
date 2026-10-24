import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default info level', () => {
    const l = new Logger();
    expect(l.getLevel()).toBe('info');
    expect(l.isSilent()).toBe(false);
  });

  it('should respect custom level and silent options', () => {
    const l = new Logger({ level: 'debug', silent: true });
    expect(l.getLevel()).toBe('debug');
    expect(l.isSilent()).toBe(true);
  });

  it('should log messages according to log level priority', () => {
    const l = new Logger({ level: 'info' });

    l.debug('debug msg');
    expect(debugSpy).not.toHaveBeenCalled();

    l.info('info msg');
    expect(logSpy).toHaveBeenCalledWith('[INFO] info msg');

    l.warn('warn msg');
    expect(warnSpy).toHaveBeenCalledWith('[WARN] warn msg');

    l.error('error msg');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] error msg');
  });

  it('should log debug messages when level is debug', () => {
    const l = new Logger({ level: 'debug' });
    l.debug('debug msg', { extra: 123 });
    expect(debugSpy).toHaveBeenCalledWith('[DEBUG] debug msg', { extra: 123 });
  });

  it('should suppress all logs when silent is true', () => {
    const l = new Logger({ level: 'debug' });
    l.setSilent(true);

    l.debug('debug');
    l.info('info');
    l.warn('warn');
    l.error('error');
    l.logProgress(1, 10);

    expect(debugSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should format progress log correctly with and without stats', () => {
    const l = new Logger({ level: 'info' });

    l.logProgress(5, 10);
    expect(logSpy).toHaveBeenCalledWith('[PROGRESS] [██████████░░░░░░░░░░] 50.0% (5/10)');

    l.logProgress(10, 10, { rps: 50, failures: 0 });
    expect(logSpy).toHaveBeenCalledWith('[PROGRESS] [████████████████████] 100.0% (10/10) | rps: 50, failures: 0');
  });

  it('should handle zero total gracefully in progress log', () => {
    const l = new Logger({ level: 'info' });
    l.logProgress(0, 0);
    expect(logSpy).toHaveBeenCalledWith('[PROGRESS] [░░░░░░░░░░░░░░░░░░░░] 0.0% (0/0)');
  });

  it('should update level dynamically via setLevel', () => {
    const l = new Logger({ level: 'error' });
    l.info('ignored');
    expect(logSpy).not.toHaveBeenCalled();

    l.setLevel('info');
    expect(l.getLevel()).toBe('info');
    l.info('logged');
    expect(logSpy).toHaveBeenCalledWith('[INFO] logged');
  });
});
