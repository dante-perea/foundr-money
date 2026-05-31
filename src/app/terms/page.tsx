import type { Metadata } from 'next'
import Link from 'next/link'
import { Wordmark } from '@/components/brand/Wordmark'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: 'Terms — foundr.money',
  description:
    'The terms for using foundr.money. Software, not a bank. Data preparation, not tax advice. Plain and serviceable.',
}

const LAST_UPDATED = '2026-05-31'

// Static, prerenderable. No Clerk session hooks, no DB reads at the top level.
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <LegalHeader />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 sm:pt-20">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">
            terms
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink">
            Terms of service
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            The deal between you and foundr.money, in plain language. By creating
            an account or using the service, you agree to what&rsquo;s below.
          </p>
          <p className="mt-4 font-mono text-xs text-subtle">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="mt-12 space-y-12">
          <LegalSection id="acceptable-use" title="Acceptable use">
            <p>
              foundr.money is for tracking the finances of projects and businesses
              you actually run. Use it for your own accounts and data, or accounts
              you&rsquo;re authorized to manage. Don&rsquo;t use it to launder
              money, evade taxes, impersonate someone else, scrape or attack the
              service, or do anything illegal. We may suspend accounts that abuse
              the service or put other founders at risk.
            </p>
          </LegalSection>

          <LegalSection id="not-a-bank" title="Software, not a bank or advisor">
            <p>
              foundr.money is <strong>software</strong>. It is not a bank, a money
              transmitter, a broker, an accountant, or a financial advisor. We do
              not hold your money, move your money, or give you regulated financial
              advice. Your funds stay with your bank; we read transaction data
              through Plaid and organize it for you.
            </p>
          </LegalSection>

          <LegalSection id="not-tax-advice" title="Data preparation, not tax advice">
            <p>
              foundr.money does <strong>data preparation, not tax advice</strong>.
              We help you organize and categorize your transactions into
              per-project profit and loss so the numbers are ready when you need
              them. We do not prepare or file your taxes, and nothing in the
              product is tax, legal, or accounting advice. Before you file
              anything or make a financial decision, confirm the numbers with a
              qualified accountant or tax professional. You are responsible for the
              accuracy of what you report.
            </p>
          </LegalSection>

          <LegalSection id="warranty" title="No warranty">
            <p>
              The service is provided &ldquo;as is&rdquo; and &ldquo;as
              available,&rdquo; without warranties of any kind, express or implied,
              including merchantability, fitness for a particular purpose, and
              non-infringement. We don&rsquo;t promise the service will be
              uninterrupted, error-free, or that every categorization will be
              perfect. You&rsquo;re responsible for reviewing your own numbers.
            </p>
          </LegalSection>

          <LegalSection id="liability" title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, foundr.money and Perea will
              not be liable for any indirect, incidental, special, consequential,
              or punitive damages, or for lost profits, revenue, data, or
              goodwill, arising from your use of the service. Where liability
              cannot be excluded, our total liability is limited to the amount you
              paid us in the twelve months before the claim.
            </p>
          </LegalSection>

          <LegalSection id="plans" title="Plans &amp; billing">
            <p>
              foundr.money offers two plans:{' '}
              <strong>$19/mo</strong> and <strong>$49/mo</strong>. Both bill on a
              monthly subscription, charged in advance, and you can cancel anytime
              — cancellation stops the next renewal and you keep access through the
              period you&rsquo;ve paid for. Fees are non-refundable except where
              required by law. We&rsquo;ll give reasonable notice before changing
              prices.
            </p>
            <p>
              Paid billing is rolling out. Until billing ships, the plan terms
              above describe what you&rsquo;ll be agreeing to when you subscribe;
              no charges are made before then.
            </p>
          </LegalSection>

          <LegalSection id="data" title="Your data">
            <p>
              You own your data. We handle it as described in our{' '}
              <Link
                href="/privacy"
                className="font-medium text-accent transition hover:text-accent-hover"
              >
                Privacy Policy
              </Link>
              , which is part of these terms. You can request an export or deletion
              at any time by emailing{' '}
              <a
                href="mailto:hello@perea.ai"
                className="font-medium text-accent transition hover:text-accent-hover"
              >
                hello@perea.ai
              </a>
              .
            </p>
          </LegalSection>

          <LegalSection id="changes" title="Changes to these terms">
            <p>
              We may update these terms as the product evolves. When we make
              material changes we&rsquo;ll update the date above and, where
              appropriate, let you know in-app or by email. Continuing to use the
              service after a change means you accept the updated terms.
            </p>
          </LegalSection>

          <LegalSection id="governing-law" title="Governing law">
            <p>
              These terms are governed by the laws of{' '}
              <span className="font-mono text-sm text-subtle">
                [governing jurisdiction — TBD]
              </span>
              , without regard to conflict-of-laws rules. Any disputes will be
              resolved in the courts of that jurisdiction.
            </p>
          </LegalSection>

          <LegalSection id="contact" title="Contact">
            <p>
              Questions about these terms? Email{' '}
              <a
                href="mailto:hello@perea.ai"
                className="font-medium text-accent transition hover:text-accent-hover"
              >
                hello@perea.ai
              </a>
              .
            </p>
          </LegalSection>
        </div>

        <div className="mt-16 border-t border-line pt-8">
          <p className="text-sm text-muted">
            See also our{' '}
            <Link
              href="/privacy"
              className="font-medium text-accent transition hover:text-accent-hover"
            >
              Privacy Policy
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
