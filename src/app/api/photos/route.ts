import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.error ?? JSON.stringify(e))
  }
  return String(err)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const formData = await req.formData()
    const files = formData.getAll('photos') as File[]

    if (!files.length) return NextResponse.json({ paths: [] })
    if (files.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 photos allowed' }, { status: 400 })
    }

    const admin = getAdmin()
    const sessionId = crypto.randomUUID()
    const paths: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: `File ${i + 1} is not an image` }, { status: 400 })
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `Photo ${i + 1} exceeds the 10 MB size limit` },
          { status: 400 }
        )
      }

      const rawExt = file.name.split('.').pop()?.toLowerCase() ?? ''
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'jpg'
      const path = `${user.id}/${sessionId}/${i + 1}.${ext}`

      const bytes = await file.arrayBuffer()
      const { error } = await admin.storage
        .from('quote-photos')
        .upload(path, bytes, { contentType: file.type, upsert: false })

      if (error) throw error
      paths.push(path)
    }

    return NextResponse.json({ paths })
  } catch (err) {
    console.error('[POST /api/photos]', err)
    return NextResponse.json({ error: errMsg(err) }, { status: 500 })
  }
}
