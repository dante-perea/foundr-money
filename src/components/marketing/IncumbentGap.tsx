import { Section, SectionHeading } from './Section'

// VERIFIED quotes only (dossier §2 claims policy). Do NOT add the unverified
// "$200K Solopreneur ceiling" claim — use the capability boundary instead.
const INCUMBENTS = [
  {
    name: 'Ramp',
    quote:
      'not accepting individuals, sole proprietors, and other types of unregistered businesses',
    attribution: 'Ramp support',
    takeaway: 'The target user is rejected at the door. The EIN gate cannot be waived.',
  },
  {
    name: 'Brex',
    quote: '$50K minimum cash and a US EIN required',
    attribution: 'Brex eligibility',
    takeaway: 'A structural requirement, not a policy choice — because they issue a card.',
  },
  {
    name: 'QuickBooks Solopreneur',
    quote:
      'Schedule-C-only — no S-corp, no balance sheet, no per-project P&L',
    attribution: 'Intuit',
    takeaway: 'Per-project profit only exists at Plus, billed per legal entity.',
  },
]

export function IncumbentGap() {
  return (
    <Section>
      <SectionHeading
        eyebrow="the gap"
        title="They were built to turn you away."
        lede="These are not our characterizations. They are the incumbents' own words about who they will and will not serve."
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {INCUMBENTS.map((i) => (
          <figure
            key={i.name}
            className="flex flex-col rounded-md border border-line bg-surface p-6 transition hover:border-line-strong hover:shadow-sm"
          >
            <figcaption className="font-display text-base font-medium text-ink">
              {i.name}
            </figcaption>
            <blockquote className="mt-4 border-l-2 border-line pl-4 text-sm leading-relaxed text-ink">
              &ldquo;{i.quote}&rdquo;
            </blockquote>
            <p className="mt-2 pl-4 font-mono text-[11px] uppercase tracking-[0.12em] text-subtle">
              {i.attribution}
            </p>
            <p className="mt-5 border-t border-line pt-5 text-sm leading-relaxed text-muted">
              {i.takeaway}
            </p>
          </figure>
        ))}
      </div>
      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
        foundr.money issues nothing. It is software over your Plaid-linked
        personal accounts — so the entity gate that keeps you out of every card
        program simply does not apply.
      </p>
    </Section>
  )
}
