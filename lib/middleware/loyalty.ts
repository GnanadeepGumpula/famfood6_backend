import { OrderItem, LoyaltyCounter } from '@/lib/types';

export interface LoyaltyCalculationResult {
  items: OrderItem[];
  finalAmount: number;
  loyaltyUpdates: LoyaltyCounter;
  freeItemApplied: boolean;
}

export function calculateLoyaltyDiscount(
  items: OrderItem[],
  currentLoyalty: LoyaltyCounter
): LoyaltyCalculationResult {
  const updatedLoyalty = new Map(Object.entries(currentLoyalty));
  let finalAmount = 0;
  let freeItemApplied = false;
  const processedItems: OrderItem[] = [];

  for (const item of items) {
    let loyaltyCount = updatedLoyalty.get(item.name) || 0;
    let paidUnits = 0;
    let freeUnits = 0;

    // Loyalty rule: buy 5, get 1 free (the 6th unit is free).
    for (let i = 0; i < item.quantity; i++) {
      if (loyaltyCount >= 5) {
        freeUnits += 1;
        freeItemApplied = true;
        loyaltyCount = 0;
      } else {
        paidUnits += 1;
        loyaltyCount += 1;
      }
    }

    updatedLoyalty.set(item.name, loyaltyCount);

    const itemTotal = item.price * paidUnits;
    finalAmount += itemTotal;

    if (paidUnits > 0) {
      processedItems.push({
        ...item,
        quantity: paidUnits,
        price: item.price,
      });
    }

    if (freeUnits > 0) {
      processedItems.push({
        ...item,
        quantity: freeUnits,
        price: 0,
      });
    }
  }

  return {
    items: processedItems,
    finalAmount,
    loyaltyUpdates: Object.fromEntries(updatedLoyalty),
    freeItemApplied,
  };
}

export function applyLoyaltyToItems(
  items: OrderItem[],
  currentLoyalty: LoyaltyCounter
): LoyaltyCalculationResult {
  return calculateLoyaltyDiscount(items, currentLoyalty);
}
