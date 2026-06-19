import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — QuoteBuilder',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="QuoteBuilder" className="w-9 h-9 rounded-lg object-contain" />
          <span className="font-bold text-gray-900 text-lg">QuoteBuilder</span>
        </div>

        <Link href="/" className="text-sm text-[#0E6E7E] hover:underline mb-6 inline-block">
          ← Back to QuoteBuilder
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: June 18, 2026 · Lineage Labs LLC</p>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <p>
              Lineage Labs LLC ("we," "us," "Lineage Labs") operates QuoteBuilder. This Privacy Policy explains what information
              we collect, how we use it, and how we protect it when you use QuoteBuilder.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-bold text-gray-900">1. Information We Collect</h2>
            <div className="space-y-3 pl-4 border-l-2 border-gray-100">
              <div>
                <p className="font-semibold text-gray-900 mb-1">Account information</p>
                <p>
                  When you sign up, we collect your name, email address, phone number, business name, and a hashed password.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Business and quote data</p>
                <p>
                  When you use QuoteBuilder, you enter business details, client and customer names and contact information,
                  job descriptions, pricing, and quote content. We store this data on your behalf to provide the Service.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Payment information</p>
                <p>
                  Payments are processed by Stripe. We do not store your full credit card number — only a customer reference
                  provided by Stripe for billing management.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Usage data</p>
                <p>
                  We may collect basic usage information (pages visited, features used) to help us improve the Service.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">2. How We Use Your Information</h2>
            <ul className="list-disc list-outside ml-5 space-y-1.5">
              <li>To provide, maintain, and improve QuoteBuilder;</li>
              <li>To process payments and manage your subscription;</li>
              <li>To send service-related communications (account approval, billing, support);</li>
              <li>To provide customer support;</li>
              <li>
                To train, tune, or evaluate AI features used to generate quotes, sections, or recommendations within
                QuoteBuilder;
              </li>
              <li>To detect and prevent fraud or abuse.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">3. AI Features</h2>
            <p>
              QuoteBuilder uses AI to help generate quote content, suggestions, and recommendations. Your data — including job
              descriptions and pricing — may be used to train, tune, or evaluate these AI features within QuoteBuilder. We do
              not share your identifiable data with third-party AI providers for their own independent model training.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">4. Data Sharing</h2>
            <p>We do not sell your personal data to third parties. We may share data with:</p>
            <ul className="list-disc list-outside ml-5 space-y-1.5">
              <li><span className="font-medium text-gray-800">Stripe</span> — payment processing;</li>
              <li><span className="font-medium text-gray-800">Supabase</span> — database and authentication hosting;</li>
              <li><span className="font-medium text-gray-800">Resend</span> — transactional email delivery;</li>
              <li><span className="font-medium text-gray-800">Law enforcement</span> — if required by applicable law or to protect our legal rights.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">5. Data Retention</h2>
            <p>
              We retain your data as long as your account is active and for a reasonable period afterward to allow account
              reactivation. Cancelling your account does not automatically delete your data. You may request deletion at any
              time — we will process your request within a reasonable time, except where retention is required by law or for
              billing purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">6. Security</h2>
            <p>
              We use industry-standard security practices including encrypted connections (HTTPS) and access controls. No
              method of transmission over the internet is 100% secure; we cannot guarantee absolute security of your data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">7. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data at any time by contacting us. If you
              are a resident of a jurisdiction with specific data protection rights (such as California or the EU/EEA),
              additional rights may apply — contact us and we will assist you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting
              a notice in the app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">9. Contact</h2>
            <p>
              For privacy questions or data requests, contact us at{' '}
              <a href="mailto:support@lineagelabsllc.com" className="text-[#0E6E7E] hover:underline">
                support@lineagelabsllc.com
              </a>.
            </p>
          </section>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">© 2026 Lineage Labs LLC. All rights reserved.</p>
      </div>
    </div>
  )
}
