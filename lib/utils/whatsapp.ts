import axios from 'axios';

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v18.0';
const WHATSAPP_API_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';
const WHATSAPP_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en_US';
const WHATSAPP_ORDER_PLACED_TEMPLATE =
  process.env.WHATSAPP_ORDER_PLACED_TEMPLATE?.trim();
const WHATSAPP_ORDER_ACCEPTED_TEMPLATE =
  process.env.WHATSAPP_ORDER_ACCEPTED_TEMPLATE?.trim();
const WHATSAPP_ORDER_REJECTED_TEMPLATE =
  process.env.WHATSAPP_ORDER_REJECTED_TEMPLATE?.trim();
const WHATSAPP_ORDER_READY_TEMPLATE =
  process.env.WHATSAPP_ORDER_READY_TEMPLATE?.trim();
const WHATSAPP_ORDER_CANCELLED_TEMPLATE =
  process.env.WHATSAPP_ORDER_CANCELLED_TEMPLATE?.trim();
const WHATSAPP_FREE_ORDER_TEMPLATE =
  process.env.WHATSAPP_FREE_ORDER_TEMPLATE?.trim();

function parseParamKeys(value?: string): string[] {
  return String(value || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

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
  | 'order_ready'
  | 'order_cancelled'
  | 'free_order';

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

interface WhatsAppTemplatePayload {
  type: 'template';
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

const templateMap: Partial<Record<WhatsAppTemplateType, string>> = {
  order_placed: WHATSAPP_ORDER_PLACED_TEMPLATE,
  order_accepted: WHATSAPP_ORDER_ACCEPTED_TEMPLATE,
  order_rejected: WHATSAPP_ORDER_REJECTED_TEMPLATE,
  order_ready: WHATSAPP_ORDER_READY_TEMPLATE,
  order_cancelled: WHATSAPP_ORDER_CANCELLED_TEMPLATE,
  free_order: WHATSAPP_FREE_ORDER_TEMPLATE,
};

const templateParamKeyMap: Partial<Record<WhatsAppTemplateType, string[]>> = {
  order_placed: parseParamKeys(process.env.WHATSAPP_ORDER_PLACED_PARAM_KEYS),
  order_accepted: parseParamKeys(process.env.WHATSAPP_ORDER_ACCEPTED_PARAM_KEYS),
  order_rejected: parseParamKeys(process.env.WHATSAPP_ORDER_REJECTED_PARAM_KEYS),
  order_ready: parseParamKeys(process.env.WHATSAPP_ORDER_READY_PARAM_KEYS),
  order_cancelled: parseParamKeys(process.env.WHATSAPP_ORDER_CANCELLED_PARAM_KEYS),
  free_order: parseParamKeys(process.env.WHATSAPP_FREE_ORDER_PARAM_KEYS),
};

const templateHeaderParamKeyMap: Partial<Record<WhatsAppTemplateType, string[]>> = {
  order_placed: parseParamKeys(process.env.WHATSAPP_ORDER_PLACED_HEADER_PARAM_KEYS),
  order_accepted: parseParamKeys(process.env.WHATSAPP_ORDER_ACCEPTED_HEADER_PARAM_KEYS),
  order_rejected: parseParamKeys(process.env.WHATSAPP_ORDER_REJECTED_HEADER_PARAM_KEYS),
  order_ready: parseParamKeys(process.env.WHATSAPP_ORDER_READY_HEADER_PARAM_KEYS),
  order_cancelled: parseParamKeys(process.env.WHATSAPP_ORDER_CANCELLED_HEADER_PARAM_KEYS),
  free_order: parseParamKeys(process.env.WHATSAPP_FREE_ORDER_HEADER_PARAM_KEYS),
};

const templateBodyParamKeyMap: Partial<Record<WhatsAppTemplateType, string[]>> = {
  order_placed: parseParamKeys(process.env.WHATSAPP_ORDER_PLACED_BODY_PARAM_KEYS),
  order_accepted: parseParamKeys(process.env.WHATSAPP_ORDER_ACCEPTED_BODY_PARAM_KEYS),
  order_rejected: parseParamKeys(process.env.WHATSAPP_ORDER_REJECTED_BODY_PARAM_KEYS),
  order_ready: parseParamKeys(process.env.WHATSAPP_ORDER_READY_BODY_PARAM_KEYS),
  order_cancelled: parseParamKeys(process.env.WHATSAPP_ORDER_CANCELLED_BODY_PARAM_KEYS),
  free_order: parseParamKeys(process.env.WHATSAPP_FREE_ORDER_BODY_PARAM_KEYS),
};

const otpTemplateParamKeys = parseParamKeys(process.env.WHATSAPP_OTP_PARAM_KEYS);

function resolveTemplateVariables(
  templateType: WhatsAppTemplateType,
  variables: WhatsAppTemplateVariable | string[]
): string[] {
  if (Array.isArray(variables)) {
    return variables.map((value) => String(value));
  }

  const configuredKeys = templateParamKeyMap[templateType] || [];
  if (configuredKeys.length) {
    return configuredKeys
      .map((key) => variables[key])
      .filter((value): value is string => value !== undefined && value !== null)
      .map((value) => String(value));
  }

  return Object.values(variables).map((value) => String(value));
}

function resolveTemplateComponents(
  templateType: WhatsAppTemplateType,
  variables: WhatsAppTemplateVariable | string[]
): Array<{ type: string; parameters?: Array<{ type: string; text: string }> }> {
  if (Array.isArray(variables)) {
    return variables.length
      ? [
          {
            type: 'body',
            parameters: variables.map((value) => ({
              type: 'text',
              text: String(value),
            })),
          },
        ]
      : [];
  }

  const headerKeys = templateHeaderParamKeyMap[templateType] || [];
  const bodyKeys = templateBodyParamKeyMap[templateType] || [];

  if (headerKeys.length || bodyKeys.length) {
    const components: Array<{ type: string; parameters?: Array<{ type: string; text: string }> }> = [];

    if (headerKeys.length) {
      const headerParams = headerKeys
        .map((key) => variables[key])
        .filter((value): value is string => value !== undefined && value !== null)
        .map((value) => ({
          type: 'text',
          text: String(value),
        }));

      components.push({
        type: 'header',
        parameters: headerParams,
      });
    }

    if (bodyKeys.length) {
      const bodyParams = bodyKeys
        .map((key) => variables[key])
        .filter((value): value is string => value !== undefined && value !== null)
        .map((value) => ({
          type: 'text',
          text: String(value),
        }));

      components.push({
        type: 'body',
        parameters: bodyParams,
      });
    }

    return components;
  }

  const fallbackValues = resolveTemplateVariables(templateType, variables);
  return fallbackValues.length
    ? [
        {
          type: 'body',
          parameters: fallbackValues.map((value) => ({
            type: 'text',
            text: value,
          })),
        },
      ]
    : [];
}

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
  const normalizedNumber = String(mobileNumber || '').replace(/\D/g, '');
  const countryCode = WHATSAPP_COUNTRY_CODE.replace(/\D/g, '');
  const tenDigitNumber = normalizedNumber.startsWith(countryCode)
    ? normalizedNumber.slice(countryCode.length)
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

  const formattedNumber = `${countryCode}${tenDigitNumber}`;
  const endpoint = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`;

  const sendRequest = async (
    requestPayload: Omit<WhatsAppMessage, 'messaging_product' | 'to'> | Omit<WhatsAppTextMessage, 'messaging_product' | 'to'>
  ) => {
    return axios.post(
      endpoint,
      {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        ...requestPayload,
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  };

  const adjustTemplatePayloadForParamMismatch = (
    templatePayload: WhatsAppTemplatePayload,
    details: string
  ): WhatsAppTemplatePayload | null => {
    const mismatchMatch = details.match(
      /(header|body): number of localizable_params \((\d+)\) does not match the expected number of params \((\d+)\)/i
    );

    if (!mismatchMatch) {
      return null;
    }

    const targetComponent = mismatchMatch[1].toLowerCase() as 'header' | 'body';
    const expectedCount = parseInt(mismatchMatch[3], 10);

    if (!Number.isInteger(expectedCount) || expectedCount < 0) {
      return null;
    }

    const components = [...(templatePayload.template.components || [])];
    const headerIndex = components.findIndex((c) => c.type === 'header');
    const bodyIndex = components.findIndex((c) => c.type === 'body');

    const headerParams =
      headerIndex >= 0 ? components[headerIndex].parameters || [] : [];
    const bodyParams = bodyIndex >= 0 ? components[bodyIndex].parameters || [] : [];
    const pooledParams = [...headerParams, ...bodyParams];

    const sourceParams =
      targetComponent === 'header'
        ? headerParams.length
          ? headerParams
          : bodyParams.length
            ? bodyParams
            : pooledParams
        : bodyParams.length
          ? bodyParams
          : headerParams.length
            ? headerParams
            : pooledParams;

    const adjustedParams = sourceParams.slice(0, expectedCount);

    const targetIndex =
      targetComponent === 'header' ? headerIndex : bodyIndex;

    if (targetIndex >= 0) {
      components[targetIndex] = {
        ...components[targetIndex],
        parameters: adjustedParams,
      };
    } else {
      components.push({
        type: targetComponent,
        parameters: adjustedParams,
      });
    }

    return {
      ...templatePayload,
      template: {
        ...templatePayload.template,
        components,
      },
    };
  };

  let requestPayload = payload;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await sendRequest(requestPayload);

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
      const apiError = error.response?.data?.error;
      const errorDetails = String(apiError?.error_data?.details || '');
      const isTemplatePayload =
        (requestPayload as any)?.type === 'template' &&
        Array.isArray((requestPayload as any)?.template?.components);

      if (
        apiError?.code === 132000 &&
        isTemplatePayload &&
        attempt < 2
      ) {
        const adjustedPayload = adjustTemplatePayloadForParamMismatch(
          requestPayload as WhatsAppTemplatePayload,
          errorDetails
        );

        if (adjustedPayload) {
          requestPayload = adjustedPayload;
          continue;
        }
      }

      if (attempt > 0) {
        console.error('WhatsApp API retry error:', error.response?.data || error.message);
      }
      console.error('WhatsApp API error:', error.response?.data || error.message);

      const detailedError = apiError
        ? `${apiError.message || 'WhatsApp API error'} (code: ${apiError.code || 'n/a'}, subcode: ${apiError.error_subcode || 'n/a'}, type: ${apiError.type || 'n/a'}, details: ${apiError.error_data?.details || 'n/a'})`
        : undefined;

      return {
        success: false,
        error: detailedError || error.response?.data?.error?.message || 'WhatsApp service error',
      };
    }
  }

  return {
    success: false,
    error: 'WhatsApp service error',
  };
}

function buildTemplatePayload(
  templateName: string,
  components: Array<{ type: string; parameters?: Array<{ type: string; text: string }> }>
): WhatsAppTemplatePayload {
  const trimmedTemplateName = templateName.trim();

  return {
    type: 'template',
    template: {
      name: trimmedTemplateName,
      language: {
        code: WHATSAPP_TEMPLATE_LANGUAGE,
      },
      components,
    },
  };
}

export async function sendWhatsAppMessage(
  mobileNumber: string,
  templateType: WhatsAppTemplateType,
  variables: WhatsAppTemplateVariable | string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateName = templateMap[templateType];

  if (!templateName) {
    return {
      success: false,
      error: `WhatsApp template not configured for ${templateType}`,
    };
  }

  const components = resolveTemplateComponents(templateType, variables);

  return sendWhatsAppPayload(
    mobileNumber,
    buildTemplatePayload(templateName, components)
  );
}

export async function sendLoginOtpMessage(
  mobileNumber: string,
  otp: string,
  expiresInMinutes: number
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const otpTemplateName = process.env.WHATSAPP_OTP_TEMPLATE?.trim();
  const isHostedRuntime =
    process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

  // Prefer template delivery for production reliability; fallback to text for quick setup.
  if (otpTemplateName) {
    const otpTemplateVariables = otpTemplateParamKeys.length
      ? otpTemplateParamKeys
          .map((key) => {
            if (key === 'otp') return otp;
            if (key === 'expires_in_minutes' || key === 'expiresInMinutes') {
              return String(expiresInMinutes);
            }
            return undefined;
          })
          .filter((value): value is string => value !== undefined)
      : [otp, String(expiresInMinutes)];

    return sendWhatsAppPayload(
      mobileNumber,
      buildTemplatePayload(
        otpTemplateName,
        otpTemplateVariables.length
          ? [
              {
                type: 'body',
                parameters: otpTemplateVariables.map((value) => ({
                  type: 'text',
                  text: value,
                })),
              },
            ]
          : []
      )
    );
  }

  if (isHostedRuntime || process.env.NODE_ENV === 'production') {
    return {
      success: false,
      error:
        'WHATSAPP_OTP_TEMPLATE is required in production/hosted environments. Free-form text OTP is blocked by WhatsApp outside customer care window.',
    };
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
  const templateResult = await sendWhatsAppMessage(
    mobileNumber,
    'order_placed',
    {
      token_number: tokenNumber,
      tokenNumber,
      order_id: orderId,
      orderId,
    }
  );

  if (templateResult.success) {
    return templateResult;
  }

  if (orderDetails) {
    const fallbackResult = await sendWhatsAppPayload(mobileNumber, {
      type: 'text',
      text: {
        preview_url: false,
        body: buildOrderPlacedMessage(orderDetails),
      },
    });

    if (fallbackResult.success) {
      return fallbackResult;
    }

    return {
      success: false,
      error: [
        `Template failed: ${templateResult.error || 'unknown template error'}`,
        `Fallback text failed: ${fallbackResult.error || 'unknown fallback error'}`,
      ].join(' | '),
    };
  }

  return templateResult;
}

export async function sendOrderAcceptedMessage(
  mobileNumber: string,
  estimatedTime: string,
  locationLink: string,
  tokenNumber?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateResult = await sendWhatsAppMessage(
    mobileNumber,
    'order_accepted',
    {
      estimated_time: estimatedTime,
      estimatedTime,
      location_link: locationLink,
      locationLink,
      token_number: tokenNumber || '',
      tokenNumber: tokenNumber || '',
    }
  );

  if (templateResult.success) {
    return templateResult;
  }

  const fallbackResult = await sendWhatsAppPayload(mobileNumber, {
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

  if (fallbackResult.success) {
    return fallbackResult;
  }

  return {
    success: false,
    error: [
      `Template failed: ${templateResult.error || 'unknown template error'}`,
      `Fallback text failed: ${fallbackResult.error || 'unknown fallback error'}`,
    ].join(' | '),
  };
}

export async function sendOrderRejectedMessage(
  mobileNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateResult = await sendWhatsAppMessage(mobileNumber, 'order_rejected', {});

  if (templateResult.success) {
    return templateResult;
  }

  const fallbackResult = await sendWhatsAppPayload(mobileNumber, {
    type: 'text',
    text: {
      preview_url: false,
      body: 'Your famFood6 order was rejected. If needed, please place a new order or contact support.',
    },
  });

  if (fallbackResult.success) {
    return fallbackResult;
  }

  return {
    success: false,
    error: [
      `Template failed: ${templateResult.error || 'unknown template error'}`,
      `Fallback text failed: ${fallbackResult.error || 'unknown fallback error'}`,
    ].join(' | '),
  };
}

export async function sendOrderReadyMessage(
  mobileNumber: string,
  deliveryPIN: string,
  tokenNumber?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateResult = await sendWhatsAppMessage(
    mobileNumber,
    'order_ready',
    {
      delivery_pin: deliveryPIN,
      deliveryPIN,
      token_number: tokenNumber || '',
      tokenNumber: tokenNumber || '',
    }
  );

  if (templateResult.success) {
    return templateResult;
  }

  const fallbackResult = await sendWhatsAppPayload(mobileNumber, {
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

  if (fallbackResult.success) {
    return fallbackResult;
  }

  return {
    success: false,
    error: [
      `Template failed: ${templateResult.error || 'unknown template error'}`,
      `Fallback text failed: ${fallbackResult.error || 'unknown fallback error'}`,
    ].join(' | '),
  };
}

export async function sendOrderCancelledMessage(
  mobileNumber: string,
  tokenNumber?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateResult = await sendWhatsAppMessage(
    mobileNumber,
    'order_cancelled',
    {
      token_number: tokenNumber || '',
      tokenNumber: tokenNumber || '',
    }
  );

  if (templateResult.success) {
    return templateResult;
  }

  const fallbackResult = await sendWhatsAppPayload(mobileNumber, {
    type: 'text',
    text: {
      preview_url: false,
      body: [
        'Your famFood6 order was cancelled successfully.',
        tokenNumber ? `Token: ${tokenNumber}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  });

  if (fallbackResult.success) {
    return fallbackResult;
  }

  return {
    success: false,
    error: [
      `Template failed: ${templateResult.error || 'unknown template error'}`,
      `Fallback text failed: ${fallbackResult.error || 'unknown fallback error'}`,
    ].join(' | '),
  };
}

export async function sendFreeOrderCongratsMessage(
  mobileNumber: string,
  tokenNumber: string,
  freeItems: Array<{ name: string; quantity: number }>,
  ordersRemainingForNextFree: number
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const freeItemsText = freeItems.length
    ? freeItems.map((item) => `${item.name} x${item.quantity}`).join(', ')
    : 'Your reward item';

  const templateResult = await sendWhatsAppMessage(
    mobileNumber,
    'free_order',
    {
      token_number: tokenNumber,
      tokenNumber,
      free_items: freeItemsText,
      freeItems: freeItemsText,
      remaining_for_next_free: String(ordersRemainingForNextFree),
      remainingForNextFree: String(ordersRemainingForNextFree),
    }
  );

  if (templateResult.success) {
    return templateResult;
  }

  const fallbackResult = await sendWhatsAppPayload(mobileNumber, {
    type: 'text',
    text: {
      preview_url: false,
      body: [
        'Congratulations! Your FREE reward order is placed.',
        `Token: ${tokenNumber}`,
        `Free item: ${freeItemsText}`,
        `Only ${ordersRemainingForNextFree} more order(s) of this item to unlock your next FREE reward.`,
      ].join('\n'),
    },
  });

  if (fallbackResult.success) {
    return fallbackResult;
  }

  return {
    success: false,
    error: [
      `Template failed: ${templateResult.error || 'unknown template error'}`,
      `Fallback text failed: ${fallbackResult.error || 'unknown fallback error'}`,
    ].join(' | '),
  };
}
