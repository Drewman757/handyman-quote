import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const protectedPaths = ['/dashboard', '/clients', '/quotes', '/analytics', '/settings', '/pricing-templates']
  const isProtectedPage = protectedPaths.some((p) => pathname.startsWith(p))
  const isApiPath = pathname.startsWith('/api/')

  if (!user && isProtectedPage) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Suspension + trial lockout share one query/lookup, but are independent checks —
  // suspension is an account-level hold and takes priority regardless of trial status.
  if (
    user &&
    pathname !== '/trial-expired' &&
    pathname !== '/account-suspended' &&
    (isProtectedPage || isApiPath)
  ) {
    const { data: contractor } = await supabase
      .from('contractors')
      .select('subscription_status, trial_ends_at, stripe_subscription_id, is_suspended')
      .eq('user_id', user.id)
      .maybeSingle()

    if (contractor?.is_suspended) {
      if (isApiPath) {
        return NextResponse.json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' }, { status: 403 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/account-suspended'
      return NextResponse.redirect(url)
    }

    // Trial lockout for comp/beta accounts only — paying customers and
    // contractors who came through the original Stripe signup flow have
    // subscription_status null/'active' and are unaffected.
    const isTrialAccount = contractor?.subscription_status === 'comp' || contractor?.subscription_status === 'beta'
    const trialExpired = !!contractor?.trial_ends_at && new Date(contractor.trial_ends_at) < new Date()
    const hasUpgraded = !!contractor?.stripe_subscription_id
    const locked = isTrialAccount && trialExpired && !hasUpgraded

    if (locked) {
      if (isApiPath) {
        return NextResponse.json({ error: 'Trial expired', code: 'TRIAL_EXPIRED' }, { status: 402 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/trial-expired'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe|api/cron|api/admin|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
