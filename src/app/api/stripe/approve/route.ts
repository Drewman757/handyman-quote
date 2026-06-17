import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createHmac } from 'crypto'

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

function makeApprovalToken(email: string): string {
  return createHmac('sha256', process.env.STRIPE_SECRET_KEY!).update(email).digest('hex')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email') || ''
    const token = searchParams.get('token') || ''

    if (!email || !token) {
      return new NextResponse('Missing email or token', { status: 400 })
    }

    const expected = makeApprovalToken(email)
    if (token !== expected) {
      return new NextResponse('Invalid token', { status: 403 })
    }

    const admin = getAdmin()

    const { data: signup } = await admin
      .from('pending_signups')
      .select('*')
      .eq('email', email)
      .single()

    if (!signup) {
      return new NextResponse('Signup not found', { status: 404 })
    }

    if (signup.approved) {
      return new NextResponse(successHtml(email, 'Account was already approved.'), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (createErr && !createErr.message.toLowerCase().includes('already been registered')) {
      console.error('[approve] createUser error', createErr)
      return new NextResponse('Failed to create user: ' + createErr.message, { status: 500 })
    }

    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: 'https://handyman-quote.vercel.app/dashboard' },
    })

    const loginLink =
      linkData?.properties?.action_link || 'https://handyman-quote.vercel.app/login'

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
      to: email,
      subject: 'Welcome to QuoteBuilder — your account is ready',
      html: `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#f97316;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">QuoteBuilder</h1>
      <p style="color:#fed7aa;margin:4px 0 0;font-size:14px;">Your account is ready!</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Hi ${signup.name},</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;">
        Your QuoteBuilder account has been approved. Click the button below to sign in and start creating professional quotes for your clients.
      </p>
      <div style="margin:28px 0;text-align:center;">
        <a href="${loginLink}" style="display:inline-block;background:#f97316;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Sign in to QuoteBuilder
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
        This link expires in 24 hours. If it no longer works, visit
        <a href="https://handyman-quote.vercel.app/login" style="color:#f97316;">handyman-quote.vercel.app/login</a>
        and use &ldquo;Forgot password&rdquo; to set your password.
      </p>
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;font-size:13px;color:#9ca3af;">
        <p style="margin:0;">QuoteBuilder &mdash; Professional quotes for handyman services</p>
      </div>
    </div>
  </div>
</body>
</html>`,
    })

    await admin.from('pending_signups').update({ approved: true }).eq('email', email)

    return new NextResponse(successHtml(email, `Welcome email sent to ${email}.`), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (err) {
    console.error('[GET /api/stripe/approve]', err)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

function successHtml(email: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:40px;box-sizing:border-box;">
  <div style="text-align:center;max-width:400px;">
    <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:32px;">&#10003;</div>
    <h1 style="color:#111827;font-size:22px;margin:0 0 8px;">Account approved!</h1>
    <p style="color:#6b7280;font-size:15px;margin:0;">${message}</p>
    <p style="color:#9ca3af;font-size:13px;margin-top:8px;">${email}</p>
  </div>
</body>
</html>`
}
