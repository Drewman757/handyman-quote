import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { formatCurrency, getUnitLabel } from '@/lib/utils/pricing'

const resend = new Resend(process.env.RESEND_API_KEY)

function readLineageLogo(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', 'lineage-labs-logo.jpg'))
  } catch {
    return null
  }
}
const lineageLogoBuf = readLineageLogo()
const LINEAGE_LOGO_CID = 'lineage-labs-logo@ll'

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

    const quoteDate = new Date(quote.created_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const isLumpSum = !!(quote as Record<string, unknown>).lump_sum
    const colSpan = isLumpSum ? 1 : 4
    const lineItemsHtml = lineItems
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map(li => {
        if (li.item_type === 'section') {
          return `
            <tr>
              <td colspan="${colSpan}" style="padding:7px 8px;background:#f3f4f6;font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb;">
                ${sanitizeText(li.description as string)}
              </td>
            </tr>
          `
        }
        if (isLumpSum) {
          return `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">
                ${sanitizeText(li.description as string)}
              </td>
            </tr>
          `
        }
        return `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">
              ${sanitizeText(li.description as string)}
              ${li.pricing_type !== 'fixed' ? `<div style="font-size:11px;color:#666;margin-top:2px;">${li.quantity} ${getUnitLabel(li.pricing_type as 'sqft' | 'hourly')} @ ${formatCurrency(li.unit_price as number)}</div>` : ''}
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;font-size:13px;color:#374151;width:44px;">
              ${li.pricing_type !== 'fixed' ? String(li.quantity) : '—'}
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;color:#374151;width:80px;">
              ${formatCurrency(li.unit_price as number)}
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;font-weight:700;color:#111827;width:80px;">
              ${formatCurrency(li.total as number)}
            </td>
          </tr>
        `
      }).join('')

    const tableHeaderHtml = isLumpSum ? '' : `
      <tr>
        <td style="padding-bottom:6px;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #111827;">Description</td>
        <td style="padding-bottom:6px;font-size:10px;font-weight:700;color:#555;text-align:center;width:44px;border-bottom:2px solid #111827;">Qty</td>
        <td style="padding-bottom:6px;font-size:10px;font-weight:700;color:#555;text-align:right;width:80px;border-bottom:2px solid #111827;">Unit Price</td>
        <td style="padding-bottom:6px;font-size:10px;font-weight:700;color:#555;text-align:right;width:80px;border-bottom:2px solid #111827;">Amount</td>
      </tr>
    `

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
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;table-layout:fixed;">
        <tr>
          <td width="38%" style="vertical-align:top;padding-right:12px;word-wrap:break-word;overflow-wrap:break-word;">
            <div style="font-size:10px;font-weight:700;color:#666;letter-spacing:0.08em;margin-bottom:5px;text-transform:uppercase;">Prepared For</div>
            <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:2px;">${client.name}</div>
            <div style="font-size:11px;color:#4b5563;line-height:1.5;">${client.address}<br>${client.city}, ${client.state} ${client.zip}<br>${client.phone}<br>${client.email}</div>
          </td>
          <td width="32%" style="vertical-align:top;padding-right:12px;word-wrap:break-word;overflow-wrap:break-word;">
            <div style="font-size:10px;font-weight:700;color:#666;letter-spacing:0.08em;margin-bottom:5px;text-transform:uppercase;">From</div>
            <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:2px;">${contractor.business_name}</div>
            <div style="font-size:11px;color:#4b5563;line-height:1.5;">${contractor.owner_name ? contractor.owner_name + '<br>' : ''}${contractor.address ? contractor.address + '<br>' : ''}${contractor.phone}<br>${contractor.email}${contractor.website ? '<br>' + contractor.website : ''}</div>
          </td>
          <td width="30%" style="vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;">
            <div style="font-size:10px;font-weight:700;color:#666;letter-spacing:0.08em;margin-bottom:5px;text-transform:uppercase;">Quote</div>
            <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:2px;">${quote.quote_number}</div>
            <div style="font-size:11px;color:#4b5563;">${quoteDate}</div>
          </td>
        </tr>
      </table>

      <div style="height:1px;background:#e5e7eb;margin-bottom:16px;"></div>

      <table style="width:100%;border-collapse:collapse;">${tableHeaderHtml}${lineItemsHtml}</table>

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
          <td style="padding:12px 0 4px;font-size:18px;font-weight:700;color:#111827;">
            Total
            ${quote.is_paid ? `<span style="margin-left:8px;display:inline-block;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#15803d;background:#dcfce7;border-radius:9999px;vertical-align:middle;">Paid</span>` : ''}
          </td>
          <td style="padding:12px 0 4px;font-size:18px;font-weight:700;color:#111827;text-align:right;">${formatCurrency(quote.total)}</td>
        </tr>
      </table>

      ${quote.payment_terms || quote.caveats || quote.financing_options ? `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;">${quote.payment_terms ? `<div style="font-size:10px;font-weight:700;color:#666;letter-spacing:0.08em;margin-bottom:5px;text-transform:uppercase;">Payment Terms</div><p style="font-size:11px;color:#555;margin:0 0 12px;line-height:1.5;">${quote.payment_terms}</p>` : ''}${quote.caveats ? `<div style="font-size:10px;font-weight:700;color:#666;letter-spacing:0.08em;margin-bottom:5px;text-transform:uppercase;">Notes</div><p style="font-size:11px;color:#555;margin:0 0 12px;line-height:1.5;">${quote.caveats}</p>` : ''}${quote.financing_options ? `<div style="font-size:10px;font-weight:700;color:#666;letter-spacing:0.08em;margin-bottom:5px;text-transform:uppercase;">Financing Options</div><p style="font-size:11px;color:#555;margin:0;line-height:1.5;">${quote.financing_options}</p>` : ''}</div>` : ''}

      ${photosHtml}

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:13px;color:#666;">
        <p style="margin:0;">${contractor.business_name}</p>
        <p style="margin:4px 0 0;">${contractor.phone} · ${contractor.email}</p>
      </div>

      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:16px;padding-top:16px;border-top:1px solid #f3f4f6;">
        <tr>
          <td style="text-align:center;vertical-align:middle;">
            ${lineageLogoBuf ? `<img src="cid:${LINEAGE_LOGO_CID}" width="20" height="20" style="display:inline-block;vertical-align:middle;margin-right:6px;" alt="" />` : ''}
            <span style="font-size:11px;color:#888;vertical-align:middle;">Quote generation powered by Lineage Labs LLC</span>
          </td>
        </tr>
      </table>
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
      attachments: [
        ...photos.map(p => ({ filename: p.filename, content: p.content })),
        ...(lineageLogoBuf ? [{ filename: 'lineage-labs-logo.jpg', content: lineageLogoBuf, contentId: LINEAGE_LOGO_CID }] : []),
      ],
    })

    // Admin-facing notification only — separate from the client email above, and must
    // never block the actual quote send if it fails.
    try {
      const sentAt = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://handyman-quote.vercel.app'
      const quoteUrl = `${siteUrl}/quotes/${quote.id}`
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
        to: 'Lineagelabsllc@gmail.com',
        subject: `Quote sent — ${contractor.business_name}`,
        // /quotes/[id] is RLS-scoped to the signed-in contractor's own quotes, so this
        // link only resolves when logged in as that contractor — not viewable from the
        // admin's own session. Noted inline rather than building admin-bypass access
        // control for it.
        html: `<p>${contractor.business_name} sent a quote to ${client.name} for ${formatCurrency(quote.total)} on ${sentAt}.<br>
<a href="${quoteUrl}">View quote</a> (link only works when logged in as the contractor).</p>`,
      })
    } catch (notifyErr) {
      console.error('[email] admin quote-sent notification failed', notifyErr)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
