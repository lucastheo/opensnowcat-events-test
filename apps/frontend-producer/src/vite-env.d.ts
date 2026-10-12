/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_SIMPLE_COLLECTOR_URL?: string;
  readonly VITE_OPENSNOWCAT_URL?: string;
  readonly VITE_OPENSNOWCAT_COLLECTOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
