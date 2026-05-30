// Suspense fallback for the dynamic onboarding data island. Renders the static
// chrome (header hairline + a calm centered placeholder) so navigation paints
// instantly while auth + project reads resolve. No layout shift: same shell
// dimensions as the live flow.
export function OnboardingChromeFallback() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface font-sans text-ink">
      <header className="h-16 border-b border-line">
        <div className="mx-auto flex h-full max-w-[680px] items-center justify-between px-6">
          <span className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <span>
              foundr<span className="text-accent">.money</span>
            </span>
          </span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">setting up…</p>
      </main>
    </div>
  )
}
