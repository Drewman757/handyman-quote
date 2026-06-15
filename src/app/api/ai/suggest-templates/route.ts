import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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

interface TemplateSummary {
  id: string
  name: string
  category: string
  pricing_type: string
  unit_price: number
  description: string | null
}

interface ClaudeResult {
  matchedIds: string[]
  newSuggestions: { name: string; category: string; pricing_type: string }[]
}

function buildPrompt(transcript: string, templates: TemplateSummary[]): string {
  if (templates.length === 0) {
    return `You are helping a handyman app analyze a voice transcript to suggest pricing templates to create.

Voice transcript:
"${transcript.trim()}"

Identify the distinct services, tasks, and work types mentioned. Suggest up to 4 new pricing templates to create.

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "matchedIds": [],
  "newSuggestions": [
    {"name": "Service Name", "category": "Category", "pricing_type": "fixed"}
  ]
}

Rules:
- "pricing_type" must be one of: "fixed", "sqft", "hourly"
- Use "hourly" for labor/time-based work, "sqft" for area-based work, "fixed" for everything else
- Keep names concise (2–4 words)`
  }

  return `You are helping a handyman app match a voice transcript to pricing templates.

Voice transcript:
"${transcript.trim()}"

Existing pricing templates:
${JSON.stringify(templates, null, 2)}

Task:
1. Find up to 3 templates whose service type best matches work described in the transcript.
2. For any work mentioned that has no good template match, suggest new templates to create (max 3).

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "matchedIds": ["id1", "id2"],
  "newSuggestions": [
    {"name": "Service Name", "category": "Category", "pricing_type": "fixed"}
  ]
}

Rules:
- Only include a template ID if it genuinely relates to the work described — no guesses
- "pricing_type" must be one of: "fixed", "sqft", "hourly"
- If all work is covered by matched templates, newSuggestions can be []
- Keep new suggestion names concise (2–4 words)`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { transcript } = await req.json() as { transcript: string }
    if (!transcript || transcript.trim().length < 15) {
      return NextResponse.json({ matches: [], newSuggestions: [] })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[suggest-templates] ANTHROPIC_API_KEY not set')
      return NextResponse.json({ matches: [], newSuggestions: [] })
    }

    const admin = getAdmin()

    const { data: contractor } = await admin
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const { data: rawTemplates } = await admin
      .from('pricing_templates')
      .select('id, name, category, pricing_type, unit_price, description')
      .eq('contractor_id', contractor?.id ?? '')
      .order('name')

    const templates: TemplateSummary[] = rawTemplates ?? []

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: buildPrompt(transcript, templates) }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}'
    // Strip potential markdown code fences
    const jsonText = rawText.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(jsonText) as ClaudeResult

    // Resolve matched IDs to full template objects in the order Claude ranked them
    const matches = (result.matchedIds ?? [])
      .slice(0, 3)
      .flatMap(id => {
        const t = templates.find(t => t.id === id)
        return t ? [t] : []
      })

    return NextResponse.json({
      matches,
      newSuggestions: (result.newSuggestions ?? []).slice(0, 3),
    })
  } catch (err) {
    // Non-fatal — suggestions are optional; silently return empty so the quote flow continues
    console.error('[POST /api/ai/suggest-templates]', err)
    return NextResponse.json({ matches: [], newSuggestions: [] })
  }
}
