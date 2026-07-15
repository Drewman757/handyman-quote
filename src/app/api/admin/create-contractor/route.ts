import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { addMonths } from 'date-fns'
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

    const { email, businessName, ownerName, subscriptionStatus } = await req.json() as {
      email: string
      businessName: string
      ownerName: string
      subscriptionStatus: string
    }

    if (!email || !businessName || !ownerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // No password — the contractor sets their own via the invite link emailed below.
    const { data: userData, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (createErr || !userData?.user) {
      console.error('[admin/create-contractor] createUser error', createErr)
      return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })
    }

    const status = subscriptionStatus || 'comp'
    const isTrialStatus = status === 'comp' || status === 'beta'
    const trialEndsAt = isTrialStatus ? addMonths(new Date(), 2) : null

    const { error: contractorErr } = await admin.from('contractors').insert({
      user_id: userData.user.id,
      business_name: businessName,
      owner_name: ownerName,
      phone: '',
      email,
      agreed_to_terms_at: null,
      subscription_status: status,
      trial_ends_at: trialEndsAt ? trialEndsAt.toISOString() : null,
    })

    if (contractorErr) {
      console.error('[admin/create-contractor] insert contractor failed', contractorErr)
      // Roll back the auth user so we don't leave an orphaned login with no contractor row.
      await admin.auth.admin.deleteUser(userData.user.id)
      return NextResponse.json({ error: 'Failed to create contractor: ' + contractorErr.message }, { status: 500 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://handyman-quote.vercel.app'
    const trialEndsLabel = trialEndsAt?.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })

    // Recovery link reuses the existing forgot-password flow (auth/confirm -> update-password),
    // which already listens for the PASSWORD_RECOVERY auth event and lets the user set a password.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${siteUrl}/auth/confirm?next=/update-password` },
    })
    const inviteLink = linkData?.properties?.action_link

    let warning: string | undefined
    if (linkErr || !inviteLink) {
      console.error('[admin/create-contractor] generateLink failed', linkErr)
      warning = 'Account created, but generating the invite link failed — send a password reset from the Supabase dashboard manually.'
    } else {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
          to: email,
          subject: 'Welcome to QuoteBuilder — your account is ready',
          html: `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0E6E7E;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">QuoteBuilder</h1>
      <p style="color:#b3dde2;margin:4px 0 0;font-size:14px;">Your account is ready!</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Hi ${ownerName},</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        Welcome to QuoteBuilder! An account has been set up for ${businessName}. Click below to set your password
        and get started.
      </p>
      <div style="margin:28px 0;text-align:center;">
        <a href="${inviteLink}" style="display:inline-block;background:#0E6E7E;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Set up your account
        </a>
      </div>
      ${trialEndsLabel ? `
      <p style="color:#6b7280;font-size:13px;line-height:1.6;">
        You're on a 2-month beta trial that runs through <strong>${trialEndsLabel}</strong> — completely free, no card
        required. If you're finding it useful, you're welcome to continue afterward for $50/month, but there's no
        pressure either way.
      </p>` : ''}
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:13px;color:#9ca3af;">
        <p style="margin:0;">QuoteBuilder &mdash; Professional quotes for handyman services</p>
      </div>
    </div>
  </div>
</body>
</html>`,
        })
      } catch (emailErr) {
        console.error('[admin/create-contractor] invite email failed', emailErr)
        warning = 'Account created, but the invite email failed to send — share this link with the contractor manually.'
      }
    }

    return NextResponse.json({
      success: true,
      email,
      warning,
      // Only needed by the UI as a copyable fallback when the email above didn't go out.
      inviteLink: warning ? inviteLink : undefined,
    })
  } catch (err) {
    console.error('[POST /api/admin/create-contractor]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
