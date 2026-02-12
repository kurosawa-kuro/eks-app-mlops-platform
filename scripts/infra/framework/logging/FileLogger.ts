/**
 * FileLogger - writes console output to a log file.
 *
 * Intercepts stdout to tee output to both console and file,
 * stripping ANSI color codes from the file output.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration for FileLogger.
 */
export interface FileLoggerConfig {
  /** Directory for log files (relative to cwd) */
  logsDir?: string;
  /** Prefix for log filenames */
  filenamePrefix?: string;
  /** Header title for the log file */
  headerTitle?: string;
}

/**
 * Writes console output to a log file.
 *
 * @example
 * const logger = new FileLogger({ filenamePrefix: 'eks-deploy' });
 *
 * // Start logging to file
 * const logPath = logger.init(true);
 * console.log('This goes to both console and file');
 *
 * // Stop logging and finalize
 * logger.finalize();
 */
export class FileLogger {
  private logPath: string | null = null;
  private logStream: fs.WriteStream | null = null;
  private originalStdoutWrite: typeof process.stdout.write;
  private config: Required<FileLoggerConfig>;

  constructor(config: FileLoggerConfig = {}) {
    this.originalStdoutWrite = process.stdout.write.bind(process.stdout);
    this.config = {
      logsDir: config.logsDir ?? 'logs',
      filenamePrefix: config.filenamePrefix ?? 'infra',
      headerTitle: config.headerTitle ?? 'Infrastructure Log',
    };
  }

  /**
   * Strip ANSI color codes from string.
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Initialize log file and intercept stdout.
   *
   * @param enabled - Whether to enable file logging
   * @returns Log file path if enabled, null otherwise
   */
  init(enabled: boolean): string | null {
    if (!enabled) return null;

    // Create logs directory
    const logsDir = path.resolve(process.cwd(), this.config.logsDir);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Generate log filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const logFilename = `${this.config.filenamePrefix}-${timestamp}.log`;
    this.logPath = path.join(logsDir, logFilename);

    // Open log file stream
    this.logStream = fs.createWriteStream(this.logPath, { flags: 'a' });

    // Write header
    this.logStream.write(`========================================\n`);
    this.logStream.write(`${this.config.headerTitle}\n`);
    this.logStream.write(`Started: ${now.toISOString()}\n`);
    this.logStream.write(`========================================\n\n`);

    // Intercept process.stdout.write
    process.stdout.write = ((
      chunk: string | Uint8Array,
      encoding?: BufferEncoding | ((err?: Error | null) => void),
      callback?: (err?: Error | null) => void
    ): boolean => {
      this.originalStdoutWrite(chunk, encoding as BufferEncoding, callback as (err?: Error | null) => void);
      if (this.logStream && typeof chunk === 'string') {
        this.logStream.write(this.stripAnsi(chunk));
      }
      return true;
    }) as typeof process.stdout.write;

    return this.logPath;
  }

  /**
   * Finalize log file and restore stdout.
   */
  finalize(): void {
    if (this.logStream) {
      this.logStream.write(`\n========================================\n`);
      this.logStream.write(`Completed: ${new Date().toISOString()}\n`);
      this.logStream.write(`========================================\n`);
      this.logStream.end();
      this.logStream = null;
    }

    // Restore original stdout
    process.stdout.write = this.originalStdoutWrite;
  }

  /**
   * Get the log file path.
   */
  getLogPath(): string | null {
    return this.logPath;
  }

  /**
   * Check if logging is active.
   */
  isActive(): boolean {
    return this.logStream !== null;
  }

  /**
   * Write a message directly to the log file (without console).
   */
  writeToFile(message: string): void {
    if (this.logStream) {
      this.logStream.write(this.stripAnsi(message));
    }
  }
}
