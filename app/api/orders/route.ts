import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken, requireAdmin } from '@/lib/middleware/auth';
import { applyLoyaltyToItems } from '@/lib/middleware/loyalty';
import { generateTokenNumber, generateDeliveryPIN } from '@/lib/utils/order';
import { sendOrderPlacedMessage } from '@/lib/utils/whatsapp';
import { ApiResponse } from '@/lib/types';
import Order from '@/lib/models/Order';
import User from '@/lib/models/User';

const createOrderSchema = z.object({
  items: z.array(
    z.object({
      menuId: z.string(),
      name: z.string(),
      quantity: z.number().min(1),
      price: z.number().min(0),
    })
  ),
  paymentMethod: z.enum(['Cash', 'Online']),
  estimatedPrepTime: z.number().optional(),
});

export async function POST(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { items, paymentMethod, estimatedPrepTime } =
      createOrderSchema.parse(body);

    await connectToDatabase();

    // Get user and apply loyalty
    const user = await User.findById(auth.payload.userId);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Calculate loyalty discount
    const loyaltyResult = applyLoyaltyToItems(
      items,
      Object.fromEntries(user.loyaltyCounter || new Map())
    );

    // Create order with processed items and amounts
    const tokenNumber = generateTokenNumber();
    const deliveryPIN = generateDeliveryPIN();

    const newOrder = new Order({
      userId: auth.payload.userId,
      items: loyaltyResult.items,
      paymentMethod,
      paymentStatus: paymentMethod === 'Cash' ? 'Pending' : 'Completed',
      orderStatus: 'Pending',
      tokenNumber,
      deliveryPIN,
      estimatedPrepTime: estimatedPrepTime || 30,
      totalAmount: loyaltyResult.finalAmount,
    });

    await newOrder.save();

    // Update user loyalty counter
    await User.findByIdAndUpdate(auth.payload.userId, {
      $set: { loyaltyCounter: loyaltyResult.loyaltyUpdates },
    });

    // Send WhatsApp notification
    const orderPlacedWhatsAppResult = await sendOrderPlacedMessage(
      user.mobileNumber,
      tokenNumber,
      newOrder._id.toString(),
      {
        orderId: newOrder._id.toString(),
        tokenNumber,
        items: loyaltyResult.items,
        totalAmount: loyaltyResult.finalAmount,
        paymentMethod,
        estimatedPrepTime: estimatedPrepTime || 30,
        deliveryPIN: deliveryPIN,
      }
    );

    if (!orderPlacedWhatsAppResult.success) {
      console.warn('Order WhatsApp send failed', {
        orderId: newOrder._id.toString(),
        mobileNumber: user.mobileNumber,
        error: orderPlacedWhatsAppResult.error,
      });
    }

    await Order.findByIdAndUpdate(newOrder._id, {
      $push: {
        whatsappNotifications: {
          eventType: 'order_placed',
          success: orderPlacedWhatsAppResult.success,
          messageId: orderPlacedWhatsAppResult.messageId,
          error: orderPlacedWhatsAppResult.error,
          payload: {
            orderId: newOrder._id.toString(),
            tokenNumber,
            totalAmount: loyaltyResult.finalAmount.toFixed(2),
            paymentMethod,
            estimatedPrepTime: String(estimatedPrepTime || 30),
            deliveryPIN,
          },
          sentAt: new Date(),
        },
      },
    });

    // Socket.io notification will be handled by frontend polling or WebSocket connection
    // TODO: Implement Socket.io server initialization in getServerSideProps or API middleware

    const response: ApiResponse = {
      success: true,
      message: 'Order placed successfully',
      data: {
        orderId: newOrder._id.toString(),
        tokenNumber: newOrder.tokenNumber,
        deliveryPIN: newOrder.deliveryPIN,
        totalAmount: newOrder.totalAmount,
        estimatedPrepTime: newOrder.estimatedPrepTime,
        items: loyaltyResult.items,
        freeItemApplied: loyaltyResult.freeItemApplied,
        whatsappNotification: {
          success: orderPlacedWhatsAppResult.success,
          messageId: orderPlacedWhatsAppResult.messageId,
          error: orderPlacedWhatsAppResult.error,
        },
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    console.error('Create order error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create order',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

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

    let query: any = {};

    // If not admin, only return user's own orders
    if (auth.payload.role !== 'admin') {
      query.userId = auth.payload.userId;
    }

    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .populate('userId', 'mobileNumber')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    const response: ApiResponse = {
      success: true,
      data: {
        orders: orders.map((order) => ({
          _id: order._id.toString(),
          userId: order.userId,
          items: order.items,
          totalAmount: order.totalAmount,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          tokenNumber: order.tokenNumber,
          deliveryPIN: order.deliveryPIN,
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
    console.error('Get orders error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to get orders',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
