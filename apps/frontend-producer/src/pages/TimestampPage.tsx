import React, { useState } from 'react';
import { fetchTimestamp } from '@/services/backend-api';
import { eventEmitter } from '@/tracker/event-emitter';
import { ANYTHING_A_SCHEMA } from '@/tracker/snowcat';

export const TimestampPage: React.FC = () => {
  const defaultTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC';

  const [timezone, setTimezone] = useState<string>(defaultTz);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Delegate timestamp retrieval to Backend Producer API
      const res = await fetchTimestamp(timezone);
      setResult(res.formatted_local);

      // 2. Emit dual-emission tracking events
      await eventEmitter.emitServiceAction({
        structEvent: {
          category: 'service',
          action: 'fetch_timestamp',
          label: timezone,
          property: timezone,
          value: Date.now()
        },
        selfDescribingEvent: {
          event: {
            schema: ANYTHING_A_SCHEMA,
            data: {
              timezone: res.timezone,
              timestamp_iso: res.timestamp_iso
            }
          }
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch timestamp';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="timestamp-page">
      <div className="page-header">
        <h1 className="page-title">Current Location Timestamp</h1>
        <p className="page-subtitle">
          Retrieves current ISO timestamp and localized format from the Backend Producer API (POST /api/timestamp).
        </p>
      </div>

      <div className="service-container">
        <form onSubmit={handleFetch}>
          <div className="form-group">
            <label htmlFor="timestamp-input-tz" className="form-label">
              Timezone (IANA Name)
            </label>
            <input
              id="timestamp-input-tz"
              data-testid="timestamp-input-tz"
              type="text"
              className="form-input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. America/Sao_Paulo, UTC, Europe/London"
              required
            />
          </div>

          <button
            id="btn-timestamp-fetch"
            data-testid="btn-timestamp-fetch"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Fetching...' : 'Get Location Timestamp'}
          </button>
        </form>

        {error && (
          <div className="error-banner" role="alert">
            <span>&#9888;</span>
            <span>{error}</span>
          </div>
        )}

        <div className="result-box">
          <div className="result-box-header">Formatted Local Timestamp</div>
          <div
            id="timestamp-result"
            data-testid="timestamp-result"
            className="result-value"
          >
            {result || ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimestampPage;
