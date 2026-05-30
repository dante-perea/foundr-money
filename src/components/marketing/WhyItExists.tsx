import { Section, SectionHeading } from './Section'

// The 5 unaddressed pains, in the founder's own voice.
const PAINS = [
  'Which project caused that surprise bill?',
  'I have multiple Stripe accounts and no idea what my total MRR is.',
  'I got denied by Brex and Ramp for being too small.',
  'QuickBooks is solving a problem I don’t have.',
  'Tax time = shoebox + panic + bookkeeper cleanup fees.',
]

export function WhyItExists() {
  return (
    <Section tone="alt">
      <SectionHeading
        eyebrow="why it exists"
        title="Five things you have said out loud."
        lede="Solo founders don’t have CFOs. These are the gaps nobody built for — until now."
      />
      <ul className="mt-12 grid gap-5 sm:grid-cols-2">
        {PAINS.map((pain, idx) => (
          <li
            key={pain}
            className="flex items-start gap-4 rounded-md border border-line bg-surface p-6 transition hover:border-line-strong hover:shadow-sm"
          >
            <span className="mt-0.5 font-mono text-xs font-medium text-accent">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <p className="font-display text-lg leading-snug text-ink">
              &ldquo;{pain}&rdquo;
            </p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
