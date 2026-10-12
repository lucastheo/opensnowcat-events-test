import { NextResponse } from 'next/server';
import { BusinessError } from '@/business/errors/business.error';

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof BusinessError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { error: 'Internal Server Error', message },
    { status: 500 }
  );
}
