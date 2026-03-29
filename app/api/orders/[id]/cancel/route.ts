import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken } from '@/lib/middleware/auth';
import { sendOrderCancelledMessage } from '@/lib/utils/whatsapp';
import { ApiResponse } from '@/lib/types';
import Order from '@/lib/models/Order';

const USER_CANCELLABLE_STATUSES = new Set(['Pending', 'Accepted']);

export async function PATCH(
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

    const orderUserId = typeof order.userId === 'object' ? (order.userId as any)?._id?.toString() : String(order.userId);
    const isOwner = orderUserId === auth.payload.userId;
    const isAdmin = auth.payload.role === 'admin';

    if (!isOwner && !isAdmin) {
      const response: ApiResponse = {
        success: false,
        error: 'Unauthorized to cancel this order',
      };
      return NextResponse.json(response, { status: 403 });
    }

    if (order.orderStatus === 'Cancelled') {
      const response: ApiResponse = {
        success: false,
        error: 'Order is already cancelled',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!USER_CANCELLABLE_STATUSES.has(order.orderStatus)) {
      const response: ApiResponse = {
        success: false,
        error: `Order cannot be cancelled once it reaches ${order.orderStatus.toLowerCase()} stage`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    order.orderStatus = 'Cancelled';
    await order.save();

    const customerMobile = (order.userId as any)?.mobileNumber as string | undefined;
    let cancelWhatsAppResult:
      | { success: boolean; messageId?: string; error?: string }
      | undefined;

    if (customerMobile) {
      cancelWhatsAppResult = await sendOrderCancelledMessage(
        customerMobile,
        order.tokenNumber
      );

      await Order.findByIdAndUpdate(order._id, {
        $push: {
          whatsappNotifications: {
            eventType: 'order_cancelled',
            success: cancelWhatsAppResult.success,
            messageId: cancelWhatsAppResult.messageId,
            error: cancelWhatsAppResult.error,
            payload: {
              orderId: order._id.toString(),
              tokenNumber: order.tokenNumber,
            },
            sentAt: new Date(),
          },
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Order cancelled successfully',
      data: {
        _id: order._id.toString(),
        orderStatus: order.orderStatus,
        whatsappNotification: cancelWhatsAppResult
          ? {
              eventType: 'order_cancelled',
              success: cancelWhatsAppResult.success,
              messageId: cancelWhatsAppResult.messageId,
              error: cancelWhatsAppResult.error,
            }
          : undefined,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Cancel order error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to cancel order',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
