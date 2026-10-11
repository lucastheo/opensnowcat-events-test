import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  corsOrigin: string;
  csvFilePath: string;
  logLevel: string;
}

export function loadConfig(): AppConfig {
  const envCsvPath = process.env.CSV_FILE_PATH || process.env.EVENTS_CSV_PATH || './data/events.csv';

  return {
    port: parseInt(process.env.PORT || '5000', 10),
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    csvFilePath: path.resolve(process.cwd(), envCsvPath),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
