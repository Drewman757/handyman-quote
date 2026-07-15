import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { differenceInCalendarDays } from 'date-fns'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
// CRON_SECRET is set as a project env var — no extra vercel.json config needed.
function isAuthorized(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return true
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getAdmin()
    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data: contractors, error } = await admin
      .from('contractors')
      .select('id, email, owner_name, business_name, trial_ends_at')
      .in('subscription_status', ['comp', 'beta'])
      .is('trial_warning_sent_at', null)
      .not('trial_ends_at', 'is', null)
      .gt('trial_ends_at', now.toISOString())
      .lte('trial_ends_at', in7Days.toISOString())

    if (error) {
      console.error('[cron/trial-warnings] query failed', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://handyman-quote.vercel.app'
    const upgradeUrl = `${siteUrl}/api/stripe/upgrade-checkout`

    let sent = 0
    for (const contractor of contractors ?? []) {
      const trialEndsAt = new Date(contractor.trial_ends_at as string)
      const daysLeft = Math.max(0, differenceInCalendarDays(trialEndsAt, now))
      const endDateStr = trialEndsAt.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })

      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
          to: contractor.email,
          subject: `Your QuoteBuilder trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          html: `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#f97316;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">QuoteBuilder</h1>
      <p style="color:#fed7aa;margin:4px 0 0;font-size:14px;">Your trial is ending soon</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Hi ${contractor.owner_name || contractor.business_name},</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        Your QuoteBuilder trial ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>, on <strong>${endDateStr}</strong>.
        After that, you won&rsquo;t be able to sign in until you upgrade.
      </p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        Don&rsquo;t worry &mdash; all of your quotes, clients, and pricing templates are safe and will be exactly as you
        left them the moment you upgrade.
      </p>
      <div style="margin:28px 0;text-align:center;">
        <a href="${upgradeUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
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

        await admin
          .from('contractors')
          .update({ trial_warning_sent_at: now.toISOString() })
          .eq('id', contractor.id)

        sent++
      } catch (sendErr) {
        console.error('[cron/trial-warnings] failed to send for', contractor.id, sendErr)
      }
    }

    return NextResponse.json({ checked: contractors?.length ?? 0, sent })
  } catch (err) {
    console.error('[GET /api/cron/trial-warnings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
