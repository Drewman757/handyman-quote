import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are a punctuation and capitalization corrector for voice transcripts from a contractor quoting app.

Your ONLY job is to add appropriate punctuation, fix capitalization, and fix obvious spacing issues in the raw transcribed text.

STRICT RULES — follow exactly:
- Preserve EVERY word the speaker said. Do not add, remove, rephrase, or substitute any words.
- Only add punctuation (periods, commas, apostrophes, hyphens) where clearly appropriate.
- Fix capitalization: capitalize sentence starts, proper nouns, and the word "I".
- Fix obvious run-on words that the speech recognizer merged (e.g. "bathroomtiles" → "bathroom tiles").
- Do NOT summarize, paraphrase, reword, or improve the content in any way.
- Do NOT add any commentary, prefix, or explanation — output ONLY the corrected transcript.`

const FIELD_HINTS: Record<string, string> = {
  description: 'Short line item description for a handyman quote (e.g. "install bathroom tiles"). Usually 2–8 words. Capitalize like a sentence.',
  section_title: 'Section heading in a handyman quote (e.g. "Master Bathroom"). Usually 1–4 words. Use title case.',
  payment_terms: 'Payment terms paragraph for a contractor quote. May be one or more sentences.',
  caveats: 'Notes/caveats field for a contractor quote. May be one or more sentences.',
  financing_options: 'Financing options field for a contractor quote. May be one or more sentences.',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { transcript, fieldType } = await req.json() as { transcript?: string; fieldType?: string }
    if (!transcript?.trim()) return NextResponse.json({ cleaned: transcript ?? '' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[clean-transcript] ANTHROPIC_API_KEY not set')
      return NextResponse.json({ cleaned: transcript })
    }

    const hint = (fieldType && FIELD_HINTS[fieldType]) ?? ''

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${hint ? hint + '\n\n' : ''}Fix punctuation and capitalization only:\n\n${transcript.trim()}`,
        },
      ],
    })

    const raw = message.content[0]
    const cleaned = raw.type === 'text' ? raw.text.trim() : transcript

    return NextResponse.json({ cleaned })
  } catch (err) {
    console.error('[POST /api/ai/clean-transcript]', err)
    return NextResponse.json({ error: 'Failed to clean transcript' }, { status: 500 })
  }
}
