import Link from 'next/link'

export default function RequestAccessSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment received!</h1>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
          Thanks! We&apos;ve received your payment. You&apos;ll get a welcome email within 24 hours
          once your account is approved.
        </p>
        <p className="text-gray-400 text-xs mt-6">
          Questions?{' '}
          <Link href="mailto:Lineagelabsllc@gmail.com" className="text-[#0E6E7E] hover:underline">
            Lineagelabsllc@gmail.com
          </Link>
        </p>
      </div>
    </div>
  )
}
