import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import crypto from 'node:crypto';

// Polyfill crypto.randomUUID if not present in jsdom
if (!globalThis.crypto) {
  // @ts-expect-error polyfill
  globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => crypto.randomUUID();
}

afterEach(() => {
  cleanup();
});
