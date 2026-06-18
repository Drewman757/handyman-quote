import { EditQuoteClient } from './EditQuoteClient'

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EditQuoteClient id={id} />
}
