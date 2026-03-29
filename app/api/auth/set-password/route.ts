import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken } from '@/lib/middleware/auth';
import { ApiResponse } from '@/lib/types';
import User from '@/lib/models/User';

const setPasswordSchema = z.object({
  password: z.string().min(6).max(64),
});

export async function POST(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { password } = setPasswordSchema.parse(body);

    await connectToDatabase();

    const user = await User.findById(auth.payload.userId);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const saltRounds = 10;
    const passwordHash = await hash(password, saltRounds);

    user.passwordHash = passwordHash;
    user.passwordUpdatedAt = new Date();
    await user.save();

    const response: ApiResponse = {
      success: true,
      message: 'Password set successfully',
      data: {
        userId: user._id.toString(),
        hasPassword: true,
        passwordUpdatedAt: user.passwordUpdatedAt,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: 'Password must be between 6 and 64 characters',
      };
      return NextResponse.json(response, { status: 400 });
    }

    console.error('Set password error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to set password',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
