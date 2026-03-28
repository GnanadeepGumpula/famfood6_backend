import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken, requireAdmin } from '@/lib/middleware/auth';
import {
  sendOrderAcceptedMessage,
  sendOrderReadyMessage,
  sendOrderRejectedMessage,
} from '@/lib/utils/whatsapp';
import { ApiResponse } from '@/lib/types';
import Order from '@/lib/models/Order';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  try {
    const { id } = await params;
    await connectToDatabase();

    const order = await Order.findById(id).populate('userId', 'mobileNumber');

    if (!order) {
      const response: ApiResponse = {
        success: false,
        error: 'Order not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check authorization: user can only see their own orders, admin can see all
    if (
      auth.payload.role !== 'admin' &&
      order.userId._id.toString() !== auth.payload.userId
    ) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized to view this order',
      };
      return NextResponse.json(response, { status: 403 });
    }

    const response: ApiResponse = {
      success: true,
      data: {
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
        whatsappNotifications: order.whatsappNotifications || [],
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Get order error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to get order',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

const updateStatusSchema = z.object({
  orderStatus: z.enum(['Pending', 'Accepted', 'Cooking', 'Packing', 'Ready', 'Delivered', 'Rejected']),
  estimatedPrepTime: z.number().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  const adminCheck = requireAdmin(auth.payload);
  if (!adminCheck.isAdmin) {
    return adminCheck.response!;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { orderStatus, estimatedPrepTime } = updateStatusSchema.parse(body);

    await connectToDatabase();

    const order = await Order.findById(id).populate('userId', 'mobileNumber');

    if (!order) {
      const response: ApiResponse = {
        success: false,
        error: 'Order not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    order.orderStatus = orderStatus;
    if (estimatedPrepTime !== undefined) {
      order.estimatedPrepTime = estimatedPrepTime;
    }
    await order.save();

    const customerMobile = (order.userId as any)?.mobileNumber as
      | string
      | undefined;

    let statusEventType:
      | 'order_accepted'
      | 'order_rejected'
      | 'order_ready'
      | undefined;
    let statusWhatsAppResult:
      | { success: boolean; messageId?: string; error?: string }
      | undefined;

    if (customerMobile) {
      if (orderStatus === 'Accepted') {
        statusEventType = 'order_accepted';
        statusWhatsAppResult = await sendOrderAcceptedMessage(
          customerMobile,
          `${order.estimatedPrepTime || 30} mins`,
          process.env.RESTAURANT_LOCATION_LINK || process.env.GOOGLE_MAPS_LINK || '',
          order.tokenNumber
        );
      } else if (orderStatus === 'Rejected') {
        statusEventType = 'order_rejected';
        statusWhatsAppResult = await sendOrderRejectedMessage(customerMobile);
      } else if (orderStatus === 'Ready') {
        statusEventType = 'order_ready';
        statusWhatsAppResult = await sendOrderReadyMessage(
          customerMobile,
          order.deliveryPIN,
          order.tokenNumber
        );
      }
    }

    if (statusEventType) {
      if (!statusWhatsAppResult?.success) {
        console.warn('Order status WhatsApp send failed', {
          orderId: order._id.toString(),
          eventType: statusEventType,
          mobileNumber: customerMobile,
          error: statusWhatsAppResult?.error,
        });
      }

      await Order.findByIdAndUpdate(order._id, {
        $push: {
          whatsappNotifications: {
            eventType: statusEventType,
            success: statusWhatsAppResult?.success || false,
            messageId: statusWhatsAppResult?.messageId,
            error:
              statusWhatsAppResult?.error ||
              (customerMobile
                ? undefined
                : 'Customer mobile number missing for WhatsApp delivery'),
            payload: {
              orderId: order._id.toString(),
              tokenNumber: order.tokenNumber,
              orderStatus,
              estimatedPrepTime: String(order.estimatedPrepTime || 30),
              deliveryPIN: order.deliveryPIN,
            },
            sentAt: new Date(),
          },
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Order status updated',
      data: {
        _id: order._id.toString(),
        orderStatus: order.orderStatus,
        estimatedPrepTime: order.estimatedPrepTime,
        whatsappNotification: statusEventType
          ? {
              eventType: statusEventType,
              success: statusWhatsAppResult?.success || false,
              messageId: statusWhatsAppResult?.messageId,
              error: statusWhatsAppResult?.error,
            }
          : undefined,
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

    console.error('Update order status error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update order status',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
