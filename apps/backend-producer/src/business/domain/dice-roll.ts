export type DiceSides = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

const DICE_SIDES_MAP: Record<DiceSides, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

export function getSidesNumber(sides: DiceSides): number {
  return DICE_SIDES_MAP[sides];
}

export class DiceRoll {
  constructor(
    public readonly rolls: number[],
    public readonly total: number,
    public readonly sides: DiceSides,
    public readonly count: number,
    public readonly rolledAt: Date = new Date()
  ) {}
}
