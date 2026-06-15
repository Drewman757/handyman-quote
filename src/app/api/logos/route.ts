import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('logo') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Logo must be 2 MB or smaller' }, { status: 400 })
    }

    const storagePath = `${user.id}/logo`
    const bytes = await file.arrayBuffer()

    const { error: uploadErr } = await adminSupabase.storage
      .from('contractor-logos')
      .upload(storagePath, bytes, { contentType: file.type, upsert: true })

    if (uploadErr) throw uploadErr

    const { data: { publicUrl } } = adminSupabase.storage
      .from('contractor-logos')
      .getPublicUrl(storagePath)

    const { data: contractor, error: lookupErr } = await adminSupabase
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (lookupErr || !contractor) {
      console.error('[POST /api/logos] contractor lookup failed', lookupErr)
      return NextResponse.json({ error: 'Contractor record not found' }, { status: 404 })
    }

    const { error: updateErr } = await adminSupabase
      .from('contractors')
      .update({ logo_url: publicUrl })
      .eq('id', contractor.id)
      .select('id')

    if (updateErr) {
      console.error('[POST /api/logos] DB update failed', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ logoUrl: publicUrl })
  } catch (err) {
    console.error('[POST /api/logos]', err)
    const msg = err instanceof Error ? err.message
      : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
      : JSON.stringify(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
