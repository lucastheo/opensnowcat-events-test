import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CalcPage from '@/pages/CalcPage';
import * as backendApiModule from '@/services/backend-api';
import { eventEmitter } from '@/tracker/event-emitter';

describe('CalcPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all required form elements and IDs', () => {
    render(
      <MemoryRouter>
        <CalcPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('calc-input-a')).toHaveAttribute('id', 'calc-input-a');
    expect(screen.getByTestId('calc-select-op')).toHaveAttribute('id', 'calc-select-op');
    expect(screen.getByTestId('calc-input-b')).toHaveAttribute('id', 'calc-input-b');
    expect(screen.getByTestId('btn-calc-submit')).toHaveAttribute('id', 'btn-calc-submit');
    expect(screen.getByTestId('calc-result')).toHaveAttribute('id', 'calc-result');
  });

  it('delegates calculation to backend and emits service action event', async () => {
    const calculateSpy = vi.spyOn(backendApiModule, 'calculate').mockResolvedValue({ result: 25 });
    const emitServiceActionSpy = vi.spyOn(eventEmitter, 'emitServiceAction').mockResolvedValue({
      mode: 'both',
      eventIds: ['evt-1', 'evt-2']
    });

    render(
      <MemoryRouter>
        <CalcPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('calc-input-a'), { target: { value: '20' } });
    fireEvent.change(screen.getByTestId('calc-select-op'), { target: { value: '+' } });
    fireEvent.change(screen.getByTestId('calc-input-b'), { target: { value: '5' } });

    fireEvent.click(screen.getByTestId('btn-calc-submit'));

    await waitFor(() => {
      expect(calculateSpy).toHaveBeenCalledWith(20, 5, '+');
    });

    expect(await screen.findByTestId('calc-result')).toHaveTextContent('25');

    expect(emitServiceActionSpy).toHaveBeenCalledWith({
      structEvent: {
        category: 'service',
        action: 'calculate',
        label: 'addition',
        property: '20+5',
        value: 25
      },
      selfDescribingEvent: {
        event: {
          schema: 'iglu:com.opensnowcat.test/calc_event/jsonschema/1-0-0',
          data: {
            a: 20,
            b: 5,
            operator: '+',
            result: 25
          }
        }
      }
    });
  });

  it('displays error message when backend calculation fails', async () => {
    vi.spyOn(backendApiModule, 'calculate').mockRejectedValue(new Error('Division by zero'));

    render(
      <MemoryRouter>
        <CalcPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('calc-input-a'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('calc-select-op'), { target: { value: '/' } });
    fireEvent.change(screen.getByTestId('calc-input-b'), { target: { value: '0' } });

    fireEvent.click(screen.getByTestId('btn-calc-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Division by zero');
  });

  it('displays error when inputs are invalid numbers', async () => {
    render(
      <MemoryRouter>
        <CalcPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('calc-input-a'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('btn-calc-submit'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please provide valid numbers for both operands'
    );
  });
});
