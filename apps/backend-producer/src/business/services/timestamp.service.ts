import { TimeLocation, isValidTimezone } from '@/business/domain/timestamp-info';
import { InvalidTimezoneError } from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

export interface TimestampParams {
  timezone?: string;
}

export class TimestampService {
  async getTimestamp({ timezone }: TimestampParams = {}): Promise<TimeLocation> {
    const tz = timezone ?? 'UTC';

    if (!isValidTimezone(tz)) {
      throw new InvalidTimezoneError(tz);
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const eventId = crypto.randomUUID();

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const formattedLocal = `${getPart('day')}/${getPart('month')}/${getPart('year')}, ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

    await dispatchDualEmission({
      category: 'backend_service',
      action: 'timestamp',
      label: tz,
      property: formattedLocal,
      eventId,
      timestamp,
      eventType: 'backend_api'
    });

    return new TimeLocation(timestamp, formattedLocal, tz);
  }
}

export const timestampService = new TimestampService();
