import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { eventEmitter } from '@/tracker/event-emitter';

describe('App Layout & Header', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    eventEmitter.resetSessionEventCount();
    eventEmitter.setEventMode('both');
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/collect')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'ok', event_id: 'mock-id' })
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      } as Response);
    });
  });

  it('renders all 5 navigation links with required IDs and data-testids', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('link-nav-home')).toHaveAttribute('id', 'link-nav-home');
    expect(screen.getByTestId('header-nav-calc')).toHaveAttribute('id', 'header-nav-calc');
    expect(screen.getByTestId('header-nav-timestamp')).toHaveAttribute('id', 'header-nav-timestamp');
    expect(screen.getByTestId('header-nav-excuse')).toHaveAttribute('id', 'header-nav-excuse');
    expect(screen.getByTestId('header-nav-dice')).toHaveAttribute('id', 'header-nav-dice');
    await waitFor(() => {
      expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');
    });
  });

  it('renders global event counter and mode selector', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const counter = screen.getByTestId('frontend-events-counter');
    expect(counter).toHaveAttribute('id', 'frontend-events-counter');

    const modeSelect = screen.getByTestId('event-mode-select');
    expect(modeSelect).toHaveAttribute('id', 'event-mode-select');
    expect(modeSelect).toHaveValue('both');

    await waitFor(() => {
      expect(counter).toHaveTextContent('1');
    });
  });

  it('changes event mode when selector changes', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const modeSelect = screen.getByTestId('event-mode-select');
    fireEvent.change(modeSelect, { target: { value: 'self_describing_only' } });

    expect(eventEmitter.getEventMode()).toBe('self_describing_only');
    expect(modeSelect).toHaveValue('self_describing_only');

    await waitFor(() => {
      expect(screen.getByTestId('frontend-events-counter')).toHaveTextContent('1');
    });
  });

  it('emits page view event on initial load and route changes', () => {
    const emitPageViewSpy = vi.spyOn(eventEmitter, 'emitPageView').mockResolvedValue({
      eventId: 'mock-eid',
      timestamp: '2026-10-12T00:00:00.000Z',
      eventType: 'page_view'
    });

    render(
      <MemoryRouter initialEntries={['/calc']}>
        <App />
      </MemoryRouter>
    );

    expect(emitPageViewSpy).toHaveBeenCalledWith({
      title: 'Simple Calculator'
    });
  });

  it('updates title for other routes on navigation', () => {
    const emitPageViewSpy = vi.spyOn(eventEmitter, 'emitPageView').mockResolvedValue({
      eventId: 'mock-eid',
      timestamp: '2026-10-12T00:00:00.000Z',
      eventType: 'page_view'
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/timestamp']}>
        <App />
      </MemoryRouter>
    );
    expect(emitPageViewSpy).toHaveBeenCalledWith({ title: 'Location Timestamp' });
    unmount();

    render(
      <MemoryRouter initialEntries={['/excuse']}>
        <App />
      </MemoryRouter>
    );
    expect(emitPageViewSpy).toHaveBeenCalledWith({ title: 'Daily Standup Excuse' });

    render(
      <MemoryRouter initialEntries={['/dice']}>
        <App />
      </MemoryRouter>
    );
    expect(emitPageViewSpy).toHaveBeenCalledWith({ title: 'Dice Emulator' });
  });
});
