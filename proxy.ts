import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const configuredOrigins = (
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:8080,http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowAllOrigins = configuredOrigins.includes('*');

  const localhostOriginPattern =
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
  const privateNetworkOriginPattern =
    /^https?:\/\/((10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))(?::\d+)?$/i;
  const originAllowed =
    !origin ||
    allowAllOrigins ||
    configuredOrigins.includes(origin) ||
    (process.env.NODE_ENV !== 'production' &&
      (localhostOriginPattern.test(origin) ||
        privateNetworkOriginPattern.test(origin)));

  const corsOriginHeader = allowAllOrigins ? '*' : origin;

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...(originAllowed ? { 'Access-Control-Allow-Origin': corsOriginHeader } : {}),
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    });
  }

  const response = NextResponse.next();
  if (originAllowed) {
    response.headers.set('Access-Control-Allow-Origin', corsOriginHeader);
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    response.headers.set('Vary', 'Origin');
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};