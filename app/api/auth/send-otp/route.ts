import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { generateOTP, storeOTP } from '@/lib/utils/otp';
import { sendLoginOtpMessage } from '@/lib/utils/whatsapp';
import { validateMobileNumber } from '@/lib/utils/order';
import { checkRateLimit } from '@/lib/utils/rateLimit';
import { ApiResponse } from '@/lib/types';
import OtpSession from '@/lib/models/OtpSession';

const sendOtpSchema = z.object({
  mobileNumber: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobileNumber } = sendOtpSchema.parse(body);

    if (!validateMobileNumber(mobileNumber)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid mobile number format. Must be 10 digits.',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Rate limiting: 5 OTP requests per 15 minutes per phone number
    const rateLimitCheck = checkRateLimit(mobileNumber, {
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

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(mobileNumber, otp);

    // Persist OTP in DB so verification works reliably across route instances
    const otpExpirySeconds = parseInt(process.env.OTP_EXPIRY || '600');
    const otpExpiresAt = new Date(Date.now() + otpExpirySeconds * 1000);
    await OtpSession.findOneAndUpdate(
      { mobileNumber },
      { otp, expiresAt: otpExpiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const expiresInMinutes = Math.max(1, Math.ceil(otpExpirySeconds / 60));
    const isDevelopment = process.env.NODE_ENV === 'development';
    const exposeDevOtp =
      isDevelopment && process.env.EXPOSE_DEV_OTP !== 'false';
    const allowDevFallback =
      isDevelopment && process.env.ALLOW_WHATSAPP_OTP_FALLBACK !== 'false';

    const whatsappResult = await sendLoginOtpMessage(
      mobileNumber,
      otp,
      expiresInMinutes
    );

    let delivery: 'whatsapp' | 'development-fallback' = 'whatsapp';
    let responseMessage = `OTP sent to ${mobileNumber} via WhatsApp`;
    let whatsappError: string | undefined;

    if (!whatsappResult.success) {
      if (!allowDevFallback) {
        // Clear undelivered OTP to avoid confusing users with a code they never received.
        await OtpSession.deleteOne({ mobileNumber });

        const response: ApiResponse = {
          success: false,
          error:
            whatsappResult.error ||
            'Failed to send OTP via WhatsApp. Please try again.',
        };
        return NextResponse.json(response, { status: 502 });
      }

      delivery = 'development-fallback';
      responseMessage =
        'WhatsApp delivery failed in test mode. Use the development OTP below.';
      whatsappError = whatsappResult.error;
    }

    const response: ApiResponse = {
      success: true,
      message: responseMessage,
      data: {
        otp:
          exposeDevOtp || delivery === 'development-fallback'
            ? otp
            : undefined,
        delivery,
        messageId: whatsappResult.messageId,
        whatsappError,
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

    console.error('Send OTP error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to send OTP',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
