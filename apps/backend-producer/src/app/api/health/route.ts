import { NextResponse } from 'next/server';
import { handleRouteError } from '@/app/api/error-handler';

export async function GET() {
  try {
    return NextResponse.json({ status: 'ok', service: 'backend-producer' });
  } catch (error: unknown) {
    return handleRouteError(error);
  }
}
