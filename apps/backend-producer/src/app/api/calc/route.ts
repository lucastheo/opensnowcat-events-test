import { NextRequest, NextResponse } from 'next/server';
import { CalcRequestSchema, type CalcResponseBody } from './schema';
import { handleRouteError } from '@/app/api/error-handler';
import { calcService } from '@/business/services/calc.service';

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    const text = await req.text();
    rawBody = text.trim() ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = CalcRequestSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      { errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const domainCalculation = await calcService.calculate(validation.data);
    const responsePayload: CalcResponseBody = {
      result: domainCalculation.result
    };
    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error);
  }
}
