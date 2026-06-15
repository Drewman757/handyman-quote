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

    // Fetch quotes to clean up storage + line_items
    const { data: quotes } = await admin
      .from('quotes')
      .select('id, photo_urls')
      .eq('contractor_id', contractorId)

    // Remove photo files from storage
    for (const q of quotes ?? []) {
      const paths = (q.photo_urls as string[] | null) ?? []
      if (paths.length) {
        await admin.storage.from('quote-photos').remove(paths)
      }
    }

    // Delete line_items first (FK dependency on quotes)
    const quoteIds = (quotes ?? []).map(q => q.id as string)
    if (quoteIds.length) {
      await admin.from('line_items').delete().in('quote_id', quoteIds)
    }

    // Cascade delete in dependency order
    await admin.from('quotes').delete().eq('contractor_id', contractorId)
    await admin.from('clients').delete().eq('contractor_id', contractorId)
    await admin.from('pricing_templates').delete().eq('contractor_id', contractorId)
    await admin.from('contractors').delete().eq('id', contractorId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/admin/delete]', err)
    return NextResponse.json({ error: 'Failed to delete contractor' }, { status: 500 })
  }
}
