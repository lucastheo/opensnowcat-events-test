import { describe, expect, it } from 'vitest';
import { collectSchema } from '../../src/schemas/collect.schema.js';

describe('collectSchema', () => {
  const body = collectSchema.body as any;

  it('requires the four event fields', () => {
    expect(body.required).toEqual(['event_id', 'timestamp', 'source', 'event_type']);
  });
  it('restricts source and forbids extras', () => {
    expect(body.properties.source.enum).toEqual(['frontend', 'backend']);
    expect(body.additionalProperties).toBe(false);
  });
  it('requires non-empty strings', () => {
    for (const k of ['event_id', 'timestamp', 'event_type']) {
      expect(body.properties[k]).toMatchObject({ type: 'string', minLength: 1 });
    }
  });
  it('defines 201 response', () => {
    const r = (collectSchema.response as any)[201];
    expect(r.required).toEqual(['status', 'event_id']);
  });
});
