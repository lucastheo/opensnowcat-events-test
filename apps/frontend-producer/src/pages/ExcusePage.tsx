import React, { useState } from 'react';
import { getDailyExcuse } from '@/services/backend-api';
import { eventEmitter } from '@/tracker/event-emitter';

export const ExcusePage: React.FC = () => {
  const [excuse, setExcuse] = useState<string | null>(null);
  const [excuseId, setExcuseId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateExcuse = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Delegate excuse generation to Backend Producer API
      const res = await getDailyExcuse();
      setExcuse(res.excuse);
      setExcuseId(res.id);

      // 2. Emit dual-emission tracking events
      await eventEmitter.emitServiceAction({
        structEvent: {
          category: 'service',
          action: 'get_excuse',
          label: 'daily_excuse',
          property: String(res.id),
          value: res.id
        },
        selfDescribingEvent: {
          event: {
            schema: 'iglu:com.opensnowcat.test/excuse_event/jsonschema/1-0-0',
            data: {
              excuse_id: res.id,
              excuse_text: res.excuse
            }
          }
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate excuse';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="excuse-page">
      <div className="page-header">
        <h1 className="page-title">Daily Standup Excuse Generator</h1>
        <p className="page-subtitle">
          "What excuse am I going to give today for not going to the daily?" &mdash; served by the Backend API (GET /api/daily-excuse).
        </p>
      </div>

      <div className="service-container">
        <button
          id="btn-generate-excuse"
          data-testid="btn-generate-excuse"
          type="button"
          className="btn-primary"
          onClick={handleGenerateExcuse}
          disabled={loading}
        >
          {loading ? 'Consulting Excuse Database...' : 'Get Daily Excuse'}
        </button>

        {error && (
          <div className="error-banner" role="alert">
            <span>&#9888;</span>
            <span>{error}</span>
          </div>
        )}

        <div className="result-box">
          <div className="result-box-header">
            Generated Excuse {excuseId !== null ? `(#${excuseId})` : ''}
          </div>
          <div
            id="excuse-result"
            data-testid="excuse-result"
            className="result-value"
            style={{ fontStyle: 'italic', fontWeight: 500 }}
          >
            {excuse || ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcusePage;
