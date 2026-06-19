import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — QuoteBuilder',
}

export default function TermsPage() {
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

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: June 18, 2026 · Lineage Labs LLC</p>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or using QuoteBuilder (the "Service"), you agree to be bound by these Terms of Service and our{' '}
              <Link href="/privacy" className="text-[#0E6E7E] hover:underline">Privacy Policy</Link>.
              If you do not agree, do not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">2. Service Description</h2>
            <p>
              QuoteBuilder is a professional quoting and estimating tool for handymen and contractors, operated by Lineage Labs LLC
              ("we," "us," "Lineage Labs"). We provide this Service on a subscription basis and reserve the right to modify,
              suspend, or discontinue features at any time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-bold text-gray-900">3. Data Use &amp; License</h2>

            <p>
              When you use QuoteBuilder, you and your business ("you," "Contractor") enter information including but not limited
              to: business details, license and insurance information, client/customer names and contact information, job details,
              pricing, and quote content ("Your Data").
            </p>

            <div className="space-y-4 pl-4 border-l-2 border-gray-100">
              <div>
                <p className="font-semibold text-gray-900 mb-1">Ownership</p>
                <p>
                  You retain ownership of Your Data. We do not claim ownership of your business information or your
                  clients&rsquo; information.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">License to us</p>
                <p className="mb-2">
                  You grant Lineage Labs LLC a non-exclusive, worldwide license to access, store, process, and use Your Data to:
                </p>
                <ul className="list-disc list-outside ml-5 space-y-1">
                  <li>Operate, maintain, and provide the QuoteBuilder service to you;</li>
                  <li>Provide customer support and troubleshoot issues;</li>
                  <li>
                    Improve QuoteBuilder, including training, tuning, or evaluating AI features used to generate quotes,
                    sections, or recommendations.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">Your responsibility for client data</p>
                <p>
                  If you enter information about your own clients or customers (names, addresses, phone numbers, job details,
                  etc.), you represent that you have the right to do so and that your use of QuoteBuilder to store and process
                  that information complies with any agreements or obligations you have to those clients.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">No sale of data</p>
                <p>We do not sell Your Data to third parties.</p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">Admin access</p>
                <p>
                  Authorized Lineage Labs administrators may access account and quote data for the purposes of customer support,
                  fraud/abuse prevention, billing, and service operation.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">Account termination</p>
                <p>
                  If your account is suspended, cancelled, or deleted, we retain Your Data so that your account and quote
                  history can be restored if you reactivate. We do not automatically delete Your Data after cancellation. You
                  may request deletion of Your Data at any time by contacting{' '}
                  <a href="mailto:support@lineagelabsllc.com" className="text-[#0E6E7E] hover:underline">
                    support@lineagelabsllc.com
                  </a>
                  , and we will delete it within a reasonable time after verifying the request, except where we are required to
                  retain certain records (e.g., billing/payment records) for legal or accounting purposes.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">4. Subscription and Payment</h2>
            <p>
              QuoteBuilder is offered on a monthly subscription basis. Fees are billed in advance. You may cancel at any time;
              cancellation takes effect at the end of the current billing period. We reserve the right to change pricing with
              reasonable notice. All payments are processed by Stripe.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">5. Acceptable Use</h2>
            <p>
              You agree not to use the Service for any unlawful purpose, to send spam or fraudulent content, to attempt to
              reverse-engineer or disrupt the Service, or to impersonate others. We reserve the right to suspend or terminate
              accounts that violate these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">6. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Lineage Labs LLC shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the Service. Our total liability shall not exceed the
              amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">7. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by email or by posting a notice
              in the app. Continued use of the Service after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">8. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{' '}
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
