import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:8080,http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim());

  const localhostOriginPattern =
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
  const privateNetworkOriginPattern =
    /^https?:\/\/((10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))(?::\d+)?$/i;
  const originAllowed =
    allowedOrigins.includes(origin) ||
    (process.env.NODE_ENV !== 'production' &&
      (localhostOriginPattern.test(origin) ||
        privateNetworkOriginPattern.test(origin)));

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': originAllowed ? origin : '',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const response = NextResponse.next();
  if (originAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};