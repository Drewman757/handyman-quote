import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()

    // Fetch quote + line items + ownership check in one query
    const { data: quote } = await admin
      .from('quotes')
      .select('*, line_items(*), contractor:contractors!inner(id, user_id)')
      .eq('id', id)
      .single()

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    const contractorRow = (Array.isArray(quote.contractor) ? quote.contractor[0] : quote.contractor) as Record<string, string>
    if (contractorRow.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // New quote number
    const { data: quoteNumber } = await admin.rpc('generate_quote_number', {
      p_contractor_id: contractorRow.id,
    })

    // Insert the duplicate
    const { data: newQuote, error: quoteErr } = await admin
      .from('quotes')
      .insert({
        contractor_id: contractorRow.id,
        client_id: quote.client_id,
        quote_number: quoteNumber,
        status: 'draft',
        voice_transcript: quote.voice_transcript,
        notes: quote.notes,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate,
        tax_amount: quote.tax_amount,
        total: quote.total,
        payment_terms: quote.payment_terms,
        caveats: quote.caveats,
        lump_sum: quote.lump_sum,
        photo_urls: quote.photo_urls || [],
      })
      .select('id')
      .single()
    if (quoteErr) throw quoteErr

    // Copy line items
    const lineItems = (quote.line_items as Record<string, unknown>[]) || []
    if (lineItems.length > 0) {
      const { error: liErr } = await admin.from('line_items').insert(
        lineItems.map(li => ({
          quote_id: newQuote!.id,
          item_type: (li.item_type as string) || 'item',
          description: li.description,
          pricing_type: li.pricing_type,
          unit_price: li.unit_price,
          quantity: li.quantity,
          total: li.total,
          sort_order: li.sort_order,
          notes: li.notes || null,
        }))
      )
      if (liErr) throw liErr
    }

    return NextResponse.json({ quoteId: newQuote!.id })
  } catch (err) {
    console.error('[POST /api/quotes/[id]/duplicate]', err)
    return NextResponse.json({ error: 'Failed to duplicate quote' }, { status: 500 })
  }
}
