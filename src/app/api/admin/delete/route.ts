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

    const { contractorId } = await req.json() as { contractorId: string }
    if (!contractorId) return NextResponse.json({ error: 'Missing contractorId' }, { status: 400 })

    // Look up the Auth user tied to this contractor before deleting anything.
    const { data: contractor, error: lookupErr } = await admin
      .from('contractors')
      .select('user_id')
      .eq('id', contractorId)
      .single()
    if (lookupErr || !contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    // Fetch quotes up front (for storage cleanup) — the Auth user delete below cascades
    // and removes these rows from the DB, so we need photo paths captured first.
    const { data: quotes } = await admin
      .from('quotes')
      .select('id, photo_urls')
      .eq('contractor_id', contractorId)

    // contractors.user_id -> auth.users(id) is ON DELETE CASCADE, and clients/
    // pricing_templates/quotes/line_items all cascade transitively from contractors.
    // So deleting the Auth user first is the safer order: if this call fails, nothing
    // else has been touched and no orphaned Auth user is left behind (the original bug).
    // On success, the DB cascade removes the contractor and all of its dependent rows.
    const { error: authDeleteErr } = await admin.auth.admin.deleteUser(contractor.user_id)
    if (authDeleteErr) {
      console.error('[admin/delete] auth deleteUser failed', authDeleteErr)
      return NextResponse.json({ error: 'Failed to delete auth user: ' + authDeleteErr.message }, { status: 500 })
    }

    // Remove photo files from storage — not covered by the DB cascade.
    for (const q of quotes ?? []) {
      const paths = (q.photo_urls as string[] | null) ?? []
      if (paths.length) {
        await admin.storage.from('quote-photos').remove(paths)
      }
    }

    // Defensive cleanup in case the cascade above didn't apply (e.g. schema drift) —
    // these are no-ops if the Auth user delete already cascaded the rows away.
    const quoteIds = (quotes ?? []).map(q => q.id as string)
    if (quoteIds.length) {
      await admin.from('line_items').delete().in('quote_id', quoteIds)
    }
    await admin.from('quotes').delete().eq('contractor_id', contractorId)
    await admin.from('clients').delete().eq('contractor_id', contractorId)
    await admin.from('pricing_templates').delete().eq('contractor_id', contractorId)
    const { error: contractorDeleteErr } = await admin.from('contractors').delete().eq('id', contractorId)
    if (contractorDeleteErr) {
      console.error('[admin/delete] contractors row cleanup failed', contractorDeleteErr)
      return NextResponse.json(
        { error: 'Auth user deleted but failed to remove contractor row: ' + contractorDeleteErr.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/admin/delete]', err)
    return NextResponse.json({ error: 'Failed to delete contractor' }, { status: 500 })
  }
}
