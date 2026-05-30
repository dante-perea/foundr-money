import { connection } from 'next/server'
import { requireOwnerId } from '@/lib/money/owner'
import { buildScheduleCCsv } from '@/lib/money/export'

// GET /api/export/schedule-c?year=YYYY → text/csv attachment.
// Owner-scoped. Data prep, not tax advice.
export async function GET(req: Request): Promise<Response> {
  await connection()
  const owner = await requireOwnerId()

  const url = new URL(req.url)
  const raw = url.searchParams.get('year')
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  const year =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
      ? parsed
      : new Date().getFullYear()

  const csv = await buildScheduleCCsv(owner, year)

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="foundr-money-schedule-c-${year}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
