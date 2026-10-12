import React, { useState } from 'react';
import { calculate, type CalcOperator } from '@/services/backend-api';
import { eventEmitter } from '@/tracker/event-emitter';

export const CalcPage: React.FC = () => {
  const [a, setA] = useState<string>('12');
  const [operator, setOperator] = useState<CalcOperator>('+');
  const [b, setB] = useState<string>('4');
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!a.trim() || !b.trim() || isNaN(Number(a)) || isNaN(Number(b))) {
      setError('Please provide valid numbers for both operands');
      return;
    }

    const numA = Number(a);
    const numB = Number(b);

    setLoading(true);
    setError(null);

    try {
      // 1. Delegate computation to Backend Producer API
      const res = await calculate(numA, numB, operator);
      setResult(res.result);

      // 2. Emit dual-emission tracking events (Snowcat + Simple Collector)
      await eventEmitter.emitServiceAction({
        structEvent: {
          category: 'service',
          action: 'calculate',
          label: operator,
          property: `${numA}${operator}${numB}`,
          value: res.result
        },
        selfDescribingEvent: {
          event: {
            schema: 'iglu:com.opensnowcat.test/calc_event/jsonschema/1-0-0',
            data: {
              a: numA,
              b: numB,
              operator,
              result: res.result
            }
          }
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Calculation failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="calc-page">
      <div className="page-header">
        <h1 className="page-title">Simple Calculator</h1>
        <p className="page-subtitle">
          Arithmetic operations computed on the Backend Producer API (POST /api/calc).
        </p>
      </div>

      <div className="service-container">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="calc-input-a" className="form-label">
                Number A
              </label>
              <input
                id="calc-input-a"
                data-testid="calc-input-a"
                type="number"
                step="any"
                className="form-input"
                value={a}
                onChange={(e) => setA(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ width: '90px' }}>
              <label htmlFor="calc-select-op" className="form-label">
                Operator
              </label>
              <select
                id="calc-select-op"
                data-testid="calc-select-op"
                className="form-select"
                value={operator}
                onChange={(e) => setOperator(e.target.value as CalcOperator)}
              >
                <option value="+">+</option>
                <option value="-">-</option>
                <option value="*">*</option>
                <option value="/">/</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="calc-input-b" className="form-label">
                Number B
              </label>
              <input
                id="calc-input-b"
                data-testid="calc-input-b"
                type="number"
                step="any"
                className="form-input"
                value={b}
                onChange={(e) => setB(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            id="btn-calc-submit"
            data-testid="btn-calc-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Calculating...' : 'Calculate'}
          </button>
        </form>

        {error && (
          <div className="error-banner" role="alert">
            <span>&#9888;</span>
            <span>{error}</span>
          </div>
        )}

        <div className="result-box">
          <div className="result-box-header">Calculation Result</div>
          <div id="calc-result" data-testid="calc-result" className="result-value">
            {result !== null ? result : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalcPage;
