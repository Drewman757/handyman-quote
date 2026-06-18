'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Plus, Check, Tag } from 'lucide-react'
import { formatCurrency, getPricingLabel } from '@/lib/utils/pricing'
import type { PricingType } from '@/lib/types'

export interface AddLineItemPayload {
  description: string
  pricing_type: PricingType
  unit_price: number
}

interface SuggestedItem {
  description: string
  category: string
  pricing_type: string
  templateId: string | null
  unit_price: number
}

interface SuggestedSection {
  title: string
  items: SuggestedItem[]
}

interface Props {
  transcript: string
  onAddLineItem: (item: AddLineItemPayload) => void
  onAddSection: (title: string, items: AddLineItemPayload[]) => void
}

type Status = 'idle' | 'loading' | 'done' | 'error'

export function TemplateSuggestions({ transcript, onAddLineItem, onAddSection }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [sections, setSections] = useState<SuggestedSection[]>([])
  const [addedSectionKeys, setAddedSectionKeys] = useState<Set<string>>(new Set())
  const [addedItemKeys, setAddedItemKeys] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // All items across all sections that have no template match (price TBD)
  const newTemplateItems = sections.flatMap(s =>
    s.items.filter(item => item.templateId === null).map(item => ({
      name: item.description,
      category: item.category,
      pricing_type: item.pricing_type,
    }))
  )

  async function handleSaveTemplates() {
    if (saveState !== 'idle' || newTemplateItems.length === 0) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/pricing-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templates: newTemplateItems.map(s => ({
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
      setSections([])
      setAddedSectionKeys(new Set())
      setAddedItemKeys(new Set())
      return
    }

    setStatus('loading')

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/suggest-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        })
        const data = await res.json() as { sections: SuggestedSection[] }
        setSections(data.sections ?? [])
        setStatus('done')
      } catch {
        setStatus('error')
      }
    }, 900)

    return () => clearTimeout(timer)
  }, [transcript])

  if (status === 'idle') return null

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
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="space-y-2" style={{ opacity: 1 - i * 0.3 }}>
              <div className="h-4 w-32 rounded bg-gray-100 animate-pulse" />
              <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
              <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Error — non-blocking */}
      {status === 'error' && (
        <p className="text-sm text-gray-400 text-center py-1">
          Could not analyze transcript — continue to pricing.
        </p>
      )}

      {/* No sections found */}
      {status === 'done' && sections.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-1">
          No services detected.{' '}
          <a href="/pricing-templates" className="text-purple-500 hover:underline font-medium">
            Add pricing templates
          </a>{' '}
          for faster quoting.
        </p>
      )}

      {/* Sections */}
      {status === 'done' && sections.length > 0 && (
        <div className="space-y-5">
          {sections.map((section, si) => {
            const sectionKey = `s${si}::${section.title}`
            const sectionAdded = addedSectionKeys.has(sectionKey)

            return (
              <div key={sectionKey} className="space-y-1.5">
                {/* Section header row */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    {section.title}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <button
                    type="button"
                    onClick={() => {
                      if (sectionAdded) return
                      onAddSection(
                        section.title,
                        section.items.map(item => ({
                          description: item.description,
                          pricing_type: item.pricing_type as PricingType,
                          unit_price: item.unit_price,
                        }))
                      )
                      setAddedSectionKeys(prev => new Set([...prev, sectionKey]))
                    }}
                    className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                      sectionAdded
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-purple-500 hover:bg-purple-600 text-white active:scale-95'
                    }`}
                  >
                    {sectionAdded
                      ? <><Check className="w-3 h-3" />Added</>
                      : <><Plus className="w-3 h-3" />Add section</>
                    }
                  </button>
                </div>

                {/* Items under this section */}
                <div className="space-y-1">
                  {section.items.map((item, ii) => {
                    const itemKey = `${sectionKey}::i${ii}::${item.description}`
                    const itemAdded = addedItemKeys.has(itemKey) || sectionAdded

                    return (
                      <div
                        key={itemKey}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg border transition ${
                          itemAdded
                            ? 'border-green-200 bg-green-50'
                            : 'border-dashed border-gray-200 hover:border-purple-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Tag className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-gray-800 truncate block">
                              {item.description}
                            </span>
                            <span className="text-xs text-gray-400">
                              {item.category} · {getPricingLabel(item.pricing_type as PricingType)}
                              {item.unit_price > 0
                                ? ` · ${formatCurrency(item.unit_price)}`
                                : ' · price TBD'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (itemAdded) return
                            onAddLineItem({
                              description: item.description,
                              pricing_type: item.pricing_type as PricingType,
                              unit_price: item.unit_price,
                            })
                            setAddedItemKeys(prev => new Set([...prev, itemKey]))
                          }}
                          className={`shrink-0 ml-3 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${
                            itemAdded
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : 'border border-gray-300 text-gray-600 hover:border-purple-400 hover:text-purple-600 active:scale-95'
                          }`}
                        >
                          {itemAdded
                            ? <><Check className="w-3 h-3" />Added</>
                            : <><Plus className="w-3 h-3" />Add</>
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Save new items as templates */}
          {newTemplateItems.length > 0 && (
            <div className="flex items-center gap-2 text-xs pt-1 border-t border-gray-100">
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
                 `Save ${newTemplateItems.length} new service${newTemplateItems.length > 1 ? 's' : ''} as templates →`}
              </button>
              {saveState === 'idle' && (
                <span className="text-gray-400">to reuse across quotes</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
