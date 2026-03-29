import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken } from '@/lib/middleware/auth';
import { generateOTP, storeOTP } from '@/lib/utils/otp';
import { sendLoginOtpMessage } from '@/lib/utils/whatsapp';
import { normalizeMobileNumber, validateMobileNumber } from '@/lib/utils/order';
import { checkRateLimit } from '@/lib/utils/rateLimit';
import { ApiResponse } from '@/lib/types';
import OtpSession from '@/lib/models/OtpSession';
import User from '@/lib/models/User';

const requestPhoneChangeSchema = z.object({
  newMobileNumber: z.string(),
});

export async function POST(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { newMobileNumber: inputMobileNumber } = requestPhoneChangeSchema.parse(body);
    const newMobileNumber = normalizeMobileNumber(inputMobileNumber);

    if (!validateMobileNumber(newMobileNumber)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid mobile number format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const rateLimitCheck = checkRateLimit(`change-mobile-${newMobileNumber}`, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
    });

    if (!rateLimitCheck.allowed) {
      const response: ApiResponse = {
        success: false,
        error: `Too many OTP requests. Please try again in ${rateLimitCheck.retryAfter} seconds.`,
      };
      return NextResponse.json(response, { status: 429 });
    }

    await connectToDatabase();

    const existingOwner = await User.findOne({ mobileNumber: newMobileNumber });
    if (existingOwner && existingOwner._id.toString() !== auth.payload.userId) {
      const response: ApiResponse = {
        success: false,
        error: 'This mobile number is already in use',
      };
      return NextResponse.json(response, { status: 409 });
    }

    const otp = generateOTP();
    storeOTP(newMobileNumber, otp);

    const otpExpirySeconds = parseInt(process.env.OTP_EXPIRY || '600');
    const otpExpiresAt = new Date(Date.now() + otpExpirySeconds * 1000);
    await OtpSession.findOneAndUpdate(
      { mobileNumber: newMobileNumber },
      { otp, expiresAt: otpExpiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const expiresInMinutes = Math.max(1, Math.ceil(otpExpirySeconds / 60));
    const isHostedRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
    const isLocalDevelopment = process.env.NODE_ENV === 'development' && !isHostedRuntime;
    const exposeDevOtp = isLocalDevelopment && process.env.EXPOSE_DEV_OTP === 'true';

    const whatsappResult = await sendLoginOtpMessage(newMobileNumber, otp, expiresInMinutes);
    if (!whatsappResult.success) {
      await OtpSession.deleteOne({ mobileNumber: newMobileNumber });
      const response: ApiResponse = {
        success: false,
        error: whatsappResult.error || 'Failed to send OTP',
      };
      return NextResponse.json(response, { status: 502 });
    }

    const response: ApiResponse = {
      success: true,
      message: 'OTP sent to new mobile number',
      data: {
        delivery: 'whatsapp',
        messageId: whatsappResult.messageId,
        otp: exposeDevOtp ? otp : undefined,
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

    console.error('Request phone change OTP error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to send phone change OTP',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
