import { NextRequest, NextResponse } from 'next/server';
import { DiceRequestSchema, type DiceResponseBody } from './schema';
import { handleRouteError } from '@/app/api/error-handler';
import { diceService } from '@/business/services/dice.service';

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    const text = await req.text();
    rawBody = text.trim() ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (rawBody === null || rawBody === undefined) {
    rawBody = {};
  }

  const validation = DiceRequestSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      { errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const domainDice = await diceService.roll(validation.data);
    const responsePayload: DiceResponseBody = {
      rolls: domainDice.rolls,
      total: domainDice.total
    };
    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error);
  }
}
