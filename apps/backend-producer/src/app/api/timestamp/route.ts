import { NextRequest, NextResponse } from 'next/server';
import { TimestampRequestSchema, type TimestampResponseBody } from './schema';
import { timestampService } from '@/business/services/timestamp.service';

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

  const validation = TimestampRequestSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      { errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const domainTime = await timestampService.getTimestamp(validation.data);
    const responsePayload: TimestampResponseBody = {
      timestamp_iso: domainTime.timestampIso,
      formatted_local: domainTime.formattedLocal,
      timezone: domainTime.timezone
    };
    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('Invalid timezone')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 }
    );
  }
}
