import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderApp } from './test-router';
import { eventEmitter } from '@/tracker/event-emitter';

vi.mock('@snowplow/browser-tracker', () => ({
  newTracker: vi.fn(),
  trackPageView: vi.fn(),
  trackStructEvent: vi.fn(),
  trackSelfDescribingEvent: vi.fn()
}));

describe('Network and API Error Resilience - End-to-End Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventEmitter.resetSessionEventCount();
    eventEmitter.setEventMode('both');
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('/collect')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: 'recorded', event_id: 'mock-id' })
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });
  });

  it('renders error alert when Backend API returns HTTP 500 on /calc without crashing the app', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      if (urlStr.includes('/collect')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: 'recorded', event_id: 'err-id' })
        } as Response;
      }

      if (urlStr.includes('/api/calc')) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'Calculation engine overload' })
        } as Response;
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    renderApp('/calc');
    await waitFor(() => {
      expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');
    });

    const submitBtn = screen.getByTestId('btn-calc-submit');
    fireEvent.click(submitBtn);

    // 1. Error alert is rendered in the DOM
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Calculation engine overload');

    // 2. Result container remains empty
    expect(screen.getByTestId('calc-result')).toHaveTextContent('');

    // 3. Navigation and controls are still fully intact and functional
    expect(screen.getByTestId('link-nav-home')).toBeInTheDocument();
    expect(screen.getByTestId('event-mode-select')).toBeInTheDocument();
    expect(screen.getByTestId('frontend-events-counter')).toBeInTheDocument();
  });

  it('renders network error alert when Backend API is unreachable (network failure) on /calc', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      if (urlStr.includes('/collect')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: 'recorded', event_id: 'err-id' })
        } as Response;
      }

      if (urlStr.includes('/api/calc')) {
        throw new TypeError('Failed to fetch');
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    renderApp('/calc');
    await waitFor(() => {
      expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');
    });

    const submitBtn = screen.getByTestId('btn-calc-submit');
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/network error: failed to fetch/i);
    expect(screen.getByTestId('calc-result')).toHaveTextContent('');
  });

  it('renders error alert when Backend API returns HTTP 500 on /timestamp', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      if (urlStr.includes('/collect')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: 'recorded', event_id: 'err-id' })
        } as Response;
      }

      if (urlStr.includes('/api/timestamp')) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Invalid IANA timezone database' })
        } as Response;
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    renderApp('/timestamp');
    await waitFor(() => {
      expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');
    });

    const fetchBtn = screen.getByTestId('btn-timestamp-fetch');
    fireEvent.click(fetchBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Invalid IANA timezone database');
    expect(screen.getByTestId('timestamp-result')).toHaveTextContent('');
  });

  it('renders error alert when Backend API fails with network disconnection on /excuse', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      if (urlStr.includes('/collect')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: 'recorded', event_id: 'err-id' })
        } as Response;
      }

      if (urlStr.includes('/api/daily-excuse')) {
        throw new Error('Connection reset by peer');
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    renderApp('/excuse');
    await waitFor(() => {
      expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');
    });

    const generateBtn = screen.getByTestId('btn-generate-excuse');
    fireEvent.click(generateBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/connection reset by peer/i);
    expect(screen.getByTestId('excuse-result')).toHaveTextContent('');
  });

  it('renders error alert when Backend API returns HTTP 500 on /dice', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      if (urlStr.includes('/collect')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: 'recorded', event_id: 'err-id' })
        } as Response;
      }

      if (urlStr.includes('/api/dice')) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'RNG hardware entropy exhausted' })
        } as Response;
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    renderApp('/dice');
    await waitFor(() => {
      expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');
    });

    const rollBtn = screen.getByTestId('btn-roll-dice');
    fireEvent.click(rollBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('RNG hardware entropy exhausted');
    expect(screen.getByTestId('dice-result')).toHaveTextContent('');
  });

  it('recovers gracefully and displays successful result after subsequent retry', async () => {
    let shouldFail = true;

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      if (urlStr.includes('/collect')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ status: 'recorded', event_id: 'retry-id' })
        } as Response;
      }

      if (urlStr.includes('/api/calc')) {
        if (shouldFail) {
          shouldFail = false;
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Transient failure' })
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ result: 99 })
        } as Response;
      }

      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });

    renderApp('/calc');
    await waitFor(() => {
      expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');
    });

    const submitBtn = screen.getByTestId('btn-calc-submit');

    // First attempt fails
    fireEvent.click(submitBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent('Transient failure');

    // Second attempt succeeds
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('calc-result')).toHaveTextContent('99');
  });
});
