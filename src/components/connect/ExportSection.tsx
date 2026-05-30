'use client'

import { useState } from 'react'

/**
 * Tax-aware export. A year picker + a download link to
 * GET /api/export/schedule-c?year=YYYY (text/csv attachment). The CSV carries
 * Schedule C deduction rows + a 1099-NEC candidates section.
 */
export function ExportSection() {
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]
  const [year, setYear] = useState(currentYear)

  return (
    <div className="rounded-md border border-line bg-surface p-6 transition hover:border-line-strong">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Tax-aware export</p>
      <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-ink">
        Schedule C, already lined up.
      </h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Every tagged expense rolls onto its Schedule C line, by project. The download also flags
        vendors you paid $600 or more on contract-labor or legal lines — your 1099-NEC shortlist.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-subtle">Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <a
          href={`/api/export/schedule-c?year=${year}`}
          download
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          Download {year} CSV
        </a>
      </div>

      <p className="mt-3 font-mono text-[11px] text-subtle">Data prep, not tax advice.</p>
    </div>
  )
}
