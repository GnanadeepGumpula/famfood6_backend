import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/utils/jwt';
import { JWTPayload, ApiResponse } from '@/lib/types';

export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export function authenticateToken(
  request: NextRequest
): { valid: boolean; payload?: JWTPayload; response?: NextResponse } {
  const token = extractToken(request);

  if (!token) {
    const response: ApiResponse = {
      success: false,
      error: 'Missing or invalid authorization token',
    };
    return {
      valid: false,
      response: NextResponse.json(response, { status: 401 }),
    };
  }

  const payload = verifyToken(token);

  if (!payload) {
    const response: ApiResponse = {
      success: false,
      error: 'Invalid or expired token',
    };
    return {
      valid: false,
      response: NextResponse.json(response, { status: 403 }),
    };
  }

  return {
    valid: true,
    payload,
  };
}

export function requireAdmin(
  payload: JWTPayload
): { isAdmin: boolean; response?: NextResponse } {
  if (payload.role !== 'admin') {
    const response: ApiResponse = {
      success: false,
      error: 'Admin access required',
    };
    return {
      isAdmin: false,
      response: NextResponse.json(response, { status: 403 }),
    };
  }

  return {
    isAdmin: true,
  };
}
