import type { Metadata } from 'next'
import Link from 'next/link'
import { Wordmark } from '@/components/brand/Wordmark'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: 'Privacy — foundr.money',
  description:
    'What foundr.money collects, how it is used, who touches it, and how to have it deleted. We never sell your data.',
}

const LAST_UPDATED = '2026-05-31'

// Static, prerenderable. No Clerk session hooks, no DB reads at the top level.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <LegalHeader />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 sm:pt-20">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
            privacy
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink">
            Privacy policy
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            foundr.money sees your money so you don&rsquo;t have to. That means we
            handle sensitive data, and you deserve to know exactly what we touch,
            why, and how to make it go away. Plain language below — no dark
            patterns.
          </p>
          <p className="mt-4 font-mono text-xs text-subtle">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="mt-12 space-y-12">
          <LegalSection id="collect" title="What we collect">
            <p>
              We collect only what it takes to turn your transactions into
              per-project profit and loss. Concretely:
            </p>
            <ul className="mt-4 space-y-3">
              <LegalItem term="Auth identity (via Clerk)">
                Your email address and the account profile you create when you
                sign in. We use Clerk to authenticate you; we never see or store
                your password.
              </LegalItem>
              <LegalItem term="Bank & card transactions (via Plaid)">
                When you link an account, Plaid provides us with transaction
                history, descriptions, amounts, dates, and the account and
                institution metadata needed to categorize spend. We do not store
                your bank login credentials — Plaid holds those, never us.
              </LegalItem>
              <LegalItem term="Provider invoice data">
                Where you connect a tool or vendor, we ingest invoice and billing
                line items so they can be matched to the right project.
              </LegalItem>
            </ul>
          </LegalSection>

          <LegalSection id="use" title="How we use it">
            <p>
              One purpose: building <strong>per-project P&amp;L</strong> for you.
              We tag each transaction to a project, roll it into a profit-and-loss
              view, and surface it back to you inside the app. That&rsquo;s the
              whole job.
            </p>
            <p>
              We do not use your financial data to train advertising profiles, and
              we do not build a shadow credit file. We may use aggregated,
              de-identified usage signals to keep the product working and to fix
              what breaks.
            </p>
          </LegalSection>

          <LegalSection id="third-parties" title="Who else touches it">
            <p>
              foundr.money is a small surface on top of a few trusted
              sub-processors. Each does one job:
            </p>
            <ul className="mt-4 space-y-3">
              <LegalItem term="Clerk">
                Authentication and session management.
              </LegalItem>
              <LegalItem term="Plaid">
                The secure connection to your bank and card accounts.
              </LegalItem>
              <LegalItem term="Supabase">
                The Postgres database where your projects and tagged transactions
                live.
              </LegalItem>
              <LegalItem term="Vercel">
                Application hosting and delivery.
              </LegalItem>
            </ul>
            <p className="mt-4">
              We share data with these providers strictly to run the service —
              never as a product of its own.
            </p>
          </LegalSection>

          <LegalSection id="plaid" title="Plaid end-user privacy">
            <p>
              Your bank connection is powered by Plaid. By linking an account you
              also agree to Plaid&rsquo;s handling of your information as described
              in the{' '}
              <a
                href="https://plaid.com/legal/#end-user-privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent transition hover:text-accent-hover"
              >
                Plaid End User Privacy Policy
              </a>
              . Plaid is the processor of record for your banking credentials;
              foundr.money never receives or stores them.
            </p>
          </LegalSection>

          <LegalSection id="retention" title="Retention &amp; deletion">
            <p>
              We keep your data only while your account is active and for as long
              as it takes you to use your historical P&amp;L. You can request a
              full export or deletion of your data at any time by emailing{' '}
              <a
                href="mailto:hello@perea.ai"
                className="font-medium text-accent transition hover:text-accent-hover"
              >
                hello@perea.ai
              </a>
              . We&rsquo;ll honor deletion requests promptly and remove your data
              from our active systems; residual copies in routine backups age out
              on their normal cycle.
            </p>
          </LegalSection>

          <LegalSection id="never-sell" title="We never sell your data">
            <p>
              Flatly: we do not sell, rent, or trade your personal or financial
              data to anyone, for any price. Your numbers are yours. We make money
              from your subscription, not from your data.
            </p>
          </LegalSection>

          <LegalSection id="contact" title="Questions">
            <p>
              Anything at all — privacy, a deletion request, or a worry —{' '}
              <a
                href="mailto:hello@perea.ai"
                className="font-medium text-accent transition hover:text-accent-hover"
              >
                hello@perea.ai
              </a>{' '}
              reaches a real person.
            </p>
          </LegalSection>
        </div>

        <div className="mt-16 border-t border-line pt-8">
          <p className="text-sm text-muted">
            See also our{' '}
            <Link
              href="/terms"
              className="font-medium text-accent transition hover:text-accent-hover"
            >
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}

// --- Shared legal-page primitives (local to the legal slice) ---

function LegalHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-2xl items-center justify-between px-6">
        <Wordmark />
        <Link
          href="/"
          className="text-sm font-medium text-muted transition hover:text-ink"
        >
          ← Back to home
        </Link>
      </nav>
    </header>
  )
}

function LegalSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-muted [&_strong]:font-medium [&_strong]:text-ink">
        {children}
      </div>
    </section>
  )
}

function LegalItem({
  term,
  children,
}: {
  term: string
  children: React.ReactNode
}) {
  return (
    <li className="leading-relaxed">
      <span className="font-medium text-ink">{term}.</span>{' '}
      <span className="text-muted">{children}</span>
    </li>
  )
}
