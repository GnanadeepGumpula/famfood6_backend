import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '@/lib/utils/jwt';

let io: SocketIOServer | null = null;

export interface AdminNotificationPayload {
  orderId: string;
  tokenNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  estimatedPrepTime: number;
  timestamp: Date;
}

export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication failed'));
    }

    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid token'));
    }

    // Store user info in socket
    (socket as any).userId = payload.userId;
    (socket as any).userRole = payload.role;

    next();
  });

  // Connection handlers
  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;

    console.log(`User connected: ${userId} (${userRole})`);

    // Admin namespace join
    if (userRole === 'admin') {
      socket.join('admin_notifications');
      socket.emit('admin_connected', { message: 'Connected to admin channel' });
    }

    // User namespace join
    socket.join(`user_${userId}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
    });

    // Handle heartbeat
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  return io;
}

export function getSocket(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

export function broadcastNewOrder(
  payload: AdminNotificationPayload
): void {
  if (!io) return;

  io.to('admin_notifications').emit('new_order', {
    ...payload,
    message: `New order received! Token: ${payload.tokenNumber}`,
  });
}

export function notifyOrderStatusUpdate(
  userId: string,
  orderId: string,
  status: string,
  estimatedTime?: number
): void {
  if (!io) return;

  io.to(`user_${userId}`).emit('order_status_update', {
    orderId,
    status,
    estimatedTime,
    timestamp: new Date(),
    message: `Your order status: ${status}`,
  });
}

export function notifyOrderReady(
  userId: string,
  orderId: string,
  deliveryPIN: string
): void {
  if (!io) return;

  io.to(`user_${userId}`).emit('order_ready', {
    orderId,
    deliveryPIN,
    timestamp: new Date(),
    message: 'Your order is ready for pickup!',
  });
}

export function broadcastAdminNotification(message: string, data?: any): void {
  if (!io) return;

  io.to('admin_notifications').emit('admin_notification', {
    message,
    data,
    timestamp: new Date(),
  });
}
