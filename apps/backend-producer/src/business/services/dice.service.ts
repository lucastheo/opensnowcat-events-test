import { DiceRoll, getSidesNumber, type DiceSides } from '@/business/domain/dice-roll';
import { InvalidDiceError } from '@/business/errors/business.error';
import { dispatchDualEmission } from '@/business/tracking.dispatcher';

export interface DiceRollParams {
  count?: number;
  sides?: DiceSides;
}

export class DiceService {
  async roll({ count = 2, sides = 'd6' }: DiceRollParams = {}): Promise<DiceRoll> {
    if (count < 1 || count > 10 || !Number.isInteger(count)) {
      throw new InvalidDiceError('Dice count must be between 1 and 10');
    }

    const sidesNumber = getSidesNumber(sides);
    if (!sidesNumber) {
      throw new InvalidDiceError(`Unsupported dice sides: ${sides}`);
    }

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sidesNumber) + 1);
    }
    const total = rolls.reduce((acc, curr) => acc + curr, 0);

    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await dispatchDualEmission({
      category: 'backend_service',
      action: 'dice_roll',
      label: sides,
      property: rolls.join(','),
      value: total,
      eventId,
      timestamp,
      eventType: 'backend_api'
    });

    return new DiceRoll(rolls, total, sides, count);
  }
}

export const diceService = new DiceService();
