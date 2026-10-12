import { describe, it, expect } from 'vitest';
import { TimeLocation, isValidTimezone } from './timestamp-info';

describe('Timestamp Info Domain Entity & Helpers', () => {
  describe('TimeLocation Class Instantiation', () => {
    it('instantiates correctly and preserves properties', () => {
      const iso = '2026-10-11T14:30:00.123Z';
      const local = '11/10/2026, 11:30:00';
      const tz = 'America/Sao_Paulo';

      const timeLocation = new TimeLocation(iso, local, tz);

      expect(timeLocation.timestampIso).toBe(iso);
      expect(timeLocation.formattedLocal).toBe(local);
      expect(timeLocation.timezone).toBe(tz);
    });
  });

  describe('TimeLocation.isValidTimezone', () => {
    it('returns true for standard valid IANA timezones', () => {
      expect(TimeLocation.isValidTimezone('UTC')).toBe(true);
      expect(TimeLocation.isValidTimezone('America/Sao_Paulo')).toBe(true);
      expect(TimeLocation.isValidTimezone('Europe/London')).toBe(true);
      expect(TimeLocation.isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(TimeLocation.isValidTimezone('America/New_York')).toBe(true);
      expect(TimeLocation.isValidTimezone('Australia/Sydney')).toBe(true);
    });

    it('returns false for invalid timezone names', () => {
      expect(TimeLocation.isValidTimezone('Invalid/Zone')).toBe(false);
      expect(TimeLocation.isValidTimezone('Not/A_Timezone')).toBe(false);
      expect(TimeLocation.isValidTimezone('Mars/Olympus_Mons')).toBe(false);
    });

    it('returns false for empty string and non-string or falsy values', () => {
      expect(TimeLocation.isValidTimezone('')).toBe(false);
      expect(TimeLocation.isValidTimezone(null as unknown as string)).toBe(false);
      expect(TimeLocation.isValidTimezone(undefined as unknown as string)).toBe(false);
      expect(TimeLocation.isValidTimezone(12345 as unknown as string)).toBe(false);
      expect(TimeLocation.isValidTimezone({} as unknown as string)).toBe(false);
    });
  });

  describe('isValidTimezone function export', () => {
    it('delegates to TimeLocation.isValidTimezone and returns consistent results', () => {
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('America/Sao_Paulo')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Invalid/Zone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });
});
