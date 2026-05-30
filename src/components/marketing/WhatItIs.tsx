import { Section, SectionHeading, Card } from './Section'

const PILLARS = [
  {
    title: 'Connect',
    body: 'Link a personal card through Plaid and point us at your OpenAI, Anthropic, Vercel and Supabase invoices. Consumer auth — we issue nothing, so there is no EIN to hand over.',
  },
  {
    title: 'Tag',
    body: 'Every charge gets allocated to a project. Rules clear the recurring spend for free; a cheap model suggests the rest with a confidence score. Anything unsure waits for one tap.',
  },
  {
    title: 'Watch',
    body: 'See per-project P&L and burn across the whole portfolio — five projects on one card, one screen. Finally answer which project caused that surprise bill.',
  },
]

export function WhatItIs() {
  return (
    <Section tone="alt">
      <SectionHeading
        eyebrow="what it is"
        title="A budget that thinks in projects, not entities."
        lede="foundr.money sits over the accounts you already have and slices every dollar by the project that spent it — no incorporation, no new card, no bookkeeper."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <Card key={p.title}>
            <h3 className="font-display text-base font-medium text-ink">
              {p.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  )
}
