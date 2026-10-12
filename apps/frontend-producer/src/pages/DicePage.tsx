import React, { useState } from 'react';
import { rollDice, type DiceSides, type DiceResponse } from '@/services/backend-api';
import { eventEmitter } from '@/tracker/event-emitter';

export const DicePage: React.FC = () => {
  const [count, setCount] = useState<number>(2);
  const [sides, setSides] = useState<DiceSides>('d6');
  const [result, setResult] = useState<DiceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoll = async (e: React.FormEvent) => {
    e.preventDefault();

    const countNum = parseInt(String(count), 10);
    if (isNaN(countNum) || countNum < 1 || countNum > 10) {
      setError('Please provide a dice count between 1 and 10');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Delegate dice rolling to Backend Producer API
      const res = await rollDice(countNum, sides);
      setResult(res);

      const sidesNumber = parseInt(sides.replace(/^d/, ''), 10);

      // 2. Emit dual-emission tracking events
      await eventEmitter.emitServiceAction({
        structEvent: {
          category: 'service',
          action: 'roll_dice',
          label: sides,
          property: res.rolls.join(','),
          value: res.total
        },
        selfDescribingEvent: {
          event: {
            schema: 'iglu:com.opensnowcat.test/dice_event/jsonschema/1-0-0',
            data: {
              count: countNum,
              sides: sidesNumber,
              rolls: res.rolls,
              total: res.total
            }
          }
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to roll dice';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dice-page">
      <div className="page-header">
        <h1 className="page-title">Dice Emulator</h1>
        <p className="page-subtitle">
          Random polyhedral dice rolling generated on the Backend Producer API (POST /api/dice).
        </p>
      </div>

      <div className="service-container">
        <form onSubmit={handleRoll} noValidate>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="dice-input-count" className="form-label">
                Number of Dice (1-10)
              </label>
              <input
                id="dice-input-count"
                data-testid="dice-input-count"
                type="number"
                min="1"
                max="10"
                className="form-input"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="dice-select-sides" className="form-label">
                Dice Sides
              </label>
              <select
                id="dice-select-sides"
                data-testid="dice-select-sides"
                className="form-select"
                value={sides}
                onChange={(e) => setSides(e.target.value as DiceSides)}
              >
                <option value="d4">d4 (4-sided)</option>
                <option value="d6">d6 (6-sided)</option>
                <option value="d8">d8 (8-sided)</option>
                <option value="d10">d10 (10-sided)</option>
                <option value="d12">d12 (12-sided)</option>
                <option value="d20">d20 (20-sided)</option>
                <option value="d100">d100 (Percentile)</option>
              </select>
            </div>
          </div>

          <button
            id="btn-roll-dice"
            data-testid="btn-roll-dice"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Rolling...' : 'Roll Dice'}
          </button>
        </form>

        {error && (
          <div className="error-banner" role="alert">
            <span>&#9888;</span>
            <span>{error}</span>
          </div>
        )}

        <div className="result-box">
          <div className="result-box-header">Dice Roll Result</div>
          <div
            id="dice-result"
            data-testid="dice-result"
            className="result-value"
          >
            {result ? `Total: ${result.total} (Rolls: [${result.rolls.join(', ')}])` : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DicePage;
