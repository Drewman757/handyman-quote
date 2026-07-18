import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { SignOutButton } from '@/components/SignOutButton'

export const dynamic = 'force-dynamic'

export default async function AccountSuspendedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/account-suspended')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Your account has been suspended</h1>
        <p className="text-sm text-gray-600 mt-4 leading-relaxed">
          Contact support for more information.
        </p>
        <Link
          href="mailto:Lineagelabsllc@gmail.com"
          className="mt-6 inline-block text-sm font-medium text-[#0E6E7E] hover:underline"
        >
          Lineagelabsllc@gmail.com
        </Link>
        <div className="mt-6 pt-6 border-t border-gray-100 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
