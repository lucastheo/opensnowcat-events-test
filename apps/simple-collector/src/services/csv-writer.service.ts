import fs from 'node:fs/promises';
import path from 'node:path';

export interface EventRecord {
  event_id: string;
  timestamp: string;
  source: 'frontend' | 'backend';
  event_type: string;
}

export interface CollectorStats {
  total_recorded: number;
  frontend_events: number;
  backend_events: number;
  csv_file_path: string;
}

export class CsvWriterService {
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();
  private isInitialized = false;

  private totalRecorded = 0;
  private frontendEvents = 0;
  private backendEvents = 0;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Initializes the directory and CSV file with header if not present.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      // File does not exist: write header row
      const header = 'event_id,timestamp,source,event_type\n';
      await fs.writeFile(this.filePath, header, { encoding: 'utf-8', flag: 'wx' });
    }

    this.isInitialized = true;
  }

  /**
   * Appends an event record strictly sequentially.
   */
  public async append(record: EventRecord): Promise<void> {
    // Chain onto the write queue to guarantee sequential execution
    return new Promise((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(async () => {
          if (!this.isInitialized) {
            await this.initialize();
          }

          const line = this.formatRow(record);
          await fs.appendFile(this.filePath, line, { encoding: 'utf-8', flag: 'a' });

          // Update internal stats
          this.totalRecorded++;
          if (record.source === 'frontend') {
            this.frontendEvents++;
          } else {
            this.backendEvents++;
          }

          resolve();
        })
        .catch((err) => {
          // Reject caller but keep the queue healthy for future writes
          reject(err);
        });
    });
  }

  /**
   * Formats and escapes a row for safe CSV storage.
   */
  private formatRow(record: EventRecord): string {
    const sanitize = (val: string): string => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    return [
      sanitize(record.event_id),
      sanitize(record.timestamp),
      sanitize(record.source),
      sanitize(record.event_type)
    ].join(',') + '\n';
  }

  /**
   * Resets the CSV file back to just the header row.
   */
  public async reset(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(async () => {
          const dir = path.dirname(this.filePath);
          await fs.mkdir(dir, { recursive: true });

          const header = 'event_id,timestamp,source,event_type\n';
          await fs.writeFile(this.filePath, header, { encoding: 'utf-8' });

          this.totalRecorded = 0;
          this.frontendEvents = 0;
          this.backendEvents = 0;
          this.isInitialized = true;

          resolve();
        })
        .catch(reject);
    });
  }

  public getStats(): CollectorStats {
    return {
      total_recorded: this.totalRecorded,
      frontend_events: this.frontendEvents,
      backend_events: this.backendEvents,
      csv_file_path: this.filePath
    };
  }
}
