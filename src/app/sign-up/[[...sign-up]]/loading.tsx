// Segment-level loading skeleton — also supplies the <Suspense> boundary that
// contains this route's dynamic `connection()` access under cacheComponents.
export default function SignUpLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <div className="h-[28rem] w-[25rem] max-w-full animate-pulse rounded-xl bg-slate-800/60" />
    </main>
  )
}
