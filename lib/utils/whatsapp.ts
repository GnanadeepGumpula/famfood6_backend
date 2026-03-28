import axios from 'axios';

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v18.0';
const WHATSAPP_API_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_ORDER_PLACED_TEMPLATE =
  process.env.WHATSAPP_ORDER_PLACED_TEMPLATE || 'order_placed_notification';
const WHATSAPP_ORDER_ACCEPTED_TEMPLATE =
  process.env.WHATSAPP_ORDER_ACCEPTED_TEMPLATE || 'order_accepted_notification';
const WHATSAPP_ORDER_REJECTED_TEMPLATE =
  process.env.WHATSAPP_ORDER_REJECTED_TEMPLATE || 'order_rejected_notification';
const WHATSAPP_ORDER_READY_TEMPLATE =
  process.env.WHATSAPP_ORDER_READY_TEMPLATE || 'order_ready_notification';

function isPlaceholderEnvValue(value?: string): boolean {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;

  return (
    normalized.includes('your_') ||
    normalized.includes('_here') ||
    normalized.includes('change-in-production')
  );
}

export interface WhatsAppTemplateVariable {
  [key: string]: string;
}

export interface OrderDetailsMessageInput {
  orderId: string;
  tokenNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  paymentMethod: 'Cash' | 'Online';
  estimatedPrepTime: number;
  deliveryPIN: string;
}

export type WhatsAppTemplateType =
  | 'order_placed'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_ready';

interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  template: {
    name: string;
    language: {
      code: string;
    };
    components: Array<{
      type: string;
      parameters?: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
}

interface WhatsAppTextMessage {
  messaging_product: string;
  to: string;
  type: 'text';
  text: {
    body: string;
    preview_url?: boolean;
  };
}

const templateMap: Record<WhatsAppTemplateType, string> = {
  order_placed: WHATSAPP_ORDER_PLACED_TEMPLATE,
  order_accepted: WHATSAPP_ORDER_ACCEPTED_TEMPLATE,
  order_rejected: WHATSAPP_ORDER_REJECTED_TEMPLATE,
  order_ready: WHATSAPP_ORDER_READY_TEMPLATE,
};

function formatOrderItemsForMessage(
  items: OrderDetailsMessageInput['items']
): string {
  if (!items.length) {
    return 'No items listed';
  }

  return items
    .map((item) => `${item.name} x${item.quantity} (Rs. ${item.price.toFixed(2)})`)
    .join(', ');
}

function buildOrderPlacedMessage(details: OrderDetailsMessageInput): string {
  return [
    'famFood6 order confirmed',
    `Token: ${details.tokenNumber}`,
    `Order ID: ${details.orderId}`,
    `Items: ${formatOrderItemsForMessage(details.items)}`,
    `Total: Rs. ${details.totalAmount.toFixed(2)}`,
    `Payment: ${details.paymentMethod}`,
    `Estimated prep: ${details.estimatedPrepTime} mins`,
    `Pickup PIN: ${details.deliveryPIN}`,
  ].join('\n');
}

async function sendWhatsAppPayload(
  mobileNumber: string,
  payload: Omit<WhatsAppMessage, 'messaging_product' | 'to'> | Omit<WhatsAppTextMessage, 'messaging_product' | 'to'>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const normalizedNumber = String(mobileNumber || '').replace(/\D/g, '');
    const tenDigitNumber = normalizedNumber.startsWith('91')
      ? normalizedNumber.slice(2)
      : normalizedNumber;

    if (!tenDigitNumber.match(/^[0-9]{10}$/)) {
      return {
        success: false,
        error: 'Invalid mobile number format',
      };
    }

    if (
      isPlaceholderEnvValue(WHATSAPP_TOKEN) ||
      isPlaceholderEnvValue(WHATSAPP_PHONE_ID)
    ) {
      console.warn('WhatsApp credentials are missing or still using placeholder values');
      return {
        success: false,
        error:
          'WhatsApp service not configured. Set valid WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in backend environment variables.',
      };
    }

    const formattedNumber = `91${tenDigitNumber}`;
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        ...payload,
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.messages && response.data.messages[0]) {
      return {
        success: true,
        messageId: response.data.messages[0].id,
      };
    }

    return {
      success: false,
      error: 'Failed to send message',
    };
  } catch (error: any) {
    console.error('WhatsApp API error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || 'WhatsApp service error',
    };
  }
}

export async function sendWhatsAppMessage(
  mobileNumber: string,
  templateType: WhatsAppTemplateType,
  variables: WhatsAppTemplateVariable
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateName = templateMap[templateType];

  return sendWhatsAppPayload(mobileNumber, {
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: 'en_US',
      },
      components: [
        {
          type: 'body',
          parameters: Object.entries(variables).map(([_, value]) => ({
            type: 'text',
            text: value,
          })),
        },
      ],
    },
  });
}

export async function sendLoginOtpMessage(
  mobileNumber: string,
  otp: string,
  expiresInMinutes: number
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const otpTemplateName = process.env.WHATSAPP_OTP_TEMPLATE;

  // Prefer template delivery for production reliability; fallback to text for quick setup.
  if (otpTemplateName) {
    return sendWhatsAppPayload(mobileNumber, {
      type: 'template',
      template: {
        name: otpTemplateName,
        language: {
          code: 'en_US',
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: otp,
              },
              {
                type: 'text',
                text: String(expiresInMinutes),
              },
            ],
          },
        ],
      },
    });
  }

  return sendWhatsAppPayload(mobileNumber, {
    type: 'text',
    text: {
      preview_url: false,
      body: `Your famFood6 login OTP is ${otp}. It will expire in ${expiresInMinutes} minutes. Do not share this code.`,
    },
  });
}

export async function sendOrderPlacedMessage(
  mobileNumber: string,
  tokenNumber: string,
  orderId: string,
  orderDetails?: OrderDetailsMessageInput
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateResult = await sendWhatsAppMessage(mobileNumber, 'order_placed', {
    token_number: tokenNumber,
    order_id: orderId,
  });

  if (templateResult.success) {
    return templateResult;
  }

  if (orderDetails) {
    return sendWhatsAppPayload(mobileNumber, {
      type: 'text',
      text: {
        preview_url: false,
        body: buildOrderPlacedMessage(orderDetails),
      },
    });
  }

  return templateResult;
}

export async function sendOrderAcceptedMessage(
  mobileNumber: string,
  estimatedTime: string,
  locationLink: string,
  tokenNumber?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateResult = await sendWhatsAppMessage(mobileNumber, 'order_accepted', {
    estimated_time: estimatedTime,
    location_link: locationLink,
  });

  if (templateResult.success) {
    return templateResult;
  }

  return sendWhatsAppPayload(mobileNumber, {
    type: 'text',
    text: {
      preview_url: false,
      body: [
        'Your famFood6 order is accepted.',
        tokenNumber ? `Token: ${tokenNumber}` : undefined,
        `Estimated prep time: ${estimatedTime}`,
        locationLink ? `Location: ${locationLink}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  });
}

export async function sendOrderRejectedMessage(
  mobileNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateResult = await sendWhatsAppMessage(mobileNumber, 'order_rejected', {});

  if (templateResult.success) {
    return templateResult;
  }

  return sendWhatsAppPayload(mobileNumber, {
    type: 'text',
    text: {
      preview_url: false,
      body: 'Your famFood6 order was rejected. If needed, please place a new order or contact support.',
    },
  });
}

export async function sendOrderReadyMessage(
  mobileNumber: string,
  deliveryPIN: string,
  tokenNumber?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateResult = await sendWhatsAppMessage(mobileNumber, 'order_ready', {
    delivery_pin: deliveryPIN,
  });

  if (templateResult.success) {
    return templateResult;
  }

  return sendWhatsAppPayload(mobileNumber, {
    type: 'text',
    text: {
      preview_url: false,
      body: [
        'Your famFood6 order is ready for pickup.',
        tokenNumber ? `Token: ${tokenNumber}` : undefined,
        `Pickup PIN: ${deliveryPIN}`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  });
}
