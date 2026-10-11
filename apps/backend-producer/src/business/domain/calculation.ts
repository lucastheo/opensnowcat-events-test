export class Calculation {
  constructor(
    public readonly a: number,
    public readonly b: number,
    public readonly operator: string,
    public readonly result: number,
    public readonly calculatedAt: Date = new Date()
  ) {}

  public isDivision(): boolean {
    return this.operator === '/';
  }
}
