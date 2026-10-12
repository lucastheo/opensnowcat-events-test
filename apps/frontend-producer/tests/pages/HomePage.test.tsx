import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import { eventEmitter } from '@/tracker/event-emitter';

describe('HomePage', () => {
  beforeEach(() => {
    eventEmitter.resetSessionEventCount();
    eventEmitter.setEventMode('both');
  });

  it('renders dashboard heading, service cards, and live stats', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /service dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Simple Calculator')).toBeInTheDocument();
    expect(screen.getByText('Location Timestamp')).toBeInTheDocument();
    expect(screen.getByText('Daily Standup Excuse')).toBeInTheDocument();
    expect(screen.getByText('Dice Emulator')).toBeInTheDocument();

    // Service Navigation Links
    expect(screen.getByTestId('link-nav-calc')).toHaveAttribute('id', 'link-nav-calc');
    expect(screen.getByTestId('link-nav-timestamp')).toHaveAttribute('id', 'link-nav-timestamp');
    expect(screen.getByTestId('link-nav-excuse')).toHaveAttribute('id', 'link-nav-excuse');
    expect(screen.getByTestId('link-nav-dice')).toHaveAttribute('id', 'link-nav-dice');

    // Stats
    expect(screen.getByText('Live Session Statistics')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/both/i)).toBeInTheDocument();
  });

  it('updates live statistics when event count increases', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByText('0')).toBeInTheDocument();

    act(() => {
      eventEmitter.incrementSessionEventCount(5);
    });

    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
