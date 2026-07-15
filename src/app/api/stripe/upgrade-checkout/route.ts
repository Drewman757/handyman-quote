import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

// Same price used by the original signup flow (src/app/api/stripe/checkout/route.ts) —
// confirmed with the user to be the $50/mo tier, reused here for upgrades.
const PRICE_ID = 'price_1TjKIbRoAcnGybj8sppwW935'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://handyman-quote.vercel.app'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set('redirect', '/trial-expired')
      return NextResponse.redirect(loginUrl)
    }

    const admin = getAdmin()
    const { data: contractor } = await admin
      .from('contractors')
      .select('id, email, subscription_status, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!contractor) {
      return NextResponse.json({ error: 'No contractor account found' }, { status: 404 })
    }

    // Already upgraded — nothing to do, send them back into the app.
    if (contractor.subscription_status === 'active' && contractor.stripe_subscription_id) {
      return NextResponse.redirect(new URL('/dashboard', APP_URL))
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      customer_email: contractor.email,
      client_reference_id: contractor.id,
      metadata: { contractor_id: contractor.id },
      subscription_data: {
        metadata: { contractor_id: contractor.id },
      },
      success_url: `${APP_URL}/dashboard?upgraded=1`,
      cancel_url: `${APP_URL}/trial-expired`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.redirect(session.url, { status: 303 })
  } catch (err) {
    console.error('[GET /api/stripe/upgrade-checkout]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
