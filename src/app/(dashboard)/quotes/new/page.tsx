'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { VoiceRecorder } from '@/components/voice/VoiceRecorder'
import { TemplateSuggestions } from '@/components/voice/TemplateSuggestions'
import type { AddLineItemPayload } from '@/components/voice/TemplateSuggestions'
import { calculateLineItemTotal, calculateQuoteTotals, formatCurrency, getUnitLabel, parseFirstNumber } from '@/lib/utils/pricing'
import type { PricingType } from '@/lib/types'
import { Plus, Trash2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Camera, X, ImageIcon } from 'lucide-react'
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

interface PhotoEntry {
  file: File
  preview: string
}

interface ExistingClient {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
}

const STEPS = ['Client', 'Job Notes', 'Pricing', 'Review']

export default function NewQuotePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmSend, setConfirmSend] = useState(false)
  const [pricingChecked, setPricingChecked] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const priceFocusRef = useRef<HTMLInputElement>(null)
  const [suggestedItemIds, setSuggestedItemIds] = useState<Set<string>>(new Set())

  const [existingClients, setExistingClients] = useState<ExistingClient[]>([])
  const [contractorLogoUrl, setContractorLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadContractorData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: contractor } = await supabase
        .from('contractors')
        .select('id, logo_url, default_payment_terms, default_caveats, financing_options')
        .eq('user_id', user.id)
        .single()
      if (!contractor) return
      if (contractor.logo_url) setContractorLogoUrl(contractor.logo_url)
      if (contractor.default_payment_terms) setPaymentTerms(contractor.default_payment_terms)
      if (contractor.default_caveats) setCaveats(contractor.default_caveats)
      if (contractor.financing_options) setFinancingOptions(contractor.financing_options)
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, address, city, state, zip, phone, email')
        .eq('contractor_id', contractor.id)
        .order('name')
      if (clients) setExistingClients(clients)
    }
    loadContractorData()
  }, [])

  // Client
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientState, setClientState] = useState('')
  const [clientZip, setClientZip] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  function handleExistingClientSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const client = existingClients.find(c => c.id === e.target.value)
    if (!client) return
    setClientName(client.name)
    setClientAddress(client.address)
    setClientCity(client.city)
    setClientState(client.state)
    setClientZip(client.zip)
    setClientPhone(client.phone)
    setClientEmail(client.email)
  }

  // Voice
  const [transcript, setTranscript] = useState('')
  const [notes, setNotes] = useState('')

  // Photos
  const [photos, setPhotos] = useState<PhotoEntry[]>([])

  // Rows: sections + line items in display order
  const [rows, setRows] = useState<QuoteRow[]>([{
    id: crypto.randomUUID(), type: 'item', description: '', pricing_type: 'fixed', unit_price: 0, quantity: 1, notes: ''
  }])

  // Quote settings
  const [taxRate, setTaxRate] = useState(0)
  const [paymentTerms, setPaymentTerms] = useState('Payment due upon completion.')
  const [caveats, setCaveats] = useState('')
  const [financingOptions, setFinancingOptions] = useState('')
  const [lumpSum, setLumpSum] = useState(false)

  // Debug overlay — active only when ?debug=1 is in the URL
  const [debugMode, setDebugMode] = useState(false)
  const [debugExpanded, setDebugExpanded] = useState(false)
  const [debugLines, setDebugLines] = useState<string[]>([])
  const debugOverlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDebugMode(new URLSearchParams(window.location.search).get('debug') === '1')
  }, [])

  useEffect(() => {
    if (debugOverlayRef.current) {
      debugOverlayRef.current.scrollTop = debugOverlayRef.current.scrollHeight
    }
  }, [debugLines])

  const addDebugLine = useCallback((msg: string) => {
    setDebugLines(prev => {
      const next = [...prev, msg]
      return next.length > 200 ? next.slice(-200) : next
    })
  }, [])

  const onTranscriptChange = useCallback((t: string) => {
    setTranscript(t)
    if (t && !notes) setNotes(t)
  }, [notes])

  useEffect(() => {
    if (step === 2 && priceFocusRef.current) {
      setTimeout(() => {
        priceFocusRef.current?.focus()
        priceFocusRef.current?.select()
      }, 50)
    }
  }, [step])

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPhotos(prev => {
      const remaining = 5 - prev.length
      const added = files.slice(0, remaining).map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
      }))
      return [...prev, ...added]
    })
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function addLineItem() {
    setRows(prev => [...prev, {
      id: crypto.randomUUID(), type: 'item' as const, description: '', pricing_type: 'fixed', unit_price: 0, quantity: 1, notes: ''
    }])
  }

  function addSection() {
    setRows(prev => [...prev, { id: crypto.randomUUID(), type: 'section' as const, title: '' }])
  }

  function addLineItemFromSuggestion({ description, pricing_type, unit_price }: AddLineItemPayload) {
    const newId = crypto.randomUUID()
    setRows(prev => {
      const onlyBlank = prev.length === 1 && prev[0].type === 'item' && !(prev[0] as ItemDraft).description.trim() && (prev[0] as ItemDraft).unit_price === 0
      const base = onlyBlank ? [] : prev
      return [...base, { id: newId, type: 'item' as const, description, pricing_type, unit_price, quantity: 1, notes: '' }]
    })
    if (unit_price === 0) {
      setSuggestedItemIds(prev => new Set([...prev, newId]))
    }
  }

  function addSectionFromSuggestion(title: string, items: AddLineItemPayload[]) {
    const itemRows = items.map(item => ({
      id: crypto.randomUUID(),
      type: 'item' as const,
      description: item.description,
      pricing_type: item.pricing_type,
      unit_price: item.unit_price,
      quantity: 1,
      notes: '',
    }))
    setRows(prev => {
      const onlyBlank = prev.length === 1 && prev[0].type === 'item' && !(prev[0] as ItemDraft).description.trim() && (prev[0] as ItemDraft).unit_price === 0
      const base = onlyBlank ? [] : prev
      return [...base, { id: crypto.randomUUID(), type: 'section' as const, title }, ...itemRows]
    })
    const priceTbdIds = new Set(itemRows.filter(r => r.unit_price === 0).map(r => r.id))
    if (priceTbdIds.size > 0) {
      setSuggestedItemIds(prev => new Set([...prev, ...priceTbdIds]))
    }
  }

  function updateRow(id: string, field: string, value: string | number) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row))
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(row => row.id !== id))
  }

  function addSectionAtTop() {
    setRows(prev => [{ id: crypto.randomUUID(), type: 'section' as const, title: '' }, ...prev])
  }

  function addItemToSection(sectionId: string) {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === sectionId)
      if (idx === -1) return prev
      let insertAt = idx + 1
      for (let i = idx + 1; i < prev.length; i++) {
        if (prev[i].type === 'section') break
        insertAt = i + 1
      }
      const newItem: ItemDraft = { id: crypto.randomUUID(), type: 'item', description: '', pricing_type: 'fixed', unit_price: 0, quantity: 1, notes: '' }
      const result = [...prev]
      result.splice(insertAt, 0, newItem)
      return result
    })
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

  async function handleSave(sendNow = false) {
    setSaving(true)
    setError('')
    try {
      let photoUrls: string[] = []
      if (photos.length > 0) {
        const fd = new FormData()
        photos.forEach(p => fd.append('photos', p.file))
        const photoRes = await fetch('/api/photos', { method: 'POST', body: fd })
        const photoData = await photoRes.json()
        if (!photoRes.ok) throw new Error(photoData.error || 'Failed to upload photos')
        photoUrls = photoData.paths
      }

      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            name: clientName, address: clientAddress, city: clientCity,
            state: clientState, zip: clientZip, phone: clientPhone, email: clientEmail,
          },
          transcript,
          notes,
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
          financingOptions,
          lumpSum,
          photoUrls,
          send: sendNow,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save quote')

      if (sendNow && clientEmail) {
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: data.quoteId }),
        })
      }

      router.push(`/quotes/${data.quoteId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New quote</h1>
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

          {existingClients.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select existing client</label>
              <select
                defaultValue=""
                onChange={handleExistingClientSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900"
              >
                <option value="">— Enter new client details below —</option>
                {existingClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} · {c.city}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Selecting a client auto-fills the fields. You can edit them before continuing.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                placeholder="Jane Smith" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <input value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                placeholder="123 Main St" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input value={clientCity} onChange={e => setClientCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                placeholder="Naples" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <input value={clientState} onChange={e => setClientState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                  placeholder="FL" maxLength={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
                <input value={clientZip} onChange={e => setClientZip(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                  placeholder="34102" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                placeholder="(555) 000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                placeholder="jane@example.com" />
            </div>
          </div>
          <button onClick={() => setStep(1)} disabled={!clientName || !clientEmail || !clientAddress}
            className="w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-60 flex items-center justify-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Voice / notes / photos */}
      {step === 1 && (
        <div className="space-y-4">
          <VoiceRecorder onTranscriptChange={onTranscriptChange} onDebugLog={debugMode ? addDebugLine : undefined} />

          <TemplateSuggestions
            transcript={transcript}
            onAddLineItem={addLineItemFromSuggestion}
            onAddSection={addSectionFromSuggestion}
          />

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Job notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400 resize-none"
              placeholder="Describe the work to be done…" />
          </div>

          {/* Photo upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Job photos</span>
                <span className="text-sm text-gray-400 ml-1">(optional, up to 5)</span>
              </div>
              {photos.length > 0 && photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-sm text-[#0E6E7E] hover:text-[#0A5560] font-medium"
                >
                  <Camera className="w-3.5 h-3.5" /> Add more
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {photos.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 hover:border-[#1A8A9C] rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:text-[#0E6E7E] transition group"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-[#EFF9FA] flex items-center justify-center transition">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">Add photos from camera or gallery</span>
                <span className="text-xs">JPEG, PNG, HEIC · max 10 MB each</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.preview} alt={`Job photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-[#1A8A9C] flex items-center justify-center text-gray-400 hover:text-[#0E6E7E] transition"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
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
              const firstSuggestedId = [...suggestedItemIds].find(id => {
                const row = rows.find(r => r.id === id)
                return row?.type === 'item' && (row as ItemDraft).unit_price === 0
              }) ?? null

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
                  {namedGroups.length > 0 && (
                    <button onClick={addSectionAtTop}
                      className="w-full border-2 border-dashed border-gray-300 hover:border-[#0E6E7E] text-gray-500 hover:text-[#0E6E7E] py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add section at top
                    </button>
                  )}
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
                          <FieldMicButton fieldType="section_title" onResult={t => updateRow(group.sectionRow!.id, 'title', t.trim())} />
                          <div className="flex flex-col shrink-0">
                            <button
                              onClick={() => moveSectionUp(group.sectionRow!.id)}
                              disabled={group.sectionRow!.id === firstSectionId}
                              className="flex items-center justify-center w-6 h-4 text-gray-400 hover:text-gray-600 disabled:opacity-25 transition">
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveSectionDown(group.sectionRow!.id)}
                              disabled={group.sectionRow!.id === lastSectionId}
                              className="flex items-center justify-center w-6 h-4 text-gray-400 hover:text-gray-600 disabled:opacity-25 transition">
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                          <button onClick={() => removeRow(group.sectionRow!.id)} className="text-red-400 hover:text-red-600 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className={group.sectionRow ? 'ml-3 pl-2 border-l-2 border-[#1A8A9C]/30 space-y-3' : 'space-y-3'}>
                        {group.items.map(li => {
                          const idx = itemIndex++
                          const isFirstItem = group.items.indexOf(li) === 0
                          const isLastItem = group.items.indexOf(li) === group.items.length - 1
                          const needsPrice = suggestedItemIds.has(li.id) && li.unit_price === 0
                          return (
                            <div key={li.id} className="p-4 border border-gray-200 rounded-lg space-y-3 bg-white">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-400">Item {idx + 1}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => moveItemUp(li.id)}
                                    disabled={isFirstItem}
                                    className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-gray-600 disabled:opacity-40 transition">
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => moveItemDown(li.id)}
                                    disabled={isLastItem}
                                    className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-gray-600 disabled:opacity-40 transition">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  {rows.length > 1 && (
                                    <button onClick={() => removeRow(li.id)} className="text-red-400 hover:text-red-600 flex items-center justify-center w-7 h-7">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input value={li.description} onChange={e => updateRow(li.id, 'description', e.target.value)}
                                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
                                  placeholder="Description of work" />
                                <FieldMicButton fieldType="description" onResult={t => updateRow(li.id, 'description', t.trim())} />
                              </div>
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
                                    ref={li.id === firstSuggestedId ? priceFocusRef : undefined}
                                    value={li.unit_price}
                                    onChange={e => updateRow(li.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                    className={`flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 text-gray-900 placeholder:text-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                      needsPrice
                                        ? 'border-[#0E6E7E] bg-[#EFF9FA] focus:ring-[#0E6E7E]'
                                        : 'border-gray-300 focus:ring-[#0E6E7E]'
                                    }`}
                                    placeholder={needsPrice ? 'Enter price' : 'Price'}
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
                                  <input type="number" value={li.quantity} onChange={e => updateRow(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    placeholder={getUnitLabel(li.pricing_type)} min={0} step={0.5} />
                                )}
                              </div>
                              <div className="text-right text-sm font-semibold text-gray-900">
                                {formatCurrency(calculateLineItemTotal(li.pricing_type, li.unit_price, li.quantity))}
                              </div>
                            </div>
                          )
                        })}
                        {group.sectionRow && (
                          <button onClick={() => addItemToSection(group.sectionRow!.id)}
                            className="w-full border-2 border-dashed border-gray-300 hover:border-[#0E6E7E] text-gray-500 hover:text-[#0E6E7E] py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                            <Plus className="w-4 h-4" /> Add line item
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            <div className="flex gap-2">
              <button onClick={addLineItem}
                className="flex-1 border-2 border-dashed border-gray-300 hover:border-[#0E6E7E] text-gray-500 hover:text-[#0E6E7E] py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add line item
              </button>
              <button onClick={addSection}
                className="border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-500 py-3 px-4 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add section at bottom
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Quote settings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax rate (%)</label>
              <div className="flex items-center gap-1.5">
                <input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400"
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
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400 resize-none" />
                <FieldMicButton
                  fieldType="payment_terms"
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
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400 resize-none"
                  placeholder="e.g. Price subject to change if additional issues found…" />
                <FieldMicButton
                  fieldType="caveats"
                  onResult={t => setCaveats(prev => {
                    const s = t.trim()
                    if (!prev) return s
                    return prev + (/\s$/.test(prev) ? '' : ' ') + s
                  })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Financing options</label>
              <div className="flex items-start gap-1.5">
                <textarea value={financingOptions} onChange={e => setFinancingOptions(e.target.value)} rows={3}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] text-gray-900 placeholder:text-gray-400 resize-none"
                  placeholder="e.g. 0% financing available for 12 months…" />
                <FieldMicButton
                  fieldType="financing_options"
                  onResult={t => setFinancingOptions(prev => {
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
            {contractorLogoUrl && (
              <div className="pb-4 border-b border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={contractorLogoUrl}
                  alt="Company logo"
                  className="h-10 w-auto object-contain max-w-[180px]"
                />
              </div>
            )}

            <h2 className="font-semibold text-gray-900">Quote summary</h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-900">{clientName}</p>
              <p>{clientAddress}, {clientCity}, {clientState} {clientZip}</p>
              <p>{clientPhone} · {clientEmail}</p>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              {computedRows
                .filter(row =>
                  row.type === 'section'
                    ? (row as SectionDraft).title.trim()
                    : (row as ItemDraft).description.trim()
                )
                .map(row => {
                  if (row.type === 'section') {
                    return (
                      <div key={row.id} className="pt-1.5 pb-0.5">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{(row as SectionDraft).title}</p>
                      </div>
                    )
                  }
                  const li = row as ItemDraft & { total: number }
                  return (
                    <div key={li.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {li.description}
                        {li.pricing_type !== 'fixed' && (
                          <span className="text-gray-400"> ({li.quantity} {getUnitLabel(li.pricing_type)})</span>
                        )}
                      </span>
                      {!lumpSum && <span className="font-medium text-gray-900">{formatCurrency(li.total)}</span>}
                    </div>
                  )
                })}
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

            {photos.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Job photos · {photos.length}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {photos.map((photo, i) => (
                    <div key={i} className="aspect-square rounded-md overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.preview} alt={`Job photo ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

          {confirmSend ? (
            <div className="bg-[#EFF9FA] border border-[#0E6E7E]/30 rounded-xl p-4 space-y-3">
              <p className="text-sm text-gray-800 font-medium">Before sending — please double-check all pricing is correct. Clients will see this quote as final.</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pricingChecked}
                  onChange={e => setPricingChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#0E6E7E]"
                />
                <span className="text-sm text-gray-700">I&apos;ve reviewed the pricing</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmSend(false); setPricingChecked(false) }}
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={!pricingChecked || saving}
                  className="flex-1 bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50">
                  {saving ? 'Sending…' : 'Confirm & send'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="border border-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Back</button>
              <button onClick={() => handleSave(false)} disabled={saving}
                className="flex-1 border border-[#0E6E7E] text-[#0E6E7E] font-medium py-2.5 rounded-lg text-sm hover:bg-[#EFF9FA] transition disabled:opacity-50">
                {saving ? 'Saving…' : 'Save as draft'}
              </button>
              <button
                onClick={() => { setConfirmSend(true); setPricingChecked(false) }}
                disabled={saving}
                className="flex-1 bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50">
                Send to client
              </button>
            </div>
          )}
        </div>
      )}

      {/* Debug overlay — visible only with ?debug=1; pointer-events:none on wrapper so page is always tappable */}
      {debugMode && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)', paddingRight: 8,
        }}>
          {debugExpanded ? (
            /* Expanded panel — anchored bottom-right, scrollable, never full-width so layout buttons remain tappable on the left */
            <div style={{
              pointerEvents: 'auto',
              width: 'min(360px, calc(100vw - 16px))',
              maxHeight: '40vh',
              background: 'rgba(0,0,0,0.90)',
              border: '1px solid rgba(100,170,255,0.4)',
              borderRadius: 8,
              display: 'flex', flexDirection: 'column',
              marginBottom: 4,
            }}>
              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.15)', flexShrink: 0,
              }}>
                <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 10 }}>
                  SR Debug · {debugLines.length} lines
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(debugLines.join('\n'))}
                    style={{
                      pointerEvents: 'auto',
                      color: '#4af', fontFamily: 'monospace', fontSize: 10,
                      background: 'none', border: '1px solid #4af',
                      borderRadius: 3, padding: '2px 7px', cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setDebugExpanded(false)}
                    style={{
                      pointerEvents: 'auto',
                      color: '#aaa', fontFamily: 'monospace', fontSize: 10,
                      background: 'none', border: '1px solid rgba(255,255,255,0.25)',
                      borderRadius: 3, padding: '2px 7px', cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {/* Log lines */}
              <div
                ref={debugOverlayRef}
                style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', minHeight: 0 }}
              >
                {debugLines.map((line, i) => (
                  <div key={i} style={{
                    color: '#fff', fontFamily: 'monospace', fontSize: 10,
                    lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Collapsed pill — tiny tap target in bottom-right corner only */
            <button
              onClick={() => setDebugExpanded(true)}
              style={{
                pointerEvents: 'auto',
                background: 'rgba(0,0,0,0.75)',
                color: '#4af',
                fontFamily: 'monospace',
                fontSize: 10,
                border: '1px solid rgba(100,170,255,0.5)',
                borderRadius: 6,
                padding: '5px 10px',
                cursor: 'pointer',
                marginBottom: 4,
              }}
            >
              SR Debug · {debugLines.length}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
