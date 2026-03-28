import { OTPSession } from '@/lib/types';

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY || '600'); // 10 minutes default
const otpStore = new Map<string, OTPSession>();

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeOTP(mobileNumber: string, otp: string): void {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY * 1000);
  otpStore.set(mobileNumber, {
    mobileNumber,
    otp,
    expiresAt,
  });
}

export function verifyOTP(mobileNumber: string, otp: string): boolean {
  const session = otpStore.get(mobileNumber);

  if (!session) {
    return false;
  }

  if (new Date() > session.expiresAt) {
    otpStore.delete(mobileNumber);
    return false;
  }

  if (session.otp !== otp) {
    return false;
  }

  otpStore.delete(mobileNumber);
  return true;
}

export function getOTPSession(mobileNumber: string): OTPSession | null {
  return otpStore.get(mobileNumber) || null;
}

export function cleanupExpiredOTPs(): void {
  const now = new Date();
  for (const [key, session] of otpStore.entries()) {
    if (now > session.expiresAt) {
      otpStore.delete(key);
    }
  }
}

// Cleanup expired OTPs every 5 minutes
if (typeof global !== 'undefined') {
  setInterval(() => {
    cleanupExpiredOTPs();
  }, 5 * 60 * 1000);
}
