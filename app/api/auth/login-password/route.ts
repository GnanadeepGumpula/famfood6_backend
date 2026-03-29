import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { signToken } from '@/lib/utils/jwt';
import { normalizeMobileNumber, validateMobileNumber } from '@/lib/utils/order';
import { checkRateLimit } from '@/lib/utils/rateLimit';
import { ApiResponse } from '@/lib/types';
import User from '@/lib/models/User';

const loginPasswordSchema = z.object({
  mobileNumber: z.string(),
  password: z.string().min(6).max(64),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobileNumber: inputMobileNumber, password } = loginPasswordSchema.parse(body);
    const mobileNumber = normalizeMobileNumber(inputMobileNumber);

    if (!validateMobileNumber(mobileNumber)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid mobile number format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const rateLimitCheck = checkRateLimit(`pwd-login-${mobileNumber}`, {
      windowMs: 10 * 60 * 1000,
      maxRequests: 8,
    });

    if (!rateLimitCheck.allowed) {
      const response: ApiResponse = {
        success: false,
        error: `Too many login attempts. Please try again in ${rateLimitCheck.retryAfter} seconds.`,
      };
      return NextResponse.json(response, { status: 429 });
    }

    await connectToDatabase();

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found. Please verify with OTP first.',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (!user.passwordHash) {
      const response: ApiResponse = {
        success: false,
        error: 'Password not set. Please login with OTP once and set a password.',
      };
      return NextResponse.json(response, { status: 400 });
    }

    let passwordMatches = false;
    try {
      passwordMatches = await compare(password, String(user.passwordHash));
    } catch {
      const response: ApiResponse = {
        success: false,
        error: 'Password verification is not available for this account. Please login with OTP and reset password once.',
      };
      return NextResponse.json(response, { status: 400 });
    }
    if (!passwordMatches) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid mobile number or password',
      };
      return NextResponse.json(response, { status: 401 });
    }

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

    await User.findByIdAndUpdate(user._id, {
      $set: {
        lastPasswordLoginAt: new Date(),
      },
    });

    const response: ApiResponse = {
      success: true,
      message: 'Logged in successfully',
      data: {
        token,
        user: {
          userId: user._id.toString(),
          mobileNumber: user.mobileNumber,
          profileDetails: user.profileDetails,
          hasPassword: true,
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

    console.error('Password login error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to login with password',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
