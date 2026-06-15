'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Tag, Pencil, Check, X } from 'lucide-react'
import { formatCurrency, getPricingLabel } from '@/lib/utils/pricing'
import type { PricingTemplate, PricingType } from '@/lib/types'

const emptyForm = { name: '', category: 'General', pricing_type: 'fixed' as PricingType, unit_price: 0, unit_label: '', description: '' }

export default function PricingTemplatesPage() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<PricingTemplate[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm })
  const [editSaving, setEditSaving] = useState(false)

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
    setForm({ ...emptyForm })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('pricing_templates').delete().eq('id', id)
    load()
  }

  function startEdit(t: PricingTemplate) {
    setEditingId(t.id)
    setEditForm({
      name: t.name,
      category: t.category,
      pricing_type: t.pricing_type,
      unit_price: t.unit_price,
      unit_label: t.unit_label || '',
      description: t.description || '',
    })
    setShowForm(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditSaving(true)
    await supabase.from('pricing_templates').update({
      name: editForm.name,
      category: editForm.category,
      pricing_type: editForm.pricing_type,
      unit_price: editForm.unit_price,
    }).eq('id', editingId)
    setEditingId(null)
    setEditSaving(false)
    load()
  }

  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, PricingTemplate[]>)

  const unpricedCount = templates.filter(t => t.unit_price === 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing templates</h1>
          {unpricedCount > 0 && (
            <p className="text-sm text-orange-600 mt-0.5">
              {unpricedCount} template{unpricedCount > 1 ? 's' : ''} need{unpricedCount === 1 ? 's' : ''} a price — click the pencil icon to set one
            </p>
          )}
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null) }}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
                placeholder="Interior painting" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
                placeholder="Painting" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pricing type</label>
              <select value={form.pricing_type} onChange={e => setForm(f => ({ ...f, pricing_type: e.target.value as PricingType }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900">
                <option value="fixed">Flat rate</option>
                <option value="sqft">Per sq ft</option>
                <option value="hourly">Per hour</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit price ($)</label>
              <input type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))} min={0} step={0.01}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900" />
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
          <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map(t => (
                <div key={t.id}>
                  {editingId === t.id ? (
                    <form onSubmit={handleUpdate} className="px-5 py-4 space-y-3 bg-orange-50/50 border-l-2 border-orange-400">
                      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Editing — {t.name}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                          <input
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            required
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                          <input
                            value={editForm.category}
                            onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pricing type</label>
                          <select
                            value={editForm.pricing_type}
                            onChange={e => setEditForm(f => ({ ...f, pricing_type: e.target.value as PricingType }))}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
                          >
                            <option value="fixed">Flat rate</option>
                            <option value="sqft">Per sq ft</option>
                            <option value="hourly">Per hour</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Price ($){editForm.unit_price === 0 && <span className="ml-1 text-orange-500 font-semibold">← set a price</span>}
                          </label>
                          <input
                            type="number"
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus={t.unit_price === 0}
                            value={editForm.unit_price}
                            onChange={e => setEditForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))}
                            min={0} step={0.01}
                            className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 ${
                              editForm.unit_price === 0 ? 'border-orange-400 bg-orange-50' : 'border-gray-300'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> {editSaving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className={`flex items-center justify-between px-5 py-3.5 ${t.unit_price === 0 ? 'bg-orange-50/40' : ''}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400">{getPricingLabel(t.pricing_type)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {t.unit_price === 0 ? (
                          <span className="text-xs font-semibold text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">Price TBD</span>
                        ) : (
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(t.unit_price)}</p>
                        )}
                        <button
                          onClick={() => startEdit(t)}
                          className="text-gray-300 hover:text-blue-500 transition"
                          title="Edit template"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-gray-300 hover:text-red-500 transition"
                          title="Delete template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
