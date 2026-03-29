import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken } from '@/lib/middleware/auth';
import { verifyOTP } from '@/lib/utils/otp';
import { signToken } from '@/lib/utils/jwt';
import { normalizeMobileNumber, validateMobileNumber } from '@/lib/utils/order';
import { checkRateLimit, clearRateLimit } from '@/lib/utils/rateLimit';
import { ApiResponse } from '@/lib/types';
import OtpSession from '@/lib/models/OtpSession';
import User from '@/lib/models/User';

const verifyPhoneChangeSchema = z.object({
  newMobileNumber: z.string(),
  otp: z.string().regex(/^[0-9]{6}$/),
});

export async function POST(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { newMobileNumber: inputMobileNumber, otp } = verifyPhoneChangeSchema.parse(body);
    const newMobileNumber = normalizeMobileNumber(inputMobileNumber);

    if (!validateMobileNumber(newMobileNumber)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid mobile number format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const rateLimitCheck = checkRateLimit(`verify-change-mobile-${newMobileNumber}`, {
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

    const ownerOfNewPhone = await User.findOne({ mobileNumber: newMobileNumber });
    if (ownerOfNewPhone && ownerOfNewPhone._id.toString() !== auth.payload.userId) {
      const response: ApiResponse = {
        success: false,
        error: 'This mobile number is already in use',
      };
      return NextResponse.json(response, { status: 409 });
    }

    let isValid = false;
    const otpSession = await OtpSession.findOne({ mobileNumber: newMobileNumber });
    if (otpSession) {
      const isExpired = new Date() > new Date(otpSession.expiresAt);
      if (!isExpired && otpSession.otp === otp) {
        isValid = true;
      }
      if (isValid || isExpired) {
        await OtpSession.deleteOne({ mobileNumber: newMobileNumber });
      }
    }

    if (!isValid) {
      isValid = verifyOTP(newMobileNumber, otp);
    }

    if (!isValid) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid or expired OTP',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const user = await User.findById(auth.payload.userId);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    user.mobileNumber = newMobileNumber;
    await user.save();

    const adminPhones = (process.env.ADMIN_PHONES || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const role: 'admin' | 'user' = adminPhones.includes(newMobileNumber) ? 'admin' : 'user';

    const token = signToken({
      userId: user._id.toString(),
      mobileNumber: newMobileNumber,
      role,
    });

    clearRateLimit(`verify-change-mobile-${newMobileNumber}`);

    const response: ApiResponse = {
      success: true,
      message: 'Mobile number updated successfully',
      data: {
        token,
        user: {
          userId: user._id.toString(),
          mobileNumber: user.mobileNumber,
          profileDetails: user.profileDetails,
          hasPassword: Boolean(user.passwordHash),
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

    console.error('Verify phone change OTP error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to verify phone change OTP',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
