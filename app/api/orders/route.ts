import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken, requireAdmin } from '@/lib/middleware/auth';
import { applyLoyaltyToItems } from '@/lib/middleware/loyalty';
import { generateTokenNumber, generateDeliveryPIN } from '@/lib/utils/order';
import { sendFreeOrderCongratsMessage, sendOrderPlacedMessage } from '@/lib/utils/whatsapp';
import { ApiResponse } from '@/lib/types';
import Order from '@/lib/models/Order';
import User from '@/lib/models/User';
import Menu from '@/lib/models/Menu';

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

    // Build order lines from trusted menu data so client cannot force free pricing.
    const uniqueMenuIds = Array.from(new Set(items.map((item) => item.menuId)));
    const menuDocuments = await Menu.find({ _id: { $in: uniqueMenuIds } }).lean();
    const menuById = new Map(
      menuDocuments.map((menuItem: any) => [menuItem._id.toString(), menuItem])
    );

    const normalizedItems = items.map((item) => {
      const menuDoc = menuById.get(item.menuId);
      if (!menuDoc) {
        throw new Error(`Menu item not found for id ${item.menuId}`);
      }

      return {
        menuId: menuDoc._id.toString(),
        name: menuDoc.name,
        quantity: item.quantity,
        price: Number(menuDoc.price),
      };
    });

    // Calculate loyalty discount on trusted server-side values only.
    const loyaltyResult = applyLoyaltyToItems(
      normalizedItems,
      Object.fromEntries(user.loyaltyCounter || new Map())
    );

    const freeItems = loyaltyResult.items
      .filter((item) => item.price === 0)
      .map((item) => ({
        name: item.name,
        quantity: item.quantity,
      }));

    const itemNamesInOrder = Array.from(new Set(normalizedItems.map((item) => item.name)));
    const loyaltyProgress = itemNamesInOrder.map((itemName) => {
      const current = Number(loyaltyResult.loyaltyUpdates[itemName] || 0);
      return {
        itemName,
        currentCount: current,
        ordersRemainingForFree: Math.max(5 - current, 0),
      };
    });

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

    let freeRewardWhatsAppResult:
      | { success: boolean; messageId?: string; error?: string }
      | undefined;

    if (loyaltyResult.freeItemApplied && freeItems.length > 0) {
      const nextRemainingForPrimaryItem = loyaltyProgress.length
        ? loyaltyProgress[0].ordersRemainingForFree
        : 5;

      freeRewardWhatsAppResult = await sendFreeOrderCongratsMessage(
        user.mobileNumber,
        tokenNumber,
        freeItems,
        nextRemainingForPrimaryItem
      );
    }

    if (!orderPlacedWhatsAppResult.success) {
      console.warn('Order WhatsApp send failed', {
        orderId: newOrder._id.toString(),
        mobileNumber: user.mobileNumber,
        error: orderPlacedWhatsAppResult.error,
      });
    }

    await Order.findByIdAndUpdate(newOrder._id, {
      $push: {
        whatsappNotifications: [
          {
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
          ...(freeRewardWhatsAppResult
            ? [
                {
                  eventType: 'order_free_reward',
                  success: freeRewardWhatsAppResult.success,
                  messageId: freeRewardWhatsAppResult.messageId,
                  error: freeRewardWhatsAppResult.error,
                  payload: {
                    orderId: newOrder._id.toString(),
                    tokenNumber,
                    freeItems: freeItems
                      .map((item) => `${item.name} x${item.quantity}`)
                      .join(', '),
                  },
                  sentAt: new Date(),
                },
              ]
            : []),
        ],
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
        freeItems,
        loyaltyProgress,
        whatsappNotification: {
          success: orderPlacedWhatsAppResult.success,
          messageId: orderPlacedWhatsAppResult.messageId,
          error: orderPlacedWhatsAppResult.error,
        },
        freeRewardWhatsAppNotification: freeRewardWhatsAppResult
          ? {
              success: freeRewardWhatsAppResult.success,
              messageId: freeRewardWhatsAppResult.messageId,
              error: freeRewardWhatsAppResult.error,
            }
          : undefined,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Menu item not found')) {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      };
      return NextResponse.json(response, { status: 400 });
    }

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
      .populate('userId', 'mobileNumber profileDetails')
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
          customerName:
            typeof order.userId === 'object'
              ? (order.userId as any)?.profileDetails?.name || ''
              : '',
          customerPhone:
            typeof order.userId === 'object'
              ? (order.userId as any)?.mobileNumber || ''
              : '',
          customerCallNumber:
            typeof order.userId === 'object'
              ? (order.userId as any)?.profileDetails?.callNumber ||
                (order.userId as any)?.mobileNumber ||
                ''
              : '',
          items: order.items,
          totalAmount: order.totalAmount,
          isFreeOrder: order.items.some((item: any) => item.price === 0),
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
