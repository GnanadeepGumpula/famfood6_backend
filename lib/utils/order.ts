export function generateTokenNumber(): string {
  // Generate a 6-digit token number
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateDeliveryPIN(): string {
  // Generate a 4-digit PIN
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function validateTokenNumber(token: string): boolean {
  return /^[0-9]{6}$/.test(token);
}

export function validateDeliveryPIN(pin: string): boolean {
  return /^[0-9]{4}$/.test(pin);
}

export function validateMobileNumber(mobile: string): boolean {
  return /^[0-9]{10}$/.test(mobile);
}
