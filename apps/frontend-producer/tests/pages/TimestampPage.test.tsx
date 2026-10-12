import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TimestampPage from '@/pages/TimestampPage';
import * as backendApiModule from '@/services/backend-api';
import { eventEmitter } from '@/tracker/event-emitter';
import { ANYTHING_A_SCHEMA } from '@/tracker/snowcat';

describe('TimestampPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all required form elements and IDs', () => {
    render(
      <MemoryRouter>
        <TimestampPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('timestamp-input-tz')).toHaveAttribute('id', 'timestamp-input-tz');
    expect(screen.getByTestId('btn-timestamp-fetch')).toHaveAttribute('id', 'btn-timestamp-fetch');
    expect(screen.getByTestId('timestamp-result')).toHaveAttribute('id', 'timestamp-result');
  });

  it('delegates timestamp retrieval to backend and emits service action event', async () => {
    const fetchSpy = vi.spyOn(backendApiModule, 'fetchTimestamp').mockResolvedValue({
      timezone: 'America/Sao_Paulo',
      timestamp_iso: '2026-10-12T14:30:00.000Z',
      formatted_local: '12/10/2026, 11:30:00'
    });
    const emitServiceActionSpy = vi.spyOn(eventEmitter, 'emitServiceAction').mockResolvedValue({
      mode: 'both',
      eventIds: ['evt-1', 'evt-2']
    });

    render(
      <MemoryRouter>
        <TimestampPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('timestamp-input-tz'), {
      target: { value: 'America/Sao_Paulo' }
    });
    fireEvent.click(screen.getByTestId('btn-timestamp-fetch'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('America/Sao_Paulo');
    });

    expect(await screen.findByTestId('timestamp-result')).toHaveTextContent('12/10/2026, 11:30:00');

    expect(emitServiceActionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        structEvent: expect.objectContaining({
          category: 'service',
          action: 'fetch_timestamp',
          label: 'America/Sao_Paulo',
          property: 'America/Sao_Paulo'
        }),
        selfDescribingEvent: {
          event: {
            schema: ANYTHING_A_SCHEMA,
            data: {
              timezone: 'America/Sao_Paulo',
              timestamp_iso: '2026-10-12T14:30:00.000Z'
            }
          }
        }
      })
    );
  });

  it('displays error message when backend fetch fails', async () => {
    vi.spyOn(backendApiModule, 'fetchTimestamp').mockRejectedValue(new Error('Invalid timezone'));

    render(
      <MemoryRouter>
        <TimestampPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('timestamp-input-tz'), {
      target: { value: 'Invalid/Zone' }
    });
    fireEvent.click(screen.getByTestId('btn-timestamp-fetch'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid timezone');
  });
});
