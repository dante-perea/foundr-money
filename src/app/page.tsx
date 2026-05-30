import Link from 'next/link'

// Static, public marketing landing (prerenderable under cacheComponents).
// The full branded landing is built in the implementation phase; this is the
// prerender-safe placeholder. No Clerk session hooks at the top level.
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-900 px-6 text-center text-slate-50">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">foundr.money</p>
      <h1 className="max-w-2xl text-3xl font-semibold sm:text-5xl">
        Project-first budgeting for the founder running five things on one card.
      </h1>
      <p className="max-w-xl text-sm text-slate-400 sm:text-base">
        Per-project P&amp;L, agent-native spend tagging over MCP, and first-class
        ingestion of your OpenAI, Anthropic, Vercel &amp; Supabase invoices. No entity required.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/sign-up"
          className="rounded-md bg-slate-50 px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-white"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-md border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500"
        >
          Sign in
        </Link>
      </div>
    </main>
  )
}
