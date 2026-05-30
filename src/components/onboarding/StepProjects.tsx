'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { nextProjectColor } from '@/lib/money/palette'
import type { WizardProject } from '@/app/onboarding/onboarding-client'

const CHIPS = ['SaaS', 'Newsletter', 'AI app', 'Consulting', 'Mobile'] as const

/**
 * Step 1 — establish the primitive. Adding a project must feel like one
 * keystroke; suggestion chips instant-create (a 3-project workspace in 3 clicks,
 * zero typing). Color is auto-assigned by index — no picker. The leading dot
 * previews the color the next project will take.
 */
export function StepProjects({
  projects,
  onAdd,
  onRemove,
  onRename,
  registerInputFocus,
}: {
  projects: WizardProject[]
  onAdd: (name: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  /** Lets the parent focus the input when this step becomes active. */
  registerInputFocus: (fn: () => void) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [flash, setFlash] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    registerInputFocus(() => inputRef.current?.focus())
  }, [registerInputFocus])

  const count = projects.length
  const nextColor = nextProjectColor(count)
  const usedNames = new Set(projects.map((p) => p.name.toLowerCase()))

  function submit() {
    const clean = value.trim()
    if (!clean) {
      setFlash(true)
      window.setTimeout(() => setFlash(false), 600)
      return
    }
    onAdd(clean)
    setValue('')
    inputRef.current?.focus()
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      submit()
    }
  }

  function commitRename(id: string) {
    const clean = editValue.trim()
    if (clean) onRename(id, clean)
    setEditingId(null)
  }

  return (
    <div className="flex flex-1 flex-col pb-8 pt-2">
      <h1
        tabIndex={-1}
        className="font-display text-3xl font-semibold tracking-tight text-ink focus:outline-none sm:text-4xl"
      >
        what are you building?
      </h1>
      <p className="mt-2 text-sm text-muted">
        each thing you ship is a project. spend gets split across them — that’s the whole point. add
        the ones you’re spending on now; you can add more later.
      </p>

      {/* Add control */}
      <div
        className={cn(
          'mt-6 flex flex-col gap-2 rounded-md border bg-surface p-2 transition sm:flex-row sm:items-center',
          flash ? 'border-warning' : 'border-line',
        )}
      >
        <span
          aria-hidden
          className="ml-2 hidden h-3 w-3 shrink-0 rounded-full transition-colors sm:inline-block"
          style={{ backgroundColor: nextColor }}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onInputKey}
          aria-label="Project name"
          placeholder="e.g. Inboxer"
          maxLength={40}
          className="min-w-0 flex-1 rounded-md bg-surface px-3 py-2.5 text-base text-ink placeholder:text-subtle focus:outline-none sm:text-base"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className={cn(
            'shrink-0 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            !value.trim() && 'cursor-not-allowed opacity-50 hover:bg-accent',
          )}
        >
          Add
        </button>
      </div>

      {/* Suggestion chips — instant-create */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">try:</span>
        {CHIPS.map((chip) => {
          const used = usedNames.has(chip.toLowerCase())
          return (
            <button
              key={chip}
              type="button"
              onClick={() => !used && onAdd(chip)}
              aria-disabled={used}
              disabled={used}
              className={cn(
                'rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-muted transition hover:border-accent hover:text-accent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                used && 'pointer-events-none opacity-40',
              )}
            >
              {chip}
            </button>
          )
        })}
      </div>

      {/* Project list / empty sub-state */}
      {count === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-line p-5 text-center">
          <p className="text-sm text-muted">
            no projects yet. add one above — or{' '}
            <button
              type="button"
              onClick={() => onAdd('Personal')}
              className="rounded text-accent underline-offset-2 transition hover:text-accent-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              skip and just track personal spend
            </button>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className={cn(
                'fm-row-in group flex items-center gap-3 rounded-md border px-4 py-3',
                p.error ? 'border-warning' : 'border-line',
              )}
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      commitRename(p.id)
                    } else if (e.key === 'Escape') {
                      setEditingId(null)
                    }
                  }}
                  aria-label={`Rename ${p.name}`}
                  maxLength={40}
                  className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</span>
              )}
              <span className="hidden font-mono text-[11px] text-subtle sm:inline">
                · {p.slug ?? '…'}
              </span>
              {p.error ? (
                <button
                  type="button"
                  onClick={() => p.onRetry?.()}
                  aria-label={`Retry adding ${p.name}`}
                  className="-m-2 rounded p-2 text-warning transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  ↻
                </button>
              ) : (
                <div className="flex items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(p.id)
                      setEditValue(p.name)
                    }}
                    aria-label={`Rename ${p.name}`}
                    className="-m-2 rounded p-2 text-subtle transition hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    aria-label={`Remove ${p.name}`}
                    className="-m-2 rounded p-2 text-subtle transition hover:text-warning focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Soft cap + dup hint live below the list */}
      {count >= 25 && (
        <p className="mt-3 text-xs text-subtle">that’s a lot of projects — nice.</p>
      )}

      <div className="mt-auto pt-6">
        {count > 0 && (
          <p className="font-mono text-xs text-subtle">
            {count} {count === 1 ? 'project' : 'projects'}
          </p>
        )}
      </div>
    </div>
  )
}
