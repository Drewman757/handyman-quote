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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()

    // Verify the authenticated user owns this quote
    const { data: existing } = await admin
      .from('quotes')
      .select('id, client_id, contractor:contractors!inner(user_id)')
      .eq('id', id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    const contractorRow = (Array.isArray(existing.contractor) ? existing.contractor[0] : existing.contractor) as Record<string, string>
    if (contractorRow.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { client, notes, lineItems, taxRate, paymentTerms, caveats, lumpSum, voiceTranscript } = body

    // Update client record in place
    if (client && existing.client_id) {
      await admin.from('clients').update({
        name: client.name,
        address: client.address,
        city: client.city,
        state: client.state,
        zip: client.zip,
        phone: client.phone,
        email: client.email,
      }).eq('id', existing.client_id)
    }

    // Compute totals from item rows only
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

    // Update quote fields
    const quoteUpdate: Record<string, unknown> = {
      notes: notes || null,
      subtotal,
      tax_rate: taxRateFraction,
      tax_amount: taxAmount,
      total,
      payment_terms: paymentTerms || null,
      caveats: caveats || null,
      lump_sum: lumpSum === true,
    }
    // Only write voice_transcript when the client sends it (avoids clobbering on non-voice edits)
    if (voiceTranscript !== undefined) {
      quoteUpdate.voice_transcript = voiceTranscript || null
    }

    const { error: quoteErr } = await admin
      .from('quotes')
      .update(quoteUpdate)
      .eq('id', id)
    if (quoteErr) throw quoteErr

    // Replace all line items
    await admin.from('line_items').delete().eq('quote_id', id)

    if (validRows.length > 0) {
      const { error: liErr } = await admin.from('line_items').insert(
        validRows.map((row, i) =>
          row.type === 'section'
            ? {
                quote_id: id,
                item_type: 'section',
                description: (row as SectionRow).title,
                pricing_type: 'fixed',
                unit_price: 0,
                quantity: 1,
                total: 0,
                sort_order: (row as SectionRow).sort_order ?? i,
              }
            : {
                quote_id: id,
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

    return NextResponse.json({ quoteId: id })
  } catch (err) {
    console.error('[PUT /api/quotes/[id]]', err)
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}
