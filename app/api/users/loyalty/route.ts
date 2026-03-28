import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken } from '@/lib/middleware/auth';
import { ApiResponse } from '@/lib/types';
import User from '@/lib/models/User';

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

    const loyaltyData = Object.fromEntries(user.loyaltyCounter || new Map());

    const response: ApiResponse = {
      success: true,
      data: {
        userId: user._id.toString(),
        loyaltyCounter: loyaltyData,
        totalItems: Object.values(loyaltyData).reduce((a: number, b: any) => a + b, 0),
        itemsNeedingForFree: Object.entries(loyaltyData)
          .filter(([_, count]: [string, any]) => count < 5)
          .map(([name, count]: [string, any]) => ({
            itemName: name,
            currentCount: count,
            remainingNeeded: 5 - count,
          })),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Get loyalty error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to get loyalty information',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
