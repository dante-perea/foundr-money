import { Section, SectionHeading } from './Section'

const STEPS = [
  {
    n: '01',
    title: 'Link your card and your invoices.',
    body: 'Plaid connects a personal card in a few clicks. Add your cloud and AI bills so OpenAI, Vercel and the rest land as first-class line items — not a mystery charge on a statement.',
  },
  {
    n: '02',
    title: 'Let it tag in the loop you already work in.',
    body: 'Connect the MCP server to Claude Code or Cursor. Rules tag the recurring spend instantly; the agent asks you about the one charge it cannot place — right where you make the decision.',
  },
  {
    n: '03',
    title: 'Watch each project burn.',
    body: 'Per-project P&L updates as charges settle. See portfolio-wide burn, total MRR across every Stripe account, and a tax-aware export when a project finally graduates.',
  },
]

export function HowItWorks() {
  return (
    <Section>
      <SectionHeading
        eyebrow="how it works"
        title="Three steps, in order."
        lede="No chart of accounts to configure. No double-entry to learn. Connect, tag, watch."
      />
      <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="bg-surface p-7">
            <p className="font-mono text-xs font-medium text-accent">{s.n}</p>
            <h3 className="mt-4 font-display text-base font-medium text-ink">
              {s.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
