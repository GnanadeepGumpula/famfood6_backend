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
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const days = parseInt(searchParams.get('days') || '30', 10);

    await connectToDatabase();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const topItems = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
          },
          orderStatus: 'Delivered',
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: '$items.name',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: {
            $sum: {
              $multiply: ['$items.quantity', '$items.price'],
            },
          },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalQuantity: -1 },
      },
      {
        $limit: limit,
      },
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        period: {
          days,
          from: startDate.toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0],
        },
        topItems: topItems.map((item, index) => ({
          rank: index + 1,
          itemName: item._id,
          totalQuantity: item.totalQuantity,
          totalRevenue: item.totalRevenue.toFixed(2),
          averagePrice: (item.totalRevenue / item.totalQuantity).toFixed(2),
          ordersIncluded: item.orderCount,
        })),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Top items analytics error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch top items analytics',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
