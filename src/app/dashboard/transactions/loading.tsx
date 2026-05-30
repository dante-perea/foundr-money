// Painted immediately on navigation under PPR — mirrors the real layout so the
// transition feels instant before the owner-scoped data resolves.
export default function TransactionsLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-3 w-28 rounded bg-line" />
        <div className="mt-3 h-8 w-96 max-w-full rounded bg-line" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-line/70" />
      </div>

      <div className="mb-4 flex items-center gap-4 border-b border-line pb-2">
        <div className="h-4 w-12 rounded bg-line" />
        <div className="h-4 w-20 rounded bg-line/70" />
      </div>

      <div className="overflow-hidden rounded-md border border-line bg-surface">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[5rem_1fr_8rem] items-center gap-4 border-b border-line px-4 py-4 sm:grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1.6fr)_8rem_auto]"
          >
            <div className="h-3 w-12 rounded bg-line/70" />
            <div className="h-4 w-32 rounded bg-line" />
            <div className="hidden h-3 w-40 rounded bg-line/60 sm:block" />
            <div className="ml-auto h-4 w-16 rounded bg-line" />
            <div className="ml-auto h-5 w-20 rounded-full bg-line/70" />
          </div>
        ))}
      </div>
    </div>
  )
}
