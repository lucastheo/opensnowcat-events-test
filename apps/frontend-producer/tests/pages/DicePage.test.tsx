import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DicePage from '@/pages/DicePage';
import * as backendApiModule from '@/services/backend-api';
import { eventEmitter } from '@/tracker/event-emitter';

describe('DicePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all required form elements and IDs', () => {
    render(
      <MemoryRouter>
        <DicePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('dice-input-count')).toHaveAttribute('id', 'dice-input-count');
    expect(screen.getByTestId('dice-select-sides')).toHaveAttribute('id', 'dice-select-sides');
    expect(screen.getByTestId('btn-roll-dice')).toHaveAttribute('id', 'btn-roll-dice');
    expect(screen.getByTestId('dice-result')).toHaveAttribute('id', 'dice-result');
  });

  it('delegates dice roll to backend and emits service action event', async () => {
    const rollSpy = vi.spyOn(backendApiModule, 'rollDice').mockResolvedValue({
      rolls: [4, 6],
      total: 10
    });
    const emitServiceActionSpy = vi.spyOn(eventEmitter, 'emitServiceAction').mockResolvedValue({
      mode: 'both',
      eventIds: ['evt-1', 'evt-2']
    });

    render(
      <MemoryRouter>
        <DicePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('dice-input-count'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('dice-select-sides'), { target: { value: 'd6' } });
    fireEvent.click(screen.getByTestId('btn-roll-dice'));

    await waitFor(() => {
      expect(rollSpy).toHaveBeenCalledWith(2, 'd6');
    });

    expect(await screen.findByTestId('dice-result')).toHaveTextContent('Total: 10 (Rolls: [4, 6])');

    expect(emitServiceActionSpy).toHaveBeenCalledWith({
      structEvent: {
        category: 'service',
        action: 'roll_dice',
        label: 'd6',
        property: '4,6',
        value: 10
      },
      selfDescribingEvent: {
        event: {
          schema: 'iglu:com.opensnowcat.test/dice_event/jsonschema/1-0-0',
          data: {
            count: 2,
            sides: 6,
            rolls: [4, 6],
            total: 10
          }
        }
      }
    });
  });

  it('displays error message when count is out of bounds', async () => {
    render(
      <MemoryRouter>
        <DicePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('dice-input-count'), { target: { value: '15' } });
    fireEvent.click(screen.getByTestId('btn-roll-dice'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please provide a dice count between 1 and 10'
    );
  });
});
