import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    // Verify session via cookie-based server client
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { client, transcript, notes, lineItems, taxRate, paymentTerms, caveats, send } = await req.json()

    // 1. Get or create contractor via admin (bypasses RLS — fixes "Contractor not found")
    let { data: contractor } = await supabaseAdmin
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!contractor) {
      const { data: newContractor, error: createErr } = await supabaseAdmin
        .from('contractors')
        .insert({
          user_id: user.id,
          business_name: user.email?.split('@')[0] || 'My Business',
          email: user.email || '',
          owner_name: '',
          phone: '',
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      contractor = newContractor
    }

    const contractorId = contractor!.id

    // 2. Upsert client
    let clientId: string
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('contractor_id', contractorId)
      .eq('email', client.email)
      .maybeSingle()

    if (existingClient) {
      clientId = existingClient.id
    } else {
      const { data: newClient, error: clientErr } = await supabaseAdmin
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
      clientId = newClient.id
    }

    // 3. Generate quote number
    const { data: quoteNumber } = await supabaseAdmin.rpc('generate_quote_number', {
      p_contractor_id: contractorId,
    })

    // 4. Calculate totals from client-supplied line item totals
    const validItems: { description: string; pricing_type: string; unit_price: number; quantity: number; total: number; notes: string }[] =
      (lineItems as { description: string; pricing_type: string; unit_price: number; quantity: number; total: number; notes: string }[])
        .filter((li) => li.description)
    const subtotal = validItems.reduce((sum, li) => sum + li.total, 0)
    const taxRateFraction = taxRate / 100
    const taxAmount = subtotal * taxRateFraction
    const total = subtotal + taxAmount

    // 5. Create quote
    const { data: quote, error: quoteErr } = await supabaseAdmin
      .from('quotes')
      .insert({
        contractor_id: contractorId,
        client_id: clientId,
        quote_number: quoteNumber,
        status: send ? 'sent' : 'draft',
        voice_transcript: transcript,
        notes,
        subtotal,
        tax_rate: taxRateFraction,
        tax_amount: taxAmount,
        total,
        payment_terms: paymentTerms,
        caveats,
        sent_at: send ? new Date().toISOString() : null,
      })
      .select('id')
      .single()
    if (quoteErr) throw quoteErr

    // 6. Insert line items
    if (validItems.length > 0) {
      const { error: liErr } = await supabaseAdmin.from('line_items').insert(
        validItems.map((li, i) => ({
          quote_id: quote.id,
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

    return NextResponse.json({ quoteId: quote.id })
  } catch (err) {
    console.error('[POST /api/quotes]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create quote' },
      { status: 500 }
    )
  }
}
