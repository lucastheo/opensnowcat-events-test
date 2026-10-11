import { NextResponse } from 'next/server';
import { BusinessError } from '@/business/errors/business.error';

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof BusinessError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    },
    { status: 500 }
  );
}
