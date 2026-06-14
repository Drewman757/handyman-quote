import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, getUnitLabel } from '@/lib/utils/pricing'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { quoteId } = await req.json()
    const supabase = await createClient()

    const { data: quote } = await supabase
      .from('quotes')
      .select('*, client:clients(*), line_items(*), contractor:contractors(*)')
      .eq('id', quoteId)
      .single()

    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const client = quote.client as Record<string, string>
    const contractor = quote.contractor as Record<string, string>
    const lineItems = (quote.line_items as Record<string, unknown>[]) || []

    const lineItemsHtml = lineItems
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map(li => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
            <div style="font-size:14px;color:#111827;">${li.description}</div>
            ${li.pricing_type !== 'fixed' ? `<div style="font-size:12px;color:#9ca3af;">${li.quantity} ${getUnitLabel(li.pricing_type as 'sqft' | 'hourly')} × ${formatCurrency(li.unit_price as number)}</div>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:14px;font-weight:600;color:#111827;">
            ${formatCurrency(li.total as number)}
          </td>
        </tr>
      `).join('')

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#f97316;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">${contractor.business_name}</h1>
      <p style="color:#fed7aa;margin:4px 0 0;font-size:14px;">Project Quote</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Hi ${client.name},</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">Thank you for the opportunity. Please find your project quote below.</p>
      
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;">
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px;">QUOTE ${quote.quote_number}</div>
        <div style="font-size:13px;color:#374151;">${client.address}, ${client.city}, ${client.state} ${client.zip}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        ${lineItemsHtml}
      </table>

      <div style="border-top:2px solid #111827;margin-top:16px;padding-top:16px;">
        ${quote.tax_rate > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#6b7280;margin-bottom:6px;">
          <span>Subtotal</span><span>${formatCurrency(quote.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#6b7280;margin-bottom:6px;">
          <span>Tax (${(quote.tax_rate * 100).toFixed(1)}%)</span><span>${formatCurrency(quote.tax_amount)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;color:#111827;">
          <span>Total</span><span>${formatCurrency(quote.total)}</span>
        </div>
      </div>

      ${quote.payment_terms ? `<p style="font-size:13px;color:#6b7280;margin-top:20px;padding-top:16px;border-top:1px solid #f3f4f6;">${quote.payment_terms}</p>` : ''}
      ${quote.caveats ? `<p style="font-size:13px;color:#6b7280;">${quote.caveats}</p>` : ''}

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:13px;color:#9ca3af;">
        <p style="margin:0;">${contractor.business_name}</p>
        <p style="margin:4px 0 0;">${contractor.phone} · ${contractor.email}</p>
      </div>
    </div>
  </div>
</body>
</html>`

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
      to: client.email,
      subject: `Your quote from ${contractor.business_name} — ${formatCurrency(quote.total)}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
