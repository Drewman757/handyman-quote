import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { formatCurrency } from '@/lib/utils/pricing'

const resend = new Resend(process.env.RESEND_API_KEY)

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
)

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: contractor } = await adminSupabase
      .from('contractors')
      .select('id, business_name, owner_name, phone, email, logo_url')
      .eq('user_id', user.id)
      .single()
    if (!contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

    const { data: quote } = await adminSupabase
      .from('quotes')
      .select('*, client:clients(*)')
      .eq('id', id)
      .eq('contractor_id', contractor.id)
      .single()
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const client = quote.client as Record<string, string>
    const logoUrl = (contractor as Record<string, unknown>).logo_url as string | null

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    ${logoUrl ? `<div style="text-align:center;padding:16px 0 8px;"><img src="${logoUrl}" style="max-height:64px;max-width:200px;object-fit:contain;" /></div>` : ''}
    <div style="background:#f97316;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">${contractor.business_name}</h1>
      <p style="color:#fed7aa;margin:4px 0 0;font-size:14px;">Quote Follow-Up</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Hi ${client.name},</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        I wanted to follow up on quote <strong>${quote.quote_number}</strong> for <strong>${formatCurrency(quote.total)}</strong>.
        I'm happy to answer any questions, walk through the details, or adjust the scope if needed.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        Just reply to this email or give me a call — I'd love to move forward when you're ready.
      </p>
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:13px;color:#9ca3af;">
        <p style="margin:0;font-weight:600;color:#374151;">${contractor.business_name}</p>
        ${contractor.owner_name ? `<p style="margin:4px 0 0;color:#6b7280;">${contractor.owner_name}</p>` : ''}
        <p style="margin:4px 0 0;">${contractor.phone} · ${contractor.email}</p>
      </div>
    </div>
  </div>
</body>
</html>`

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
      to: client.email,
      subject: `Following up on your quote from ${contractor.business_name}`,
      html,
    })

    await adminSupabase
      .from('quotes')
      .update({ follow_up_sent_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[followup]', err)
    return NextResponse.json({ error: 'Failed to send follow-up' }, { status: 500 })
  }
}
