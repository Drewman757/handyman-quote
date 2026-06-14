'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Tag } from 'lucide-react'
import { formatCurrency, getPricingLabel } from '@/lib/utils/pricing'
import type { PricingTemplate, PricingType } from '@/lib/types'

export default function PricingTemplatesPage() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<PricingTemplate[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'General', pricing_type: 'fixed' as PricingType, unit_price: 0, unit_label: '', description: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: contractor } = await supabase.from('contractors').select('id').eq('user_id', user?.id).single()
    const { data } = await supabase.from('pricing_templates').select('*').eq('contractor_id', contractor?.id).order('category').order('name')
    setTemplates(data || [])
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: contractor } = await supabase.from('contractors').select('id').eq('user_id', user?.id).single()
    await supabase.from('pricing_templates').insert({ ...form, contractor_id: contractor?.id })
    setForm({ name: '', category: 'General', pricing_type: 'fixed', unit_price: 0, unit_label: '', description: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('pricing_templates').delete().eq('id', id)
    load()
  }

  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, PricingTemplate[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pricing templates</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition">
          <Plus className="w-4 h-4" />Add template
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">New pricing template</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Interior painting" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Painting" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pricing type</label>
              <select value={form.pricing_type} onChange={e => setForm(f => ({ ...f, pricing_type: e.target.value as PricingType }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="fixed">Flat rate</option>
                <option value="sqft">Per sq ft</option>
                <option value="hourly">Per hour</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit price ($)</label>
              <input type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))} min={0} step={0.01}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Add template'}
            </button>
          </div>
        </form>
      )}

      {!templates.length ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No templates yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your common services and pricing to speed up quoting.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{getPricingLabel(t.pricing_type)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(t.unit_price)}</p>
                    <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
