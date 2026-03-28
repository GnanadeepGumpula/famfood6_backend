import mongoose, { Schema, Document } from 'mongoose';
import { IOrder } from '@/lib/types';

interface IOrderDocument extends IOrder, Document {}

const orderSchema = new Schema<IOrderDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        menuId: {
          type: Schema.Types.ObjectId,
          ref: 'Menu',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Online'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Refunded'],
      default: 'Pending',
    },
    orderStatus: {
      type: String,
      enum: [
        'Pending',
        'Accepted',
        'Cooking',
        'Packing',
        'Ready',
        'Delivered',
        'Rejected',
      ],
      default: 'Pending',
    },
    tokenNumber: {
      type: String,
      required: true,
      unique: true,
    },
    deliveryPIN: {
      type: String,
      required: true,
    },
    estimatedPrepTime: {
      type: Number,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    whatsappNotifications: [
      {
        eventType: {
          type: String,
          enum: [
            'order_placed',
            'order_accepted',
            'order_rejected',
            'order_ready',
          ],
          required: true,
        },
        success: {
          type: Boolean,
          required: true,
        },
        messageId: {
          type: String,
        },
        error: {
          type: String,
        },
        payload: {
          type: Map,
          of: String,
          default: {},
        },
        sentAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Order =
  mongoose.models.Order || mongoose.model<IOrderDocument>('Order', orderSchema);

export default Order;
