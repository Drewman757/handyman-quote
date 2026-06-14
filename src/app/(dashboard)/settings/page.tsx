'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    business_name: '', owner_name: '', phone: '', email: '',
    license_number: '', default_payment_terms: 'Payment due upon completion.', default_caveats: '', financing_options: ''
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('contractors').select('*').eq('user_id', user?.id).single()
      if (data) setForm({ ...form, ...data })
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('contractors').update(form).eq('user_id', user?.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Business information</h2>
        {[
          { label: 'Business name', key: 'business_name' },
          { label: 'Your name', key: 'owner_name' },
          { label: 'Phone', key: 'phone' },
          { label: 'Email', key: 'email' },
          { label: 'License number', key: 'license_number' },
        ].map(({ label, key }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default payment terms</label>
          <textarea value={form.default_payment_terms} onChange={e => setForm(f => ({ ...f, default_payment_terms: e.target.value }))}
            rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default caveats</label>
          <textarea value={form.default_caveats} onChange={e => setForm(f => ({ ...f, default_caveats: e.target.value }))}
            rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            placeholder="Standard notes added to every quote…" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Financing options</label>
          <textarea value={form.financing_options} onChange={e => setForm(f => ({ ...f, financing_options: e.target.value }))}
            rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            placeholder="e.g. 0% financing available through GreenSky…" />
        </div>
        <button type="submit" disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50">
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
