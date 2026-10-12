/**
 * Centralized environment configuration for Frontend Producer.
 */

export interface FrontendConfig {
  backendUrl: string;
  simpleCollectorUrl: string;
  openSnowcatUrl: string;
}

const getEnvVar = (key: string, defaultValue: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envObj = import.meta.env as unknown as Record<string, string | undefined>;
    if (envObj[key]) {
      return envObj[key] as string;
    }
  }
  return defaultValue;
};

export const VITE_BACKEND_URL: string = getEnvVar('VITE_BACKEND_URL', 'http://localhost:4000');
export const VITE_SIMPLE_COLLECTOR_URL: string = getEnvVar('VITE_SIMPLE_COLLECTOR_URL', 'http://localhost:5000');
export const VITE_OPENSNOWCAT_COLLECTOR_URL: string =
  getEnvVar('VITE_OPENSNOWCAT_COLLECTOR_URL', '') ||
  getEnvVar('VITE_OPENSNOWCAT_URL', 'http://localhost:8080');
export const VITE_OPENSNOWCAT_URL: string = VITE_OPENSNOWCAT_COLLECTOR_URL;

export const ENV: FrontendConfig = {
  backendUrl: VITE_BACKEND_URL,
  simpleCollectorUrl: VITE_SIMPLE_COLLECTOR_URL,
  openSnowcatUrl: VITE_OPENSNOWCAT_URL
};
