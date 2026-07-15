import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { addMonths } from 'date-fns'

export const dynamic = 'force-dynamic'

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

    const { email, businessName, ownerName, tempPassword, subscriptionStatus } = await req.json() as {
      email: string
      businessName: string
      ownerName: string
      tempPassword: string
      subscriptionStatus: string
    }

    if (!email || !businessName || !ownerName || !tempPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (tempPassword.length < 6) {
      return NextResponse.json({ error: 'Temp password must be at least 6 characters' }, { status: 400 })
    }

    const { data: userData, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (createErr || !userData?.user) {
      console.error('[admin/create-contractor] createUser error', createErr)
      return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })
    }

    const status = subscriptionStatus || 'comp'
    const isTrialStatus = status === 'comp' || status === 'beta'

    const { error: contractorErr } = await admin.from('contractors').insert({
      user_id: userData.user.id,
      business_name: businessName,
      owner_name: ownerName,
      phone: '',
      email,
      agreed_to_terms_at: null,
      subscription_status: status,
      trial_ends_at: isTrialStatus ? addMonths(new Date(), 2).toISOString() : null,
    })

    if (contractorErr) {
      console.error('[admin/create-contractor] insert contractor failed', contractorErr)
      // Roll back the auth user so we don't leave an orphaned login with no contractor row.
      await admin.auth.admin.deleteUser(userData.user.id)
      return NextResponse.json({ error: 'Failed to create contractor: ' + contractorErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, email, tempPassword })
  } catch (err) {
    console.error('[POST /api/admin/create-contractor]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
