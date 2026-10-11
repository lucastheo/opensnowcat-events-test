import { Calculation } from '@/business/domain/calculation';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

export interface CalculateParams {
  a: number;
  b: number;
  operator: string;
}

export class CalcService {
  async calculate({ a, b, operator }: CalculateParams): Promise<Calculation> {
    let result: number;
    switch (operator) {
      case '+':
        result = a + b;
        break;
      case '-':
        result = a - b;
        break;
      case '*':
        result = a * b;
        break;
      case '/':
        if (b === 0) {
          throw new Error('Division by zero');
        }
        result = a / b;
        break;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }

    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await dispatchDualEmission({
      category: 'backend_service',
      action: 'calculate',
      label: operator,
      property: `${a}${operator}${b}`,
      value: result,
      eventId,
      timestamp,
      eventType: 'backend_api'
    });

    return new Calculation(a, b, operator, result);
  }
}

export const calcService = new CalcService();
