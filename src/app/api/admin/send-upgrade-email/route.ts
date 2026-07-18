import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing env vars')
  return createAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = getAdmin()

    const { data: caller } = await admin
      .from('contractors')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()
    if (!caller?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { contractorId } = await req.json() as { contractorId: string }
    if (!contractorId) return NextResponse.json({ error: 'Missing contractorId' }, { status: 400 })

    const { data: contractor, error: lookupErr } = await admin
      .from('contractors')
      .select('email, owner_name, business_name')
      .eq('id', contractorId)
      .single()
    if (lookupErr || !contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://handyman-quote.vercel.app'
    // Same link the trial-warning cron email uses — /api/stripe/upgrade-checkout builds the
    // actual Stripe session on click (looked up from the signed-in user), so there's no need
    // to pre-create a session here. Works regardless of trial/suspension state since that
    // route isn't gated by middleware (api/stripe is excluded from its matcher).
    const upgradeUrl = `${siteUrl}/api/stripe/upgrade-checkout`

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
        to: contractor.email,
        subject: 'Your QuoteBuilder account is ready to reactivate',
        html: `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0E6E7E;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">QuoteBuilder</h1>
      <p style="color:#b3dde2;margin:4px 0 0;font-size:14px;">Your account is ready to reactivate</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Hi ${contractor.owner_name || contractor.business_name},</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        Ready to keep going with QuoteBuilder? Click below to upgrade and get back into your account.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        Don&rsquo;t worry &mdash; all of your quotes, clients, and pricing templates are safe and will be exactly as you
        left them the moment you upgrade.
      </p>
      <div style="margin:28px 0;text-align:center;">
        <a href="${upgradeUrl}" style="display:inline-block;background:#0E6E7E;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Upgrade now — $50/month
        </a>
      </div>
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:13px;color:#9ca3af;">
        <p style="margin:0;">QuoteBuilder &mdash; Professional quotes for handyman services</p>
      </div>
    </div>
  </div>
</body>
</html>`,
      })
    } catch (emailErr) {
      console.error('[admin/send-upgrade-email] send failed', emailErr)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/admin/send-upgrade-email]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
