import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { formatCurrency, getUnitLabel } from '@/lib/utils/pricing'

const resend = new Resend(process.env.RESEND_API_KEY)

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

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
    const photoPaths = (quote.photo_urls as string[] | null) || []

    // ── Build photo attachments + signed URLs for inline display ─────────────
    interface PhotoResult {
      filename: string
      content: Buffer
      signedUrl: string
    }
    const photos: PhotoResult[] = []

    if (photoPaths.length > 0) {
      const admin = getAdmin()
      for (let i = 0; i < photoPaths.length; i++) {
        const path = photoPaths[i]
        try {
          const [{ data: fileData }, { data: urlData }] = await Promise.all([
            admin.storage.from('quote-photos').download(path),
            admin.storage.from('quote-photos').createSignedUrl(path, 60 * 60 * 24 * 365),
          ])
          if (!fileData || !urlData?.signedUrl) continue

          const buf = Buffer.from(await fileData.arrayBuffer())
          const ext = path.split('.').pop()?.toLowerCase() || 'jpg'
          photos.push({
            filename: `job-photo-${i + 1}.${ext}`,
            content: buf,
            signedUrl: urlData.signedUrl,
          })
        } catch {
          // Non-fatal — skip this photo if download fails
        }
      }
    }

    // ── Line items HTML ───────────────────────────────────────────────────────
    function sanitizeText(text: string): string {
      return text.replace(/\//g, ' ').replace(/\s{2,}/g, ' ').trim()
    }

    const isLumpSum = !!(quote as Record<string, unknown>).lump_sum
    const lineItemsHtml = lineItems
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map(li => {
        if (li.item_type === 'section') {
          return `
            <tr>
              <td colspan="2" style="padding:10px 8px 6px;background:#f3f4f6;font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb;">
                ${sanitizeText(li.description as string)}
              </td>
            </tr>
          `
        }
        if (isLumpSum) {
          return `
            <tr>
              <td colspan="2" style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
                <div style="font-size:14px;color:#111827;">${sanitizeText(li.description as string)}</div>
              </td>
            </tr>
          `
        }
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
              <div style="font-size:14px;color:#111827;">${sanitizeText(li.description as string)}</div>
              ${li.pricing_type !== 'fixed' ? `<div style="font-size:12px;color:#666;">${li.quantity} ${getUnitLabel(li.pricing_type as 'sqft' | 'hourly')} × ${formatCurrency(li.unit_price as number)}</div>` : ''}
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:14px;font-weight:600;color:#111827;">
              ${formatCurrency(li.total as number)}
            </td>
          </tr>
        `
      }).join('')

    // ── Photo thumbnail grid (signed URLs — viewable in email clients) ────────
    const photosHtml = photos.length > 0 ? `
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;">
        <p style="font-size:11px;font-weight:700;color:#666;letter-spacing:0.08em;margin:0 0 12px;text-transform:uppercase;">
          Job Photos (${photos.length})
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            ${photos.map(p => `
              <td style="padding:0 6px 0 0;vertical-align:top;">
                <img src="${p.signedUrl}"
                     width="160" height="120"
                     style="display:block;width:160px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;"
                     alt="Job photo" />
              </td>
            `).join('')}
          </tr>
        </table>
      </div>
    ` : ''

    // ── Full email HTML ───────────────────────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#fff;padding:24px 24px 16px;text-align:center;">
      ${contractor.logo_url ? `<img src="${contractor.logo_url}" alt="${contractor.business_name}" height="64" style="max-height:64px;max-width:200px;object-fit:contain;display:inline-block;margin-bottom:12px;" />` : ''}
      <h1 style="color:#1a1a1a;margin:0 0 6px;font-size:20px;font-weight:700;">${contractor.business_name}</h1>
      <p style="color:#444;margin:0 0 2px;font-size:13px;">${contractor.phone} · ${contractor.email}</p>
      ${contractor.license_number ? `<p style="color:#444;margin:0 0 2px;font-size:12px;">License #${contractor.license_number}</p>` : ''}
      ${contractor.insurance_number ? `<p style="color:#444;margin:0 0 0;font-size:12px;">Insurance #${contractor.insurance_number}</p>` : ''}
    </div>
    <div style="height:4px;background:${contractor.brand_color || '#0E6E7E'};"></div>
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Hi ${client.name},</p>
      <p style="color:#555;font-size:14px;line-height:1.6;">Thank you for the opportunity. Please find your project quote below.</p>

      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;">
        <div style="font-size:12px;color:#666;margin-bottom:4px;">QUOTE ${quote.quote_number}</div>
        <div style="font-size:13px;color:#374151;">${client.address}, ${client.city}, ${client.state} ${client.zip}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;">${lineItemsHtml}</table>

      <table style="width:100%;border-collapse:collapse;border-top:2px solid #111827;margin-top:16px;">
        ${!isLumpSum && quote.tax_rate > 0 ? `
        <tr>
          <td style="padding:8px 0 4px;font-size:14px;color:#555;">Subtotal</td>
          <td style="padding:8px 0 4px;font-size:14px;color:#555;text-align:right;">${formatCurrency(quote.subtotal)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#555;">Tax (${(quote.tax_rate * 100).toFixed(1)}%)</td>
          <td style="padding:4px 0;font-size:14px;color:#555;text-align:right;">${formatCurrency(quote.tax_amount)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 0 4px;font-size:18px;font-weight:700;color:#111827;">Total</td>
          <td style="padding:12px 0 4px;font-size:18px;font-weight:700;color:#111827;text-align:right;">${formatCurrency(quote.total)}</td>
        </tr>
      </table>

      ${quote.payment_terms ? `<p style="font-size:13px;color:#555;margin-top:20px;padding-top:16px;border-top:1px solid #f3f4f6;">${quote.payment_terms}</p>` : ''}
      ${quote.caveats ? `<p style="font-size:13px;color:#555;">${quote.caveats}</p>` : ''}

      ${photosHtml}

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:13px;color:#666;">
        <p style="margin:0;">${contractor.business_name}</p>
        <p style="margin:4px 0 0;">${contractor.phone} · ${contractor.email}</p>
      </div>
    </div>
  </div>
</body>
</html>`

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
      replyTo: contractor.email,
      to: client.email,
      subject: `Your quote from ${contractor.business_name} — ${formatCurrency(quote.total)}`,
      html,
      attachments: photos.map(p => ({
        filename: p.filename,
        content: p.content,
      })),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
