'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Plus, Check, Tag } from 'lucide-react'
import { formatCurrency, getPricingLabel } from '@/lib/utils/pricing'
import type { PricingType } from '@/lib/types'

interface MatchedTemplate {
  id: string
  name: string
  category: string
  pricing_type: string
  unit_price: number
  description?: string | null
}

interface NewSuggestion {
  name: string
  category: string
  pricing_type: string
}

export interface AddLineItemPayload {
  description: string
  pricing_type: PricingType
  unit_price: number
}

interface Props {
  transcript: string
  onAddLineItem: (item: AddLineItemPayload) => void
}

type Status = 'idle' | 'loading' | 'done' | 'error'

export function TemplateSuggestions({ transcript, onAddLineItem }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [matches, setMatches] = useState<MatchedTemplate[]>([])
  const [newSuggestions, setNewSuggestions] = useState<NewSuggestion[]>([])
  const [addedTemplateIds, setAddedTemplateIds] = useState<Set<string>>(new Set())
  const [addedSuggestionKeys, setAddedSuggestionKeys] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function handleSaveTemplates() {
    if (saveState !== 'idle') return
    setSaveState('saving')
    try {
      const res = await fetch('/api/pricing-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templates: newSuggestions.map(s => ({
            name: s.name,
            category: s.category,
            pricing_type: s.pricing_type,
            unit_price: 0,
          })),
        }),
      })
      if (!res.ok) throw new Error()
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2000)
    }
  }

  useEffect(() => {
    if (!transcript || transcript.trim().length < 20) {
      setStatus('idle')
      setMatches([])
      setNewSuggestions([])
      setAddedTemplateIds(new Set())
      setAddedSuggestionKeys(new Set())
      return
    }

    setStatus('loading')

    // Debounce: wait until transcript settles (recording stopped)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/suggest-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        })
        const data = await res.json() as { matches: MatchedTemplate[]; newSuggestions: NewSuggestion[] }
        setMatches(data.matches ?? [])
        setNewSuggestions(data.newSuggestions ?? [])
        setStatus('done')
      } catch {
        setStatus('error')
      }
    }, 900)

    return () => clearTimeout(timer)
  }, [transcript])

  if (status === 'idle') return null

  const hasMatches = matches.length > 0
  const hasSuggestions = newSuggestions.length > 0
  const hasAny = hasMatches || hasSuggestions

  return (
    <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
        </div>
        <span className="text-sm font-semibold text-gray-800">AI pricing suggestions</span>
        {status === 'loading' && (
          <span className="text-xs text-purple-400 animate-pulse">Analyzing transcript…</span>
        )}
      </div>

      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-[88px] rounded-lg bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
          ))}
        </div>
      )}

      {/* API error — silent, non-blocking */}
      {status === 'error' && (
        <p className="text-sm text-gray-400 text-center py-1">
          Could not analyze transcript — continue to pricing.
        </p>
      )}

      {/* Matched templates */}
      {status === 'done' && hasMatches && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Matched templates
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {matches.map(t => {
              const added = addedTemplateIds.has(t.id)
              return (
                <div
                  key={t.id}
                  className={`rounded-lg border p-3 space-y-2 transition ${
                    added ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-purple-200 hover:bg-purple-50/30'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.category}</p>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(t.unit_price)}</p>
                      <p className="text-xs text-gray-400">{getPricingLabel(t.pricing_type as PricingType)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (added) return
                        onAddLineItem({
                          description: t.name,
                          pricing_type: t.pricing_type as PricingType,
                          unit_price: t.unit_price,
                        })
                        setAddedTemplateIds(prev => new Set([...prev, t.id]))
                      }}
                      className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                        added
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-purple-500 hover:bg-purple-600 active:scale-95 text-white'
                      }`}
                    >
                      {added
                        ? <><Check className="w-3 h-3" />Added</>
                        : <><Plus className="w-3 h-3" />Add</>
                      }
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* New suggestions (no existing template) */}
      {status === 'done' && hasSuggestions && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {hasMatches ? 'Also detected — no template yet' : 'Detected services — no templates yet'}
          </p>
          <div className="space-y-1.5">
            {newSuggestions.map((s, i) => {
              const key = `${s.name}::${i}`
              const added = addedSuggestionKeys.has(key)
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg border transition ${
                    added
                      ? 'border-green-200 bg-green-50'
                      : 'border-dashed border-gray-200 hover:border-purple-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate block">{s.name}</span>
                      <span className="text-xs text-gray-400">
                        {s.category} · {getPricingLabel(s.pricing_type as PricingType)} · price TBD
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (added) return
                      onAddLineItem({
                        description: s.name,
                        pricing_type: s.pricing_type as PricingType,
                        unit_price: 0,
                      })
                      setAddedSuggestionKeys(prev => new Set([...prev, key]))
                    }}
                    className={`shrink-0 ml-3 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                      added
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'border border-gray-300 text-gray-600 hover:border-purple-400 hover:text-purple-600 active:scale-95'
                    }`}
                  >
                    {added
                      ? <><Check className="w-3 h-3" />Added</>
                      : <><Plus className="w-3 h-3" />Add line</>
                    }
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSaveTemplates}
              disabled={saveState !== 'idle'}
              className={`font-medium transition ${
                saveState === 'saved' ? 'text-green-600' :
                saveState === 'error' ? 'text-red-500' :
                saveState === 'saving' ? 'text-purple-400 animate-pulse' :
                'text-purple-500 hover:underline'
              }`}
            >
              {saveState === 'saving' ? 'Saving…' :
               saveState === 'saved' ? '✓ Saved to templates!' :
               saveState === 'error' ? 'Save failed — retry?' :
               'Save as templates →'}
            </button>
            {saveState === 'idle' && (
              <span className="text-gray-400">to reuse across quotes</span>
            )}
          </div>
        </div>
      )}

      {/* Done but nothing found at all */}
      {status === 'done' && !hasAny && (
        <p className="text-sm text-gray-400 text-center py-1">
          No matches found.{' '}
          <a href="/pricing-templates" className="text-purple-500 hover:underline font-medium">
            Add pricing templates
          </a>{' '}
          for faster quoting.
        </p>
      )}
    </div>
  )
}
