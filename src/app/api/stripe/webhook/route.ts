import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})
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

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}

    // Upgrade path: a comp/beta contractor converting to paid via
    // /api/stripe/upgrade-checkout carries contractor_id in metadata (and
    // client_reference_id). Update their existing row in place and stop —
    // never fall through to the new-signup/pending_signups logic below.
    const upgradeContractorId = meta.contractor_id || session.client_reference_id || ''
    if (upgradeContractorId) {
      const admin = getAdmin()
      const stripeSubscriptionId =
        typeof session.subscription === 'string' ? session.subscription : ''

      // A successful payment always restores access, regardless of any prior suspension.
      const { data: updatedContractor, error: upgradeErr } = await admin
        .from('contractors')
        .update({
          subscription_status: 'active',
          stripe_subscription_id: stripeSubscriptionId,
          is_suspended: false,
        })
        .eq('id', upgradeContractorId)
        .select('business_name, email')
        .single()

      if (upgradeErr) {
        console.error('[webhook] upgrade update failed', upgradeErr)
      } else {
        // Admin-facing notification only — separate from anything the contractor sees.
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
            to: 'Lineagelabsllc@gmail.com',
            subject: `QuoteBuilder upgrade — ${updatedContractor.business_name}`,
            html: `<p>${updatedContractor.business_name} (${updatedContractor.email}) just upgraded to a paid QuoteBuilder subscription — their account is now active.</p>`,
          })
        } catch (notifyErr) {
          console.error('[webhook] admin upgrade notification failed', notifyErr)
        }
      }

      return NextResponse.json({ received: true })
    }

    const name = meta.name || ''
    const company = meta.company || ''
    const email = session.customer_email || ''
    const password = meta.password || ''
    const phone = meta.phone || ''
    const description = meta.description || ''
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : ''
    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : ''

    const admin = getAdmin()

    const agreedToTermsAt = meta.agreed_to_terms_at || null

    const { error: insertErr } = await admin.from('pending_signups').insert({
      name,
      company,
      email,
      password,
      phone,
      description,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      agreed_to_terms_at: agreedToTermsAt,
    })

    if (insertErr) {
      console.error('[webhook] insert pending_signup failed', insertErr)
    }

    const token = makeApprovalToken(email)
    const approveUrl = `https://handyman-quote.vercel.app/api/stripe/approve?email=${encodeURIComponent(email)}&token=${token}`

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'quotes@resend.dev',
      to: 'Lineagelabsllc@gmail.com',
      subject: `New QuoteBuilder signup — ${company}`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#f97316;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">New QuoteBuilder Signup</h1>
      <p style="color:#fed7aa;margin:4px 0 0;font-size:14px;">Payment received — ready to approve</p>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;width:120px;">Name</td><td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;">${name}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;">Company</td><td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;">${company}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;">Email</td><td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;">${email}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;">Phone</td><td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;">${phone}</td></tr>
      </table>
      <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;">
        <p style="font-size:12px;font-weight:700;color:#9ca3af;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.08em;">About their business</p>
        <p style="font-size:14px;color:#374151;margin:0;">${description}</p>
      </div>
      <div style="margin-top:24px;text-align:center;">
        <a href="${approveUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Approve &amp; Create Account
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin-top:16px;text-align:center;">
        Clicking will create their Supabase account and send them a welcome email.
      </p>
    </div>
  </div>
</body>
</html>`,
    })
  }

  return NextResponse.json({ received: true })
}
