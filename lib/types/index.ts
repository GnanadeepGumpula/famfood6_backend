export interface UserProfile {
  name?: string;
  email?: string;
  address?: string;
}

export interface LoyaltyCounter {
  [itemName: string]: number;
}

export interface IUser {
  _id?: string;
  mobileNumber: string;
  profileDetails?: UserProfile;
  loyaltyCounter: LoyaltyCounter;
  otpCode?: string;
  otpExpiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMenu {
  _id?: string;
  name: string;
  description?: string;
  price: number;
  category: 'Veg' | 'Non-Veg';
  section?: string;
  sectionIcon?: string;
  imageURL?: string;
  inStock: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderItem {
  menuId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface WhatsAppNotificationLog {
  eventType: 'order_placed' | 'order_accepted' | 'order_rejected' | 'order_ready';
  success: boolean;
  messageId?: string;
  error?: string;
  payload?: Record<string, string>;
  sentAt?: Date;
}

export interface IOrder {
  _id?: string;
  userId: string;
  items: OrderItem[];
  paymentMethod: 'Cash' | 'Online';
  paymentStatus: 'Pending' | 'Completed' | 'Refunded';
  orderStatus:
    | 'Pending'
    | 'Accepted'
    | 'Cooking'
    | 'Packing'
    | 'Ready'
    | 'Delivered'
    | 'Rejected';
  tokenNumber: string;
  deliveryPIN: string;
  estimatedPrepTime?: number;
  totalAmount: number;
  whatsappNotifications?: WhatsAppNotificationLog[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OTPSession {
  mobileNumber: string;
  otp: string;
  expiresAt: Date;
}

export interface JWTPayload {
  userId: string;
  mobileNumber: string;
  role: 'user' | 'admin';
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
