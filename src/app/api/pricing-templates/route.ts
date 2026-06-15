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

    const { templates } = await req.json() as {
      templates: { name: string; category: string; pricing_type: string; unit_price?: number }[]
    }
    if (!Array.isArray(templates) || !templates.length) {
      return NextResponse.json({ error: 'No templates provided' }, { status: 400 })
    }

    const admin = getAdmin()
    const { data: contractor } = await admin
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

    const rows = templates.map(t => ({
      contractor_id: contractor.id,
      name: t.name,
      category: t.category || 'General',
      pricing_type: t.pricing_type || 'fixed',
      unit_price: t.unit_price ?? 0,
    }))

    const { error } = await admin.from('pricing_templates').insert(rows)
    if (error) throw error

    return NextResponse.json({ success: true, count: rows.length })
  } catch (err) {
    console.error('[POST /api/pricing-templates]', err)
    return NextResponse.json({ error: 'Failed to save templates' }, { status: 500 })
  }
}
