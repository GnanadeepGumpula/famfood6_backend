import jwt from 'jsonwebtoken';
import { JWTPayload } from '@/lib/types';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('JWT_SECRET is not configured. Auth routes that sign tokens will fail until JWT_SECRET is set.');
}

const JWT_EXPIRY = '24h';

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

export function verifyToken(token: string): JWTPayload | null {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not configured');
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}
