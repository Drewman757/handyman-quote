'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateLineItemTotal, calculateQuoteTotals, formatCurrency, getUnitLabel, parseFirstNumber } from '@/lib/utils/pricing'
import type { PricingType } from '@/lib/types'
import { Plus, Trash2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react'
import { VoiceRecorder } from '@/components/voice/VoiceRecorder'
import { TemplateSuggestions } from '@/components/voice/TemplateSuggestions'
import type { AddLineItemPayload } from '@/components/voice/TemplateSuggestions'
import { FieldMicButton } from '@/components/voice/FieldMicButton'

interface SectionDraft {
  id: string
  type: 'section'
  title: string
}

interface ItemDraft {
  id: string
  type: 'item'
  description: string
  pricing_type: PricingType
  unit_price: number
  quantity: number
  notes: string
}

type QuoteRow = SectionDraft | ItemDraft
type ComputedRow = SectionDraft | (ItemDraft & { total: number })

const STEPS = ['Client', 'Notes', 'Pricing', 'Review']

export function EditQuoteClient({ id }: { id: string }) {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Client fields
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientState, setClientState] = useState('')
  const [clientZip, setClientZip] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  // Voice — new transcript from this edit session + what was already stored
  const [transcript, setTranscript] = useState('')
  const [existingTranscript, setExistingTranscript] = useState('')

  // Notes
  const [notes, setNotes] = useState('')

  // Rows
  const [rows, setRows] = useState<QuoteRow[]>([{
    id: crypto.randomUUID(), type: 'item', description: '', pricing_type: 'fixed', unit_price: 0, quantity: 1, notes: ''
  }])

  // Quote settings
  const [taxRate, setTaxRate] = useState(0)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [caveats, setCaveats] = useState('')
  const [lumpSum, setLumpSum] = useState(false)

  // IDs of rows that were loaded from the DB — new rows inserted via voice or
  // manual "add section at top" go before these, preserving speech order while
  // staying above pre-existing content.
  const originalRowIds = useRef<Set<string>>(new Set())

  // Load existing quote on mount
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: quote } = await supabase
        .from('quotes')
        .select('*, client:clients(*), line_items(*)')
        .eq('id', id)
        .single()

      if (!quote) {
        router.push('/quotes')
        return
      }

      const client = quote.client as Record<string, string>
      setClientName(client.name || '')
      setClientAddress(client.address || '')
      setClientCity(client.city || '')
      setClientState(client.state || '')
      setClientZip(client.zip || '')
      setClientPhone(client.phone || '')
      setClientEmail(client.email || '')

      setNotes(quote.notes || '')
      setExistingTranscript(((quote as Record<string, unknown>).voice_transcript as string) || '')
      setTaxRate(Math.round((quote.tax_rate || 0) * 1000) / 10)
      setPaymentTerms(quote.payment_terms || '')
      setCaveats(quote.caveats || '')
      setLumpSum(quote.lump_sum || false)

      const rawItems = ((quote.line_items as Record<string, unknown>[]) || [])
        .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))

      if (rawItems.length > 0) {
        const loadedRows = rawItems.map(li =>
          li.item_type === 'section'
            ? { id: crypto.randomUUID(), type: 'section' as const, title: (li.description as string) || '' }
            : {
                id: crypto.randomUUID(),
                type: 'item' as const,
                description: (li.description as string) || '',
                pricing_type: ((li.pricing_type as PricingType) || 'fixed'),
                unit_price: (li.unit_price as number) || 0,
                quantity: (li.quantity as number) || 1,
                notes: (li.notes as string) || '',
              }
        )
        originalRowIds.current = new Set(loadedRows.map(r => r.id))
        setRows(loadedRows)
      }

      setLoaded(true)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function addItemToSection(sectionId: string | null) {
    const newItem: QuoteRow = {
      id: crypto.randomUUID(), type: 'item' as const, description: '', pricing_type: 'fixed', unit_price: 0, quantity: 1, notes: ''
    }
    setRows(prev => {
      if (sectionId === null) {
        // Insert before the first section so the item stays in the unsectioned group;
        // if there are no sections, just append.
        const firstSectionIdx = prev.findIndex(r => r.type === 'section')
        if (firstSectionIdx === -1) return [...prev, newItem]
        const result = [...prev]
        result.splice(firstSectionIdx, 0, newItem)
        return result
      }
      const sectionIdx = prev.findIndex(r => r.id === sectionId)
      if (sectionIdx === -1) return [...prev, newItem]
      // Find the last item belonging to this section (up to the next section or end).
      let insertAfter = sectionIdx
      for (let i = sectionIdx + 1; i < prev.length; i++) {
        if (prev[i].type === 'section') break
        insertAfter = i
      }
      const result = [...prev]
      result.splice(insertAfter + 1, 0, newItem)
      return result
    })
  }

  // Shared insertion helper used by both voice suggestions and the manual
  // "Add section at top" button. Inserts the new block (header + optional items)
  // immediately before the first row that was loaded from the DB, so:
  //   • successive suggestion clicks land in speech order above original content
  //   • original sections/items are never displaced unexpectedly
  function insertSectionBlock(title: string, items: AddLineItemPayload[]) {
    const sectionId = crypto.randomUUID()
    const block: QuoteRow[] = [
      { id: sectionId, type: 'section' as const, title },
      ...items.map(item => ({
        id: crypto.randomUUID(),
        type: 'item' as const,
        description: item.description,
        pricing_type: item.pricing_type,
        unit_price: item.unit_price,
        quantity: 1 as number,
        notes: '',
      })),
    ]
    setRows(prev => {
      const firstOriginalIdx = prev.findIndex(r => originalRowIds.current.has(r.id))
      const insertAt = firstOriginalIdx === -1 ? 0 : firstOriginalIdx
      const result = [...prev]
      result.splice(insertAt, 0, ...block)
      return result
    })
  }

  // Called by TemplateSuggestions when the user accepts a voice-parsed section.
  function addSectionFromSuggestion(title: string, items: AddLineItemPayload[]) {
    insertSectionBlock(title, items)
  }

  function addSection() {
    setRows(prev => [...prev, { id: crypto.randomUUID(), type: 'section' as const, title: '' }])
  }

  function addLineItemFromSuggestion({ description, pricing_type, unit_price }: AddLineItemPayload) {
    setRows(prev => [...prev, {
      id: crypto.randomUUID(), type: 'item' as const, description, pricing_type, unit_price, quantity: 1, notes: ''
    }])
  }

  function updateRow(rowId: string, field: string, value: string | number) {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
  }

  function removeRow(rowId: string) {
    setRows(prev => prev.filter(r => r.id !== rowId))
  }

  function moveSectionUp(sectionId: string) {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === sectionId)
      if (idx === -1) return prev
      let blockEnd = idx
      for (let i = idx + 1; i < prev.length; i++) {
        if (prev[i].type === 'section') break
        blockEnd = i
      }
      let prevSectionIdx = -1
      for (let i = idx - 1; i >= 0; i--) {
        if (prev[i].type === 'section') { prevSectionIdx = i; break }
      }
      if (prevSectionIdx === -1) return prev
      const block = prev.slice(idx, blockEnd + 1)
      const result = [...prev]
      result.splice(idx, block.length)
      result.splice(prevSectionIdx, 0, ...block)
      return result
    })
  }

  function moveSectionDown(sectionId: string) {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === sectionId)
      if (idx === -1) return prev
      let blockEnd = idx
      for (let i = idx + 1; i < prev.length; i++) {
        if (prev[i].type === 'section') break
        blockEnd = i
      }
      const nextSectionIdx = blockEnd + 1
      if (nextSectionIdx >= prev.length || prev[nextSectionIdx].type !== 'section') return prev
      let nextBlockEnd = nextSectionIdx
      for (let i = nextSectionIdx + 1; i < prev.length; i++) {
        if (prev[i].type === 'section') break
        nextBlockEnd = i
      }
      const before = prev.slice(0, idx)
      const currentBlock = prev.slice(idx, blockEnd + 1)
      const nextBlock = prev.slice(nextSectionIdx, nextBlockEnd + 1)
      const after = prev.slice(nextBlockEnd + 1)
      return [...before, ...nextBlock, ...currentBlock, ...after]
    })
  }

  function moveItemUp(itemId: string) {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === itemId)
      if (idx <= 0 || prev[idx - 1].type === 'section') return prev
      const result = [...prev]
      ;[result[idx - 1], result[idx]] = [result[idx], result[idx - 1]]
      return result
    })
  }

  function moveItemDown(itemId: string) {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === itemId)
      if (idx === -1 || idx >= prev.length - 1 || prev[idx + 1].type === 'section') return prev
      const result = [...prev]
      ;[result[idx], result[idx + 1]] = [result[idx + 1], result[idx]]
      return result
    })
  }

  const computedRows: ComputedRow[] = rows.map(row =>
    row.type === 'section'
      ? row
      : { ...row, total: calculateLineItemTotal(row.pricing_type, row.unit_price, row.quantity) }
  )

  const itemsWithTotals = computedRows.filter((r): r is ItemDraft & { total: number } => r.type === 'item')
  const { subtotal, taxAmount, total } = calculateQuoteTotals(
    itemsWithTotals.map(li => ({ ...li, sort_order: 0, quote_id: '' })),
    taxRate / 100
  )

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      // Concatenate new recording with any prior transcript from previous sessions.
      // Keeps a running log without clobbering older voice notes.
      const fresh = transcript.trim()
      const voiceTranscript = fresh
        ? existingTranscript
          ? `${existingTranscript}\n[Edit ${new Date().toLocaleDateString()}]\n${fresh}`
          : fresh
        : existingTranscript || null

      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            name: clientName, address: clientAddress, city: clientCity,
            state: clientState, zip: clientZip, phone: clientPhone, email: clientEmail,
          },
          notes,
          voiceTranscript,
          lineItems: computedRows
            .filter(row =>
              row.type === 'section'
                ? (row as SectionDraft).title.trim()
                : (row as ItemDraft).description.trim()
            )
            .map((row, i) =>
              row.type === 'section'
                ? { type: 'section', title: (row as SectionDraft).title, sort_order: i }
                : {
                    type: 'item',
                    description: (row as ItemDraft).description,
                    pricing_type: (row as ItemDraft).pricing_type,
                    unit_price: (row as ItemDraft).unit_price,
                    quantity: (row as ItemDraft).quantity,
                    total: (row as ItemDraft & { total: number }).total,
                    notes: (row as ItemDraft).notes,
                    sort_order: i,
                  }
            ),
          taxRate,
          paymentTerms,
          caveats,
          lumpSum,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save quote')
      router.push(`/quotes/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#0E6E7E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push(`/quotes/${id}`)} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit quote</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-sm font-medium ${i === step ? 'text-[#0E6E7E]' : i < step ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${i === step ? 'bg-[#0E6E7E] text-white' : i < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="hidden sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px w-6 ${i < step ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Client */}
      {step === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Client information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                placeholder="Jane Smith" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                placeholder="123 Main St" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input value={clientCity} onChange={e => setClientCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                placeholder="Naples" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input value={clientState} onChange={e => setClientState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                  placeholder="FL" maxLength={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input value={clientZip} onChange={e => setClientZip(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                  placeholder="34102" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                placeholder="(555) 000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                placeholder="jane@example.com" />
            </div>
          </div>
          <button onClick={() => setStep(1)} disabled={!clientName}
            className="w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-60 flex items-center justify-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Voice + Notes */}
      {step === 1 && (
        <div className="space-y-4">
          <VoiceRecorder onTranscriptChange={setTranscript} />

          <TemplateSuggestions
            transcript={transcript}
            onAddLineItem={addLineItemFromSuggestion}
            onAddSection={addSectionFromSuggestion}
          />

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Job notes</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400 resize-none"
              placeholder="Describe the work to be done…" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Back</button>
            <button onClick={() => setStep(2)} className="flex-1 bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Pricing */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Line items</h2>
            {(() => {
              // Group the flat rows list by section so each section can have
              // its own "+ Add line item" control that inserts at the right position.
              type Group = { sectionRow: SectionDraft | null; items: ItemDraft[] }
              const groups: Group[] = []
              let current: Group = { sectionRow: null, items: [] }
              for (const row of rows) {
                if (row.type === 'section') {
                  groups.push(current)
                  current = { sectionRow: row as SectionDraft, items: [] }
                } else {
                  current.items.push(row as ItemDraft)
                }
              }
              groups.push(current)
              const namedGroups = groups.filter(g => g.sectionRow !== null)
              const firstSectionId = namedGroups[0]?.sectionRow?.id
              const lastSectionId = namedGroups[namedGroups.length - 1]?.sectionRow?.id

              let itemIndex = 0
              return (
                <div className="space-y-6">
                  {/* Insert a blank section before the pre-existing content */}
                  <button
                    onClick={() => insertSectionBlock('', [])}
                    className="w-full border border-dashed border-[#1A8A9C] hover:border-[#0E6E7E] text-[#0E6E7E] py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Add section at top
                  </button>

                  {groups.map((group) => (
                    <div key={group.sectionRow?.id ?? '__top__'} className="space-y-3">
                      {group.sectionRow && (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#EFF9FA] rounded-lg border border-[#0E6E7E]/25">
                          <span className="text-xs font-bold text-[#0E6E7E] uppercase tracking-wide shrink-0">Section</span>
                          <input
                            value={group.sectionRow.title}
                            onChange={e => updateRow(group.sectionRow!.id, 'title', e.target.value)}
                            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none placeholder:font-normal placeholder:text-gray-400"
                            placeholder="e.g. Flood Room, Master Bathroom…"
                          />
                          <FieldMicButton
                            onResult={t => updateRow(group.sectionRow!.id, 'title', t.trim())}
                          />
                          <div className="flex flex-col shrink-0">
                            <button
                              type="button"
                              onClick={() => moveSectionUp(group.sectionRow!.id)}
                              disabled={group.sectionRow!.id === firstSectionId}
                              className="flex items-center justify-center w-6 h-4 text-gray-400 hover:text-gray-600 disabled:opacity-25 disabled:cursor-default transition"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSectionDown(group.sectionRow!.id)}
                              disabled={group.sectionRow!.id === lastSectionId}
                              className="flex items-center justify-center w-6 h-4 text-gray-400 hover:text-gray-600 disabled:opacity-25 disabled:cursor-default transition"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                          <button onClick={() => removeRow(group.sectionRow!.id)} className="text-red-400 hover:text-red-600 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Items + per-section add-button, indented under named sections */}
                      <div className={group.sectionRow ? 'ml-3 pl-2 border-l-2 border-[#1A8A9C]/30 space-y-3' : 'space-y-3'}>
                        {group.items.map(li => {
                          const idx = itemIndex++
                          const isFirstItem = group.items.indexOf(li) === 0
                          const isLastItem = group.items.indexOf(li) === group.items.length - 1
                          return (
                            <div key={li.id} className="p-4 border border-gray-200 rounded-lg space-y-3 bg-white">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-400">Item {idx + 1}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveItemUp(li.id)}
                                    disabled={isFirstItem}
                                    className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-gray-600 disabled:opacity-25 disabled:cursor-default transition"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveItemDown(li.id)}
                                    disabled={isLastItem}
                                    className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-gray-600 disabled:opacity-25 disabled:cursor-default transition"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  {rows.length > 1 && (
                                    <button onClick={() => removeRow(li.id)} className="flex items-center justify-center w-7 h-7 rounded text-red-400 hover:text-red-600">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Description + mic */}
                              <div className="flex items-center gap-1.5">
                                <input
                                  value={li.description}
                                  onChange={e => updateRow(li.id, 'description', e.target.value)}
                                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                                  placeholder="Description of work"
                                />
                                <FieldMicButton
                                  onResult={t => updateRow(li.id, 'description', t.trim())}
                                />
                              </div>
                              {/* Pricing grid — each number cell is a flex row with its own mic */}
                              <div className="grid grid-cols-3 gap-2">
                                <select value={li.pricing_type} onChange={e => updateRow(li.id, 'pricing_type', e.target.value)}
                                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900">
                                  <option value="fixed">Flat rate</option>
                                  <option value="sqft">Per sq ft</option>
                                  <option value="hourly">Per hour</option>
                                </select>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={li.unit_price}
                                    onChange={e => updateRow(li.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                    onFocus={e => e.target.select()}
                                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                                    placeholder="Price"
                                    min={0} step={0.01}
                                  />
                                  <FieldMicButton
                                    onResult={t => {
                                      const n = parseFirstNumber(t)
                                      if (n !== null) updateRow(li.id, 'unit_price', n)
                                    }}
                                  />
                                </div>
                                {li.pricing_type !== 'fixed' && (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={li.quantity}
                                      onChange={e => updateRow(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                                      onFocus={e => e.target.select()}
                                      className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                                      placeholder={getUnitLabel(li.pricing_type)} min={0} step={0.5}
                                    />
                                    <FieldMicButton
                                      onResult={t => {
                                        const n = parseFirstNumber(t)
                                        if (n !== null) updateRow(li.id, 'quantity', n)
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="text-right text-sm font-semibold text-gray-900">
                                {formatCurrency(calculateLineItemTotal(li.pricing_type, li.unit_price, li.quantity))}
                              </div>
                            </div>
                          )
                        })}
                        <button
                          onClick={() => addItemToSection(group.sectionRow?.id ?? null)}
                          className="w-full border border-dashed border-gray-200 hover:border-[#0E6E7E] text-gray-400 hover:text-[#0E6E7E] py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add line item
                        </button>
                      </div>
                    </div>
                  ))}

                  <button onClick={addSection}
                    className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-500 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add section at bottom
                  </button>
                </div>
              )
            })()}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Quote settings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax rate (%)</label>
              <div className="flex items-center gap-1.5">
                <input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  onFocus={e => e.target.select()}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
                  min={0} max={100} step={0.1} />
                <FieldMicButton
                  onResult={t => {
                    const n = parseFirstNumber(t)
                    if (n !== null) setTaxRate(n)
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment terms</label>
              <div className="flex items-start gap-1.5">
                <textarea value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} rows={2}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 resize-none" />
                <FieldMicButton
                  onResult={t => setPaymentTerms(prev => {
                    const s = t.trim()
                    if (!prev) return s
                    return prev + (/\s$/.test(prev) ? '' : ' ') + s
                  })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caveats / notes to client</label>
              <div className="flex items-start gap-1.5">
                <textarea value={caveats} onChange={e => setCaveats(e.target.value)} rows={3}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 resize-none"
                  placeholder="e.g. Price subject to change if additional issues found…" />
                <FieldMicButton
                  onResult={t => setCaveats(prev => {
                    const s = t.trim()
                    if (!prev) return s
                    return prev + (/\s$/.test(prev) ? '' : ' ') + s
                  })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium text-gray-700">Lump sum quote</p>
                <p className="text-xs text-gray-400 mt-0.5">Client sees descriptions and total only — prices stay private</p>
              </div>
              <button
                type="button"
                onClick={() => setLumpSum(prev => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${lumpSum ? 'bg-[#0E6E7E]' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${lumpSum ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Back</button>
            <button onClick={() => setStep(3)} className="flex-1 bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
              Review <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Review changes</h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-900">{clientName}</p>
              <p>{clientAddress}, {clientCity}, {clientState} {clientZip}</p>
              <p>{clientPhone} · {clientEmail}</p>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              {(() => {
                let inSection = false
                return computedRows
                  .filter(row =>
                    row.type === 'section'
                      ? (row as SectionDraft).title.trim()
                      : (row as ItemDraft).description.trim()
                  )
                  .map(row => {
                    if (row.type === 'section') {
                      inSection = true
                      return (
                        <div key={row.id} className="pt-1.5 pb-0.5">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{(row as SectionDraft).title}</p>
                        </div>
                      )
                    }
                    const li = row as ItemDraft & { total: number }
                    return (
                      <div key={li.id} className={`flex justify-between text-sm${inSection ? ' pl-3' : ''}`}>
                        <span className="text-gray-700">
                          {li.description}
                          {li.pricing_type !== 'fixed' && (
                            <span className="text-gray-400"> ({li.quantity} {getUnitLabel(li.pricing_type)})</span>
                          )}
                        </span>
                        {!lumpSum && <span className="font-medium text-gray-900">{formatCurrency(li.total)}</span>}
                      </div>
                    )
                  })
              })()}
              {lumpSum && (
                <p className="text-xs text-gray-400 italic mt-1">Prices hidden — client sees descriptions and total only</p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1">
              {!lumpSum && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                </div>
              )}
              {!lumpSum && taxRate > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>

            {paymentTerms && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500">{paymentTerms}</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="border border-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Back</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
