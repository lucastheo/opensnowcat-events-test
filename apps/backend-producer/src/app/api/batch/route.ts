import { NextRequest, NextResponse } from 'next/server';
import { BatchRequestSchema, type BatchResponseBody } from './schema';
import { handleRouteError } from '@/app/api/error-handler';
import { batchService } from '@/business/services/batch.service';

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

  const validation = BatchRequestSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      { errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const domainBatch = await batchService.emitBatch(validation.data);
    const responsePayload: BatchResponseBody = {
      status: domainBatch.status,
      events_emitted: domainBatch.events_emitted
    };
    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error);
  }
}
