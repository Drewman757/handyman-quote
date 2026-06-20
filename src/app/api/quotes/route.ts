import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Lazy — avoids module-load crash when env vars are missing at cold start.
// Also decodes the JWT to assert it really is a service_role key, so a
// misconfigured Vercel env var (e.g. anon key pasted in the wrong field)
// produces a clear error instead of a cryptic "permission denied".
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      `Missing env vars — NEXT_PUBLIC_SUPABASE_URL=${!!url}, SUPABASE_SERVICE_ROLE_KEY=${!!key}. ` +
      `Add SUPABASE_SERVICE_ROLE_KEY to your Vercel project environment variables ` +
      `(Supabase dashboard → Project Settings → API → service_role secret).`
    )
  }
  // Decode the JWT payload (middle segment) to verify role === 'service_role'.
  // The service_role key bypasses RLS; the anon key does not.
  try {
    const payload = JSON.parse(
      Buffer.from(key.split('.')[1], 'base64').toString('utf8')
    ) as Record<string, unknown>
    if (payload.role !== 'service_role') {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY contains a "${payload.role}" key, not "service_role". ` +
        `Go to Supabase → Project Settings → API and copy the service_role secret (not the anon key).`
      )
    }
  } catch (decodeErr) {
    if (decodeErr instanceof Error && decodeErr.message.includes('service_role')) throw decodeErr
    // Non-standard key format — proceed and let Supabase validate it
  }
  return createAdmin(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
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
    const { client, transcript, notes, lineItems, taxRate, paymentTerms, caveats, financingOptions, lumpSum, send, photoUrls } = body

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
    type SectionRow = { type: 'section'; title: string; sort_order: number }
    type ItemRow = { type: 'item'; description: string; pricing_type: string; unit_price: number; quantity: number; total: number; notes: string; sort_order: number }
    type AnyRow = SectionRow | ItemRow

    const allRows = ((lineItems ?? []) as AnyRow[])
    const validRows = allRows.filter(row =>
      row.type === 'section' ? (row as SectionRow).title?.trim() : (row as ItemRow).description?.trim()
    )
    const validItems = validRows.filter((r): r is ItemRow => r.type === 'item')

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
        financing_options: financingOptions || null,
        lump_sum: lumpSum === true,
        photo_urls: Array.isArray(photoUrls) ? photoUrls : [],
        sent_at: send ? new Date().toISOString() : null,
      })
      .select('id')
      .single()
    if (quoteErr) throw quoteErr

    // ── 8. Insert line items (sections + items) ────────────────────────────
    step = 'line-items'
    if (validRows.length > 0) {
      const { error: liErr } = await admin.from('line_items').insert(
        validRows.map((row, i) =>
          row.type === 'section'
            ? {
                quote_id: quote!.id,
                item_type: 'section',
                description: (row as SectionRow).title,
                pricing_type: 'fixed',
                unit_price: 0,
                quantity: 1,
                total: 0,
                sort_order: (row as SectionRow).sort_order ?? i,
              }
            : {
                quote_id: quote!.id,
                item_type: 'item',
                description: (row as ItemRow).description,
                pricing_type: (row as ItemRow).pricing_type,
                unit_price: (row as ItemRow).unit_price,
                quantity: (row as ItemRow).quantity,
                total: (row as ItemRow).total,
                sort_order: (row as ItemRow).sort_order ?? i,
                notes: (row as ItemRow).notes || null,
              }
        )
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
