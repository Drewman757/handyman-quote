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
}

interface ClaudeItem {
  description: string
  category: string
  pricing_type: string
  templateId: string | null
  unit_price: number
}

interface ClaudeSection {
  title: string
  items: ClaudeItem[]
}

interface ClaudeResult {
  sections: ClaudeSection[]
}

function buildPrompt(transcript: string, templates: TemplateSummary[]): string {
  const templateBlock = templates.length > 0
    ? `\nExisting pricing templates — match items to these where appropriate:
${JSON.stringify(templates.map(t => ({ id: t.id, name: t.name, category: t.category, pricing_type: t.pricing_type, unit_price: t.unit_price })), null, 2)}\n`
    : ''

  return `You are a pricing assistant for a handyman contractor app. Parse a voice transcript recorded on a job walk and extract all the work that needs to be done, organized by room or area.

Voice transcript:
"${transcript.trim()}"
${templateBlock}
Instructions:
1. Read the ENTIRE transcript — do not stop after the first room.
2. Detect distinct rooms or work areas. Watch for transition phrases like: "next room", "moving on to", "in the [room]", "[room name] needs", "over in the", "for the [room]", specific room names (kitchen, bathroom, bedroom, living room, garage, etc.), flood/water damage zones, etc.
3. Group every service or task under the room/area where it will be performed.
4. If no room transitions are detected, group everything under a contextually appropriate single section title (e.g. "Kitchen Renovation", "Water Damage Repair").
5. Keep item descriptions concise and specific (3–7 words, action-oriented).
${templates.length > 0 ? `6. For each item, check if it closely matches an existing template by service type. If matched, include the template's "id" as "templateId" and its "unit_price". If no match, set templateId to null and unit_price to 0.` : `6. Set templateId to null and unit_price to 0 for all items.`}

pricing_type must be exactly: "fixed" | "sqft" | "hourly"
Category examples: "Demo & Removal", "Drywall", "Painting", "Carpentry", "Flooring", "Tile", "Plumbing", "Electrical", "Labor", "Trim & Finish"

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "sections": [
    {
      "title": "Room or Area Name",
      "items": [
        { "description": "Task description", "category": "Category", "pricing_type": "fixed", "templateId": null, "unit_price": 0 }
      ]
    }
  ]
}`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { transcript } = await req.json() as { transcript: string }
    if (!transcript || transcript.trim().length < 15) {
      return NextResponse.json({ sections: [] })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[suggest-templates] ANTHROPIC_API_KEY not set')
      return NextResponse.json({ sections: [] })
    }

    const admin = getAdmin()

    const { data: contractor } = await admin
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const { data: rawTemplates } = await admin
      .from('pricing_templates')
      .select('id, name, category, pricing_type, unit_price')
      .eq('contractor_id', contractor?.id ?? '')
      .order('name')

    const templates: TemplateSummary[] = rawTemplates ?? []

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(transcript, templates) }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const jsonText = rawText.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(jsonText) as ClaudeResult

    // Validate and normalize sections
    const sections: ClaudeSection[] = (result.sections ?? [])
      .filter(s => s.title && Array.isArray(s.items) && s.items.length > 0)
      .map(s => ({
        title: s.title.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
        items: s.items
          .filter(item => item.description)
          .map(item => ({
            description: item.description,
            category: item.category || 'General',
            pricing_type: ['fixed', 'sqft', 'hourly'].includes(item.pricing_type) ? item.pricing_type : 'fixed',
            templateId: item.templateId ?? null,
            unit_price: typeof item.unit_price === 'number' ? item.unit_price : 0,
          })),
      }))

    return NextResponse.json({ sections })
  } catch (err) {
    console.error('[POST /api/ai/suggest-templates]', err)
    return NextResponse.json({ sections: [] })
  }
}
