import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { verifyOTP } from '@/lib/utils/otp';
import { signToken } from '@/lib/utils/jwt';
import { normalizeMobileNumber, validateMobileNumber } from '@/lib/utils/order';
import { checkRateLimit, clearRateLimit } from '@/lib/utils/rateLimit';
import { ApiResponse } from '@/lib/types';
import User from '@/lib/models/User';
import OtpSession from '@/lib/models/OtpSession';

const verifyOtpSchema = z.object({
  mobileNumber: z.string(),
  otp: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobileNumber: inputMobileNumber, otp } = verifyOtpSchema.parse(body);
    const mobileNumber = normalizeMobileNumber(inputMobileNumber);

    if (!validateMobileNumber(mobileNumber)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid mobile number format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!/^[0-9]{6}$/.test(otp)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid OTP format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Rate limiting: 10 verification attempts per 5 minutes per phone number
    const rateLimitCheck = checkRateLimit(`verify-${mobileNumber}`, {
      windowMs: 5 * 60 * 1000,
      maxRequests: 10,
    });

    if (!rateLimitCheck.allowed) {
      const response: ApiResponse = {
        success: false,
        error: `Too many verification attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`,
      };
      return NextResponse.json(response, { status: 429 });
    }

    await connectToDatabase();

    // Verify against OTP session collection first (reliable across server instances)
    let isValid = false;

    const otpSession = await OtpSession.findOne({ mobileNumber });
    if (otpSession) {
      const isExpired = new Date() > new Date(otpSession.expiresAt);
      if (!isExpired && otpSession.otp === otp) {
        isValid = true;
      }

      // Clear OTP after check (on success or expiry) to reduce replay risk
      if (isValid || isExpired) {
        await OtpSession.deleteOne({ mobileNumber });
      }
    }

    // Backward-compatible fallback for in-memory OTPs
    if (!isValid) {
      isValid = verifyOTP(mobileNumber, otp);
    }

    if (!isValid) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid or expired OTP',
      };
      return NextResponse.json(response, { status: 401 });
    }

    // Find or create user
    let user = await User.findOne({ mobileNumber });
    if (!user) {
      user = new User({
        mobileNumber,
        profileDetails: {},
        loyaltyCounter: new Map(),
      });
      await user.save();
    }

    // Generate JWT token – grant admin role if phone is in ADMIN_PHONES env list
    const adminPhones = (process.env.ADMIN_PHONES || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const role: 'admin' | 'user' = adminPhones.includes(mobileNumber) ? 'admin' : 'user';

    const token = signToken({
      userId: user._id.toString(),
      mobileNumber,
      role,
    });

    // Clear rate limit on successful verification
    clearRateLimit(`verify-${mobileNumber}`);

    const response: ApiResponse = {
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        user: {
          userId: user._id.toString(),
          mobileNumber: user.mobileNumber,
          profileDetails: user.profileDetails,
        },
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    console.error('Verify OTP error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to verify OTP',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
