import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

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

    const { contractorId, suspend } = await req.json() as { contractorId: string; suspend: boolean }
    if (!contractorId) return NextResponse.json({ error: 'Missing contractorId' }, { status: 400 })

    const { error } = await admin
      .from('contractors')
      .update({ is_suspended: suspend })
      .eq('id', contractorId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/admin/suspend]', err)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
