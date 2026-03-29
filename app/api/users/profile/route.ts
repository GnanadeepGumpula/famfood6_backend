import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken } from '@/lib/middleware/auth';
import { ApiResponse } from '@/lib/types';
import User from '@/lib/models/User';

const updateProfileSchema = z.object({
  profileDetails: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    callNumber: z
      .string()
      .regex(/^[0-9]{10}$/)
      .optional(),
  }),
});

export async function GET(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    await connectToDatabase();

    const user = await User.findById(auth.payload.userId);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        userId: user._id.toString(),
        mobileNumber: user.mobileNumber,
        profileDetails: user.profileDetails || {},
        hasPassword: Boolean(user.passwordHash),
        loyaltyCounter: Object.fromEntries(user.loyaltyCounter || new Map()),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Get profile error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to get profile',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { profileDetails } = updateProfileSchema.parse(body);

    await connectToDatabase();

    const user = await User.findByIdAndUpdate(
      auth.payload.userId,
      {
        $set: {
          profileDetails: {
            ...profileDetails,
          },
        },
      },
      { new: true }
    );

    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Profile updated successfully',
      data: {
        userId: user._id.toString(),
        mobileNumber: user.mobileNumber,
        profileDetails: user.profileDetails || {},
        hasPassword: Boolean(user.passwordHash),
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

    console.error('Update profile error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update profile',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
