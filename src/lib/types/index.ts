// ─── Contractor / Auth ──────────────────────────────────────────────────────

export interface Contractor {
  id: string
  user_id: string
  business_name: string
  owner_name: string
  phone: string
  email: string
  license_number?: string
  logo_url?: string
  default_payment_terms?: string
  default_caveats?: string
  financing_options?: string
  created_at: string
}

// ─── Client ─────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  contractor_id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  notes?: string
  created_at: string
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

export type PricingType = 'fixed' | 'sqft' | 'hourly'

export interface PricingTemplate {
  id: string
  contractor_id: string
  name: string
  description?: string
  pricing_type: PricingType
  unit_price: number         // price per unit (sqft, hour) or flat amount
  unit_label?: string        // e.g. "sq ft", "hour", "each"
  min_charge?: number
  category: string           // e.g. "Painting", "Flooring", "Plumbing"
  created_at: string
}

// ─── Quote ────────────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'

export interface LineItem {
  id: string
  quote_id: string
  description: string
  pricing_type: PricingType
  unit_price: number
  quantity: number           // hours, sqft, or count
  unit_label?: string
  total: number
  sort_order: number
  notes?: string
  pricing_template_id?: string
}

export interface Quote {
  id: string
  contractor_id: string
  client_id: string
  quote_number: string
  status: QuoteStatus
  voice_transcript?: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  payment_terms?: string
  caveats?: string
  financing_options?: string
  valid_until?: string
  notes?: string
  pdf_url?: string
  sent_at?: string
  viewed_at?: string
  responded_at?: string
  created_at: string
  updated_at: string

  // joined
  client?: Client
  line_items?: LineItem[]
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface QuoteAnalytics {
  total_quotes: number
  sent_quotes: number
  accepted_quotes: number
  paid_quotes: number          // subset of accepted_quotes where is_paid
  declined_quotes: number
  pending_quotes: number
  win_rate: number
  avg_quote_value: number
  total_revenue: number       // sum of accepted quotes
  total_pipeline: number      // sum of sent/viewed quotes
}

export interface LineItemAnalytics {
  description: string
  times_quoted: number
  times_accepted: number
  times_declined: number
  win_rate: number
  avg_price: number
  price_flag: 'ok' | 'high' | 'very_high'  // heuristic for pricing too high
}

// ─── Voice ────────────────────────────────────────────────────────────────────

export interface VoiceRecording {
  transcript: string
  duration_seconds: number
  created_at: string
}

export interface ParsedTask {
  description: string
  suggested_pricing_type: PricingType
  suggested_quantity?: number
  matched_template_id?: string
  confidence: 'high' | 'medium' | 'low'
}

// ─── Form Schemas ─────────────────────────────────────────────────────────────

export interface ClientFormData {
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  notes?: string
}

export interface LineItemFormData {
  description: string
  pricing_type: PricingType
  unit_price: number
  quantity: number
  unit_label?: string
  notes?: string
}
