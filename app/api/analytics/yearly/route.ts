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
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);

    await connectToDatabase();

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const yearlyStats = await Order.aggregate([
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
          totalUsers: {
            $addToSet: '$userId',
          },
        },
      },
    ]);

    // Get monthly breakdown
    const monthlyBreakdown = await Order.aggregate([
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
          _id: {
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.month': 1 },
      },
    ]);

    const stats = yearlyStats[0] || {
      totalRevenue: 0,
      orderCount: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      averageOrderValue: 0,
      totalUsers: [],
    };

    const response: ApiResponse = {
      success: true,
      data: {
        year,
        totalRevenue: stats.totalRevenue,
        orderCount: stats.orderCount,
        completedOrders: stats.completedOrders,
        rejectedOrders: stats.rejectedOrders,
        averageOrderValue: stats.averageOrderValue.toFixed(2),
        uniqueUsers: stats.totalUsers.length,
        conversionRate:
          stats.orderCount > 0
            ? ((stats.completedOrders / stats.orderCount) * 100).toFixed(2)
            : '0',
        monthlyBreakdown: monthlyBreakdown.map((month) => ({
          month: month._id.month,
          revenue: month.revenue,
          orderCount: month.orderCount,
        })),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Yearly analytics error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch yearly analytics',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
