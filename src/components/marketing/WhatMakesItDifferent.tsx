import { Section, SectionHeading, Card } from './Section'

// The 5 angles. Numbered in mono accent to read as a deliberate, ordered set.
const ANGLES = [
  {
    n: '01',
    title: 'Project-first, not category-first.',
    body: 'A project is the spine of the data model — a real allocation axis, not a billable tag bolted onto a category. One charge can split across two projects and still reconcile to the cent.',
  },
  {
    n: '02',
    title: 'Built for the micro-startup.',
    body: 'The three-to-ten-person team running several things at once is the whole point — not an edge case we tolerate. The product graduates with you instead of forcing a rebuild.',
  },
  {
    n: '03',
    title: 'Agentic tagging over MCP.',
    body: 'Connect from Claude Code or Cursor and tag transactions in the loop where you already make decisions. The agent surfaces the one charge it cannot place and you resolve it without leaving the terminal.',
  },
  {
    n: '04',
    title: 'AI and cloud spend, first-class.',
    body: 'OpenAI, Anthropic, Vercel and Supabase ingest as itemized line items — and where the provider exposes a native project dimension, it auto-tags to the right project with no decision.',
  },
  {
    n: '05',
    title: 'No entity required.',
    body: 'We do not issue a card, so we have no KYB obligation and never ask for your EIN. foundr.money is software over your Plaid-linked personal accounts. A sole proprietor is a first-class user.',
  },
]

export function WhatMakesItDifferent() {
  return (
    <Section tone="alt">
      <SectionHeading
        eyebrow="what makes it different"
        title="Five things nobody else does for this founder."
        lede="Every incumbent was built for an incorporated business with a finance team. None of those assumptions hold for you."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ANGLES.map((a) => (
          <Card key={a.n}>
            <p className="font-mono text-xs font-medium text-accent">{a.n}</p>
            <h3 className="mt-4 font-display text-base font-medium text-ink">
              {a.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{a.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  )
}
