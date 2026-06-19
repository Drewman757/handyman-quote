import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

const PRICE_ID = 'price_1TjKIbRoAcnGybj8sppwW935'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://handyman-quote.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const { name, company, email, password, phone, description, agreedToTermsAt } = await req.json()

    if (!name || !company || !email || !password || !phone || !description) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      customer_email: email,
      metadata: { name, company, phone, description, password, agreed_to_terms_at: agreedToTermsAt || '' },
      subscription_data: {
        metadata: { name, company, phone, description, password, agreed_to_terms_at: agreedToTermsAt || '' },
      },
      success_url: `${APP_URL}/request-access/success`,
      cancel_url: `${APP_URL}/request-access`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[POST /api/stripe/checkout]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
