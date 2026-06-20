import type { LineItem, LineItemFormData, PricingType } from '@/lib/types'

export function calculateLineItemTotal(
  pricingType: PricingType,
  unitPrice: number,
  quantity: number,
  minCharge?: number
): number {
  let total = 0
  switch (pricingType) {
    case 'fixed':
      total = unitPrice
      break
    case 'sqft':
    case 'hourly':
      total = unitPrice * quantity
      break
  }
  if (minCharge && total < minCharge) total = minCharge
  return Math.round(total * 100) / 100
}

export function calculateQuoteTotals(lineItems: LineItem[], taxRate: number) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100
  return { subtotal, taxAmount, total }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function getPricingLabel(type: PricingType): string {
  switch (type) {
    case 'fixed': return 'Flat rate'
    case 'sqft': return 'Per sq ft'
    case 'hourly': return 'Per hour'
  }
}

export function getUnitLabel(type: PricingType, custom?: string): string {
  if (custom) return custom
  switch (type) {
    case 'fixed': return 'flat'
    case 'sqft': return 'sq ft'
    case 'hourly': return 'hr'
  }
}

/** Extracts the first numeric value from a voice transcript string.
 *  Returns null if no digits are found — callers should silently no-op. */
export function parseFirstNumber(text: string): number | null {
  const match = text.match(/\d+(\.\d+)?/)
  if (!match) return null
  const n = parseFloat(match[0])
  return isNaN(n) ? null : n
}

/**
 * Heuristic: if a line item's win rate is below 40%, flag pricing as high.
 * Below 20%, flag as very high.
 */
export function getPricingFlag(winRate: number): 'ok' | 'high' | 'very_high' {
  if (winRate < 20) return 'very_high'
  if (winRate < 40) return 'high'
  return 'ok'
}
