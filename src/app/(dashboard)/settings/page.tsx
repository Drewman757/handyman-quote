'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImageIcon } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    business_name: '', owner_name: '', phone: '', email: '',
    license_number: '', default_payment_terms: 'Payment due upon completion.', default_caveats: '', financing_options: ''
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('contractors').select('*').eq('user_id', user?.id).single()
      if (data) {
        setForm(f => ({ ...f, ...data }))
        if (data.logo_url) setLogoUrl(data.logo_url)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/logos', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.logoUrl) {
        setLogoUrl(data.logoUrl)
      } else {
        alert(data.error || 'Upload failed')
      }
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

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

      {/* Logo card — separate from the main form so it saves instantly */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Company logo</h2>
        <p className="text-sm text-gray-500">Your logo appears on PDF quotes and in the app. PNG, JPG, or WEBP · max 2 MB.</p>
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain p-2" />
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-300" />
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="block text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50 transition"
            >
              {logoUploading ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
            </button>
            {logoUrl && !logoUploading && (
              <p className="text-xs text-green-600">Logo saved ✓</p>
            )}
          </div>
        </div>
      </div>

      {/* Main business info form */}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900" />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default payment terms</label>
          <textarea value={form.default_payment_terms} onChange={e => setForm(f => ({ ...f, default_payment_terms: e.target.value }))}
            rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default caveats</label>
          <textarea value={form.default_caveats} onChange={e => setForm(f => ({ ...f, default_caveats: e.target.value }))}
            rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-gray-900"
            placeholder="Standard notes added to every quote…" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Financing options</label>
          <textarea value={form.financing_options} onChange={e => setForm(f => ({ ...f, financing_options: e.target.value }))}
            rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-gray-900"
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
