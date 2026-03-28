import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken, requireAdmin } from '@/lib/middleware/auth';
import { ApiResponse } from '@/lib/types';
import Order from '@/lib/models/Order';

export async function GET(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  const adminCheck = requireAdmin(auth.payload);
  if (!adminCheck.isAdmin) {
    return adminCheck.response!;
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    await connectToDatabase();

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const dailyStats = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          completedOrders: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0],
            },
          },
          rejectedOrders: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', 'Rejected'] }, 1, 0],
            },
          },
          averageOrderValue: {
            $avg: '$totalAmount',
          },
        },
      },
    ]);

    const stats = dailyStats[0] || {
      totalRevenue: 0,
      orderCount: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      averageOrderValue: 0,
    };

    const response: ApiResponse = {
      success: true,
      data: {
        date,
        ...stats,
        conversionRate:
          stats.orderCount > 0
            ? ((stats.completedOrders / stats.orderCount) * 100).toFixed(2)
            : '0',
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Daily analytics error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch daily analytics',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
