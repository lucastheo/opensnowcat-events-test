export class TimeLocation {
  constructor(
    public readonly timestampIso: string,
    public readonly formattedLocal: string,
    public readonly timezone: string
  ) {}

  public static isValidTimezone(tz: string): boolean {
    if (!tz || typeof tz !== 'string') {
      return false;
    }
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }
}

export function isValidTimezone(tz: string): boolean {
  return TimeLocation.isValidTimezone(tz);
}
