import { describe, it, expect } from 'vitest';
import { Excuse, DEVELOPER_EXCUSES } from './excuse';

describe('Excuse Domain Entity & Pool', () => {
  describe('Excuse Class Instantiation & Properties', () => {
    it('instantiates with id and text', () => {
      const excuse = new Excuse(1, 'It works on my machine.');

      expect(excuse.id).toBe(1);
      expect(excuse.text).toBe('It works on my machine.');
    });

    it('returns text value via the excuse getter', () => {
      const excuse = new Excuse(42, 'The database index rebuild locked the entire table.');

      expect(excuse.excuse).toBe('The database index rebuild locked the entire table.');
      expect(excuse.excuse).toBe(excuse.text);
    });
  });

  describe('DEVELOPER_EXCUSES Pool', () => {
    it('is an array and is non-empty', () => {
      expect(Array.isArray(DEVELOPER_EXCUSES)).toBe(true);
      expect(DEVELOPER_EXCUSES.length).toBeGreaterThan(0);
    });

    it('contains only non-empty, trimmed strings', () => {
      DEVELOPER_EXCUSES.forEach((excuseText, index) => {
        expect(typeof excuseText).toBe('string');
        expect(excuseText.trim().length).toBeGreaterThan(0);
        expect(excuseText).toBe(excuseText.trim());
      });
    });

    it('contains unique excuses without duplicate entries', () => {
      const uniqueSet = new Set(DEVELOPER_EXCUSES);
      expect(uniqueSet.size).toBe(DEVELOPER_EXCUSES.length);
    });

    it('can be mapped to valid Excuse entities with unique sequential IDs', () => {
      const entities = DEVELOPER_EXCUSES.map((text, idx) => new Excuse(idx + 1, text));

      expect(entities).toHaveLength(DEVELOPER_EXCUSES.length);

      const ids = entities.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(entities.length);

      entities.forEach((entity, idx) => {
        expect(entity.id).toBe(idx + 1);
        expect(entity.excuse).toBe(DEVELOPER_EXCUSES[idx]);
        expect(entity.text).toBe(DEVELOPER_EXCUSES[idx]);
      });
    });
  });
});
