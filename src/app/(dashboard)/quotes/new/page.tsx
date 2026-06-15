'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { VoiceRecorder } from '@/components/voice/VoiceRecorder'
import { TemplateSuggestions } from '@/components/voice/TemplateSuggestions'
import type { AddLineItemPayload } from '@/components/voice/TemplateSuggestions'
import { calculateLineItemTotal, calculateQuoteTotals, formatCurrency, getUnitLabel } from '@/lib/utils/pricing'
import type { PricingType } from '@/lib/types'
import { Plus, Trash2, ChevronRight, ChevronLeft, Camera, X, ImageIcon } from 'lucide-react'

interface LineItemDraft {
  id: string
  description: string
  pricing_type: PricingType
  unit_price: number
  quantity: number
  notes: string
}

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const priceFocusRef = useRef<HTMLInputElement>(null)
  const [suggestedItemIds, setSuggestedItemIds] = useState<Set<string>>(new Set())

  // Contractor data loaded on mount
  const [existingClients, setExistingClients] = useState<ExistingClient[]>([])
  const [contractorLogoUrl, setContractorLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadContractorData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: contractor } = await supabase
        .from('contractors')
        .select('id, logo_url')
        .eq('user_id', user.id)
        .single()
      if (!contractor) return
      if (contractor.logo_url) setContractorLogoUrl(contractor.logo_url)
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

  // Photos (stored as File + blob preview URL)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])

  // Line items
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([{
    id: crypto.randomUUID(), description: '', pricing_type: 'fixed', unit_price: 0, quantity: 1, notes: ''
  }])

  // Quote settings
  const [taxRate, setTaxRate] = useState(0)
  const [paymentTerms, setPaymentTerms] = useState('Payment due upon completion.')
  const [caveats, setCaveats] = useState('')

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
    setLineItems(prev => [...prev, {
      id: crypto.randomUUID(), description: '', pricing_type: 'fixed', unit_price: 0, quantity: 1, notes: ''
    }])
  }

  function addLineItemFromSuggestion({ description, pricing_type, unit_price }: AddLineItemPayload) {
    const newId = crypto.randomUUID()
    setLineItems(prev => {
      const onlyBlank = prev.length === 1 && !prev[0].description.trim() && prev[0].unit_price === 0
      const base = onlyBlank ? [] : prev
      return [...base, {
        id: newId,
        description,
        pricing_type,
        unit_price,
        quantity: 1,
        notes: '',
      }]
    })
    if (unit_price === 0) {
      setSuggestedItemIds(prev => new Set([...prev, newId]))
    }
  }

  function updateLineItem(id: string, field: string, value: string | number) {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li))
  }

  function removeLineItem(id: string) {
    setLineItems(prev => prev.filter(li => li.id !== id))
  }

  const computed = lineItems.map(li => ({
    ...li,
    total: calculateLineItemTotal(li.pricing_type, li.unit_price, li.quantity)
  }))
  const { subtotal, taxAmount, total } = calculateQuoteTotals(
    computed.map(li => ({ ...li, sort_order: 0, id: li.id, quote_id: '' })),
    taxRate / 100
  )

  async function handleSave(sendNow = false) {
    setSaving(true)
    setError('')
    try {
      // Upload photos first (if any)
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
          lineItems: computed.filter(li => li.description).map(li => ({
            description: li.description,
            pricing_type: li.pricing_type,
            unit_price: li.unit_price,
            quantity: li.quantity,
            total: li.total,
            notes: li.notes,
          })),
          taxRate,
          paymentTerms,
          caveats,
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
            <div className={`flex items-center gap-1.5 text-sm font-medium ${i === step ? 'text-orange-600' : i < step ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${i === step ? 'bg-orange-500 text-white' : i < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
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

          {/* Existing client selector */}
          {existingClients.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select existing client</label>
              <select
                defaultValue=""
                onChange={handleExistingClientSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                placeholder="Jane Smith" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <input value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                placeholder="123 Main St" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input value={clientCity} onChange={e => setClientCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                placeholder="Naples" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <input value={clientState} onChange={e => setClientState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                  placeholder="FL" maxLength={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
                <input value={clientZip} onChange={e => setClientZip(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                  placeholder="34102" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                placeholder="(555) 000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                placeholder="jane@example.com" />
            </div>
          </div>
          <button onClick={() => setStep(1)} disabled={!clientName || !clientEmail || !clientAddress}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-60 flex items-center justify-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Voice / notes / photos */}
      {step === 1 && (
        <div className="space-y-4">
          <VoiceRecorder onTranscriptChange={onTranscriptChange} />

          <TemplateSuggestions
            transcript={transcript}
            onAddLineItem={addLineItemFromSuggestion}
          />

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Job notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400 resize-none"
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
                  className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
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
                className="w-full border-2 border-dashed border-gray-200 hover:border-orange-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:text-orange-400 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-orange-50 flex items-center justify-center transition">
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
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-orange-300 flex items-center justify-center text-gray-400 hover:text-orange-400 transition"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Back</button>
            <button onClick={() => setStep(2)} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
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
              const firstSuggestedId = [...suggestedItemIds].find(id =>
                lineItems.find(li => li.id === id && li.unit_price === 0)
              ) ?? null
              return lineItems.map((li, idx) => (
                <div key={li.id} className="p-4 border border-gray-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Item {idx + 1}</span>
                  {lineItems.length > 1 && (
                    <button onClick={() => removeLineItem(li.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input value={li.description} onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                  placeholder="Description of work" />
                <div className="grid grid-cols-3 gap-2">
                  <select value={li.pricing_type} onChange={e => updateLineItem(li.id, 'pricing_type', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900">
                    <option value="fixed">Flat rate</option>
                    <option value="sqft">Per sq ft</option>
                    <option value="hourly">Per hour</option>
                  </select>
                  {(() => {
                    const needsPrice = suggestedItemIds.has(li.id) && li.unit_price === 0
                    return (
                      <input
                        type="number"
                        ref={li.id === firstSuggestedId ? priceFocusRef : undefined}
                        value={li.unit_price}
                        onChange={e => updateLineItem(li.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 text-gray-900 placeholder:text-gray-400 ${
                          needsPrice
                            ? 'border-orange-400 bg-orange-50 focus:ring-orange-500'
                            : 'border-gray-300 focus:ring-orange-500'
                        }`}
                        placeholder={needsPrice ? 'Enter price' : 'Price'}
                        min={0} step={0.01}
                      />
                    )
                  })()}
                  {li.pricing_type !== 'fixed' && (
                    <input type="number" value={li.quantity} onChange={e => updateLineItem(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                      placeholder={getUnitLabel(li.pricing_type)} min={0} step={0.5} />
                  )}
                </div>
                <div className="text-right text-sm font-semibold text-gray-900">
                  {formatCurrency(calculateLineItemTotal(li.pricing_type, li.unit_price, li.quantity))}
                </div>
              </div>
              ))
            })()}
            <button onClick={addLineItem}
              className="w-full border-2 border-dashed border-gray-300 hover:border-orange-400 text-gray-500 hover:text-orange-500 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add line item
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Quote settings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax rate (%)</label>
              <input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                min={0} max={100} step={0.1} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment terms</label>
              <textarea value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caveats / notes to client</label>
              <textarea value={caveats} onChange={e => setCaveats(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400 resize-none"
                placeholder="e.g. Price subject to change if additional issues found…" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Back</button>
            <button onClick={() => setStep(3)} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
              Review <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            {/* Contractor logo preview */}
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
              {computed.filter(li => li.description).map(li => (
                <div key={li.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{li.description}
                    {li.pricing_type !== 'fixed' && <span className="text-gray-400"> ({li.quantity} {getUnitLabel(li.pricing_type)})</span>}
                  </span>
                  <span className="font-medium text-gray-900">{formatCurrency(li.total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
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

            {/* Photo preview */}
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

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="border border-gray-300 text-gray-700 font-medium px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Back</button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="flex-1 border border-orange-400 text-orange-600 font-medium py-2.5 rounded-lg text-sm hover:bg-orange-50 transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Save as draft'}
            </button>
            <button onClick={() => handleSave(true)} disabled={saving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50">
              {saving ? 'Sending…' : 'Send to client'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
