export const EventTypes = {
  SALE_CLOSED:      'sale.closed',
  SALE_CANCELLED:   'sale.cancelled',
  SALE_REFUNDED:    'sale.refunded',
  PURCHASE_CREATED: 'purchase.created',
  PURCHASE_PAID:    'purchase.paid',
} as const

export type EventType = typeof EventTypes[keyof typeof EventTypes]
