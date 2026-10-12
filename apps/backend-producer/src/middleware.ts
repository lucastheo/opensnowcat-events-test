import { NextResponse, type NextRequest } from 'next/server';

export const ALLOWED_METHODS = 'GET, POST, OPTIONS';
export const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With';
export const MAX_AGE = '86400';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl?.pathname ?? new URL(request.url).pathname;

  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const origin = process.env.CORS_ORIGIN || '*';

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Max-Age': MAX_AGE,
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
