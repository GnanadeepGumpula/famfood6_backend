/**
 * Simple in-memory rate limiter for API endpoints
 * In production, use Redis-based rate limiting for distributed systems
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests within the window
}

/**
 * Check if a request should be rate limited
 * @param identifier Unique identifier (e.g., IP address or phone number)
 * @param config Rate limit configuration
 * @returns Object with allowed boolean and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // If no entry or window expired, create new entry
  if (!entry || now >= entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
    };
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
  };
}

/**
 * Clear rate limit entry (useful after successful verification)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Cleanup expired entries every 5 minutes
 */
if (typeof global !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now >= entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}
