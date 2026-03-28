import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken } from '@/lib/middleware/auth';
import { ApiResponse } from '@/lib/types';
import Order from '@/lib/models/Order';

export async function GET(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    await connectToDatabase();

    let query: any = { userId: auth.payload.userId };
    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    const response: ApiResponse = {
      success: true,
      data: {
        orders: orders.map((order) => ({
          _id: order._id.toString(),
          items: order.items,
          totalAmount: order.totalAmount,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          tokenNumber: order.tokenNumber,
          estimatedPrepTime: order.estimatedPrepTime,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        })),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Get user orders error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to get orders',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
