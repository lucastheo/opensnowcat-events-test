import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ExcusePage from '@/pages/ExcusePage';
import * as backendApiModule from '@/services/backend-api';
import { eventEmitter } from '@/tracker/event-emitter';

describe('ExcusePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all required form elements and IDs', () => {
    render(
      <MemoryRouter>
        <ExcusePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('btn-generate-excuse')).toHaveAttribute('id', 'btn-generate-excuse');
    expect(screen.getByTestId('excuse-result')).toHaveAttribute('id', 'excuse-result');
  });

  it('delegates excuse fetching to backend and emits service action event', async () => {
    const excuseSpy = vi.spyOn(backendApiModule, 'getDailyExcuse').mockResolvedValue({
      id: 42,
      excuse: 'My Docker container is eating 100% of my CPU.'
    });
    const emitServiceActionSpy = vi.spyOn(eventEmitter, 'emitServiceAction').mockResolvedValue({
      mode: 'both',
      eventIds: ['evt-1', 'evt-2']
    });

    render(
      <MemoryRouter>
        <ExcusePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('btn-generate-excuse'));

    await waitFor(() => {
      expect(excuseSpy).toHaveBeenCalled();
    });

    expect(await screen.findByTestId('excuse-result')).toHaveTextContent(
      'My Docker container is eating 100% of my CPU.'
    );

    expect(emitServiceActionSpy).toHaveBeenCalledWith({
      structEvent: {
        category: 'service',
        action: 'get_excuse',
        label: 'daily_excuse',
        property: '42',
        value: 42
      },
      selfDescribingEvent: {
        event: {
          schema: 'iglu:com.opensnowcat.test/excuse_event/jsonschema/1-0-0',
          data: {
            excuse_id: 42,
            excuse_text: 'My Docker container is eating 100% of my CPU.'
          }
        }
      }
    });
  });

  it('displays error message when backend excuse fails', async () => {
    vi.spyOn(backendApiModule, 'getDailyExcuse').mockRejectedValue(new Error('Backend offline'));

    render(
      <MemoryRouter>
        <ExcusePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('btn-generate-excuse'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend offline');
  });
});
