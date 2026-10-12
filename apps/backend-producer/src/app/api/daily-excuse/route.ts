import { NextResponse } from 'next/server';
import { type DailyExcuseResponseBody } from './schema';
import { handleRouteError } from '@/app/api/error-handler';
import { excuseService } from '@/business/services/excuse.service';

export async function GET() {
  try {
    const domainExcuse = await excuseService.getRandomExcuse();
    const responsePayload: DailyExcuseResponseBody = {
      id: domainExcuse.id,
      excuse: domainExcuse.excuse
    };
    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error);
  }
}
