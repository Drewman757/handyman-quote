import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Lazy — avoids module-load crash when env vars are missing at cold start
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      `Supabase env vars not set — NEXT_PUBLIC_SUPABASE_URL=${!!url}, SUPABASE_SERVICE_ROLE_KEY=${!!key}`
    )
  }
  return createAdmin(url, key, { auth: { persistSession: false } })
}

// Supabase throws PostgrestError plain objects, not Error instances.
// Extract a human-readable message from either.
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.details ?? e.hint ?? JSON.stringify(e))
  }
  return String(err)
}

export async function POST(req: NextRequest) {
  let step = 'auth'
  try {
    // ── 1. Verify session ───────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    step = 'parse'
    const body = await req.json()
    const { client, transcript, notes, lineItems, taxRate, paymentTerms, caveats, send } = body

    // ── 2. Admin client (bypasses RLS) ─────────────────────────────────────
    step = 'admin-init'
    const admin = getAdmin()

    // ── 3. Get or create contractor ────────────────────────────────────────
    step = 'contractor-lookup'
    const { data: contractor, error: contractorSelectErr } = await admin
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (contractorSelectErr) throw contractorSelectErr

    let contractorId: string
    if (contractor) {
      contractorId = contractor.id
    } else {
      step = 'contractor-create'
      const { data: newContractor, error: createErr } = await admin
        .from('contractors')
        .insert({
          user_id: user.id,
          business_name: user.email?.split('@')[0] || 'My Business',
          owner_name: '',
          phone: '',
          email: user.email ?? '',
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      contractorId = newContractor!.id
    }

    // ── 4. Upsert client ───────────────────────────────────────────────────
    step = 'client-lookup'
    const { data: existingClient, error: clientLookupErr } = await admin
      .from('clients')
      .select('id')
      .eq('contractor_id', contractorId)
      .eq('email', client.email)
      .maybeSingle()

    if (clientLookupErr) throw clientLookupErr

    let clientId: string
    if (existingClient) {
      clientId = existingClient.id
    } else {
      step = 'client-create'
      const { data: newClient, error: clientErr } = await admin
        .from('clients')
        .insert({
          contractor_id: contractorId,
          name: client.name,
          address: client.address,
          city: client.city,
          state: client.state,
          zip: client.zip,
          phone: client.phone,
          email: client.email,
        })
        .select('id')
        .single()
      if (clientErr) throw clientErr
      clientId = newClient!.id
    }

    // ── 5. Generate quote number ───────────────────────────────────────────
    step = 'quote-number'
    const { data: quoteNumber, error: rpcErr } = await admin.rpc('generate_quote_number', {
      p_contractor_id: contractorId,
    })
    if (rpcErr) throw rpcErr

    // ── 6. Compute totals ──────────────────────────────────────────────────
    step = 'totals'
    const validItems = ((lineItems ?? []) as {
      description: string; pricing_type: string
      unit_price: number; quantity: number; total: number; notes: string
    }[]).filter((li) => li.description?.trim())

    const subtotal = validItems.reduce((sum, li) => sum + (li.total ?? 0), 0)
    const taxRateFraction = ((taxRate ?? 0) as number) / 100
    const taxAmount = subtotal * taxRateFraction
    const total = subtotal + taxAmount

    // ── 7. Insert quote ────────────────────────────────────────────────────
    step = 'quote-insert'
    const { data: quote, error: quoteErr } = await admin
      .from('quotes')
      .insert({
        contractor_id: contractorId,
        client_id: clientId,
        quote_number: quoteNumber,
        status: send ? 'sent' : 'draft',
        voice_transcript: transcript || null,
        notes: notes || null,
        subtotal,
        tax_rate: taxRateFraction,
        tax_amount: taxAmount,
        total,
        payment_terms: paymentTerms || null,
        caveats: caveats || null,
        sent_at: send ? new Date().toISOString() : null,
      })
      .select('id')
      .single()
    if (quoteErr) throw quoteErr

    // ── 8. Insert line items ───────────────────────────────────────────────
    step = 'line-items'
    if (validItems.length > 0) {
      const { error: liErr } = await admin.from('line_items').insert(
        validItems.map((li, i) => ({
          quote_id: quote!.id,
          description: li.description,
          pricing_type: li.pricing_type,
          unit_price: li.unit_price,
          quantity: li.quantity,
          total: li.total,
          sort_order: i,
          notes: li.notes || null,
        }))
      )
      if (liErr) throw liErr
    }

    return NextResponse.json({ quoteId: quote!.id })
  } catch (err) {
    const message = errMsg(err)
    console.error(`[POST /api/quotes] step=${step}`, JSON.stringify(err))
    return NextResponse.json(
      { error: message, step, detail: err },
      { status: 500 }
    )
  }
}
