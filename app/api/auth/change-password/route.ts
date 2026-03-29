import { NextRequest, NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken } from '@/lib/middleware/auth';
import { ApiResponse } from '@/lib/types';
import User from '@/lib/models/User';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(64),
  newPassword: z.string().min(6).max(64),
});

export async function POST(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    await connectToDatabase();

    const user = await User.findById(auth.payload.userId);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    if (!user.passwordHash) {
      const response: ApiResponse = {
        success: false,
        error: 'Password not set yet. Use set-password first.',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const currentMatches = await compare(currentPassword, user.passwordHash);
    if (!currentMatches) {
      const response: ApiResponse = {
        success: false,
        error: 'Current password is incorrect',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const passwordHash = await hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.passwordUpdatedAt = new Date();
    await user.save();

    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully',
      data: {
        userId: user._id.toString(),
        passwordUpdatedAt: user.passwordUpdatedAt,
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

    console.error('Change password error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to change password',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
