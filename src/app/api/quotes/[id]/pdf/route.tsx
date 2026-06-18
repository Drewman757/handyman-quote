import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer'
import { formatCurrency, getUnitLabel } from '@/lib/utils/pricing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Read the Lineage Labs logo once at cold-start. Falls back gracefully if the
// file isn't accessible in the Lambda environment.
function readLineageLogo(): string {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'lineage-labs-logo.jpg'))
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch {
    return ''
  }
}
const lineageLogoSrc = readLineageLogo()

const s = StyleSheet.create({
  page: { paddingBottom: 56, fontFamily: 'Helvetica', fontSize: 10, color: '#111827', backgroundColor: '#fff' },
  header: { backgroundColor: '#ea580c', paddingVertical: 28, paddingHorizontal: 48, flexDirection: 'column', alignItems: 'center' },
  contractorLogo: { width: 160, height: 52, objectFit: 'contain', marginBottom: 10 },
  companyName: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#fff', marginBottom: 4, textAlign: 'center' },
  license: { fontSize: 10, color: '#fed7aa', textAlign: 'center' },
  body: { paddingHorizontal: 48, paddingTop: 28 },
  metaRow: { flexDirection: 'row', marginBottom: 24 },
  metaCol: { flex: 1, paddingRight: 12 },
  metaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9ca3af', letterSpacing: 0.8, marginBottom: 5 },
  metaName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 },
  metaText: { fontSize: 9, color: '#4b5563', marginBottom: 2 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#111827', paddingBottom: 6, marginBottom: 4 },
  thDesc: { flex: 4, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280' },
  thQty: { width: 48, textAlign: 'center', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280' },
  thUnit: { width: 72, textAlign: 'right', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280' },
  thTotal: { width: 72, textAlign: 'right', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280' },
  row: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tdDesc: { flex: 4 },
  tdDescMain: { fontSize: 10, color: '#111827' },
  tdDescSub: { fontSize: 8, color: '#9ca3af', marginTop: 2 },
  tdQty: { width: 48, textAlign: 'center', fontSize: 10, color: '#374151' },
  tdUnit: { width: 72, textAlign: 'right', fontSize: 10, color: '#374151' },
  tdTotal: { width: 72, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' },
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  totalsBox: { width: 200 },
  trow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  tlabel: { fontSize: 10, color: '#6b7280' },
  tvalue: { fontSize: 10, color: '#374151' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: '#111827', paddingTop: 6, marginTop: 4 },
  grandLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#111827' },
  grandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#111827' },
  terms: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  termsTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9ca3af', letterSpacing: 0.8, marginBottom: 5 },
  termsBody: { fontSize: 9, color: '#6b7280', lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 20, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 },
  footerText: { fontSize: 8, color: '#9ca3af' },
  footerBrand: { flexDirection: 'row', alignItems: 'center' },
  lineageLogo: { height: 11, width: 32, objectFit: 'contain', marginRight: 4 },
})

type LI = { id: string; description: string; pricing_type: string; unit_price: number; quantity: number; total: number; sort_order: number }
type QuoteDoc = {
  quote_number: string; created_at: string
  subtotal: number; tax_rate: number; tax_amount: number; total: number
  payment_terms: string | null; caveats: string | null
  client: { name: string; address: string; city: string; state: string; zip: string; phone: string; email: string }
  lump_sum: boolean
  contractor: { business_name: string; owner_name: string; phone: string; email: string; license_number: string | null; logo_url: string | null; address: string | null; website: string | null; insurance_number: string | null }
  line_items: LI[]
}

function QuotePDF({ q, contractorLogoSrc }: { q: QuoteDoc; contractorLogoSrc: string | null }) {
  const date = new Date(q.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const items = [...q.line_items].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Document title={`Quote ${q.quote_number}`} author={q.contractor.business_name}>
      <Page size="LETTER" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          {contractorLogoSrc ? (
            <Image src={contractorLogoSrc} style={s.contractorLogo} />
          ) : null}
          <Text style={s.companyName}>{q.contractor.business_name}</Text>
          {q.contractor.address ? (
            <Text style={s.license}>{q.contractor.address}</Text>
          ) : null}
          <Text style={s.license}>{q.contractor.phone} · {q.contractor.email}</Text>
          {q.contractor.website ? (
            <Text style={s.license}>{q.contractor.website}</Text>
          ) : null}
          {q.contractor.license_number ? (
            <Text style={s.license}>License #{q.contractor.license_number}</Text>
          ) : null}
          {q.contractor.insurance_number ? (
            <Text style={s.license}>Insurance #{q.contractor.insurance_number}</Text>
          ) : null}
        </View>

        {/* ── Body ── */}
        <View style={s.body}>
          <View style={s.metaRow}>
            <View style={s.metaCol}>
              <Text style={s.metaLabel}>QUOTE</Text>
              <Text style={s.metaName}>{q.quote_number}</Text>
              <Text style={s.metaText}>{date}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.metaLabel}>PREPARED FOR</Text>
              <Text style={s.metaName}>{q.client.name}</Text>
              <Text style={s.metaText}>{q.client.address}</Text>
              <Text style={s.metaText}>{q.client.city}, {q.client.state} {q.client.zip}</Text>
              <Text style={s.metaText}>{q.client.phone}</Text>
              <Text style={s.metaText}>{q.client.email}</Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.metaLabel}>FROM</Text>
              <Text style={s.metaName}>{q.contractor.business_name}</Text>
              {q.contractor.owner_name ? <Text style={s.metaText}>{q.contractor.owner_name}</Text> : null}
              {q.contractor.address ? <Text style={s.metaText}>{q.contractor.address}</Text> : null}
              <Text style={s.metaText}>{q.contractor.phone}</Text>
              <Text style={s.metaText}>{q.contractor.email}</Text>
              {q.contractor.website ? <Text style={s.metaText}>{q.contractor.website}</Text> : null}
            </View>
          </View>

          <View style={s.divider} />

          {q.lump_sum ? null : (
            <>
              <View style={s.tableHeader}>
                <Text style={s.thDesc}>DESCRIPTION</Text>
                <Text style={s.thQty}>QTY</Text>
                <Text style={s.thUnit}>UNIT PRICE</Text>
                <Text style={s.thTotal}>AMOUNT</Text>
              </View>

              {items.map((li) => (
                <View key={li.id} style={s.row}>
                  <View style={s.tdDesc}>
                    <Text style={s.tdDescMain}>{li.description}</Text>
                    {li.pricing_type !== 'fixed' ? (
                      <Text style={s.tdDescSub}>
                        {li.quantity} {getUnitLabel(li.pricing_type as 'sqft' | 'hourly')} @ {formatCurrency(li.unit_price)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={s.tdQty}>{li.pricing_type !== 'fixed' ? String(li.quantity) : '—'}</Text>
                  <Text style={s.tdUnit}>{formatCurrency(li.unit_price)}</Text>
                  <Text style={s.tdTotal}>{formatCurrency(li.total)}</Text>
                </View>
              ))}
            </>
          )}

          <View style={s.totalsWrap}>
            <View style={s.totalsBox}>
              {!q.lump_sum && q.tax_rate > 0 ? (
                <>
                  <View style={s.trow}>
                    <Text style={s.tlabel}>Subtotal</Text>
                    <Text style={s.tvalue}>{formatCurrency(q.subtotal)}</Text>
                  </View>
                  <View style={s.trow}>
                    <Text style={s.tlabel}>Tax ({(q.tax_rate * 100).toFixed(1)}%)</Text>
                    <Text style={s.tvalue}>{formatCurrency(q.tax_amount)}</Text>
                  </View>
                </>
              ) : null}
              <View style={s.grandRow}>
                <Text style={s.grandLabel}>Total</Text>
                <Text style={s.grandValue}>{formatCurrency(q.total)}</Text>
              </View>
            </View>
          </View>

          {q.payment_terms || q.caveats ? (
            <View style={s.terms}>
              {q.payment_terms ? (
                <>
                  <Text style={s.termsTitle}>PAYMENT TERMS</Text>
                  <Text style={s.termsBody}>{q.payment_terms}</Text>
                </>
              ) : null}
              {q.caveats ? (
                <View style={{ marginTop: q.payment_terms ? 10 : 0 }}>
                  <Text style={s.termsTitle}>NOTES</Text>
                  <Text style={s.termsBody}>{q.caveats}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* ── Footer (fixed, repeats on every page) ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{q.contractor.business_name} · {q.contractor.email}</Text>

          {/* Lineage Labs watermark */}
          <View style={s.footerBrand}>
            {lineageLogoSrc ? (
              <Image src={lineageLogoSrc} style={s.lineageLogo} />
            ) : null}
            <Text style={s.footerText}>Powered by Lineage Labs, LLC</Text>
          </View>

          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data: quote, error } = await supabaseAdmin
      .from('quotes')
      .select('*, client:clients(*), line_items(*), contractor:contractors(*)')
      .eq('id', id)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Download contractor logo as base64 so the PDF renderer doesn't need to
    // make outbound HTTP requests (more reliable in serverless environments).
    let contractorLogoSrc: string | null = null
    const logoUrl = (quote.contractor as Record<string, unknown>).logo_url as string | null
    if (logoUrl) {
      try {
        // Strip query params and extract the storage path
        const urlObj = new URL(logoUrl)
        const storagePath = urlObj.pathname.split('/storage/v1/object/public/contractor-logos/')[1]
        if (storagePath) {
          const { data: logoData } = await supabaseAdmin.storage
            .from('contractor-logos')
            .download(storagePath)
          if (logoData) {
            const buf = Buffer.from(await logoData.arrayBuffer())
            contractorLogoSrc = `data:${logoData.type || 'image/jpeg'};base64,${buf.toString('base64')}`
          }
        }
      } catch {
        // Non-fatal — PDF renders without the logo if download fails
      }
    }

    const buf = await renderToBuffer(
      <QuotePDF q={quote as unknown as QuoteDoc} contractorLogoSrc={contractorLogoSrc} />
    )

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quote-${quote.quote_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[pdf]', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
