'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import { cn } from '@/lib/cn'
import { nextProjectColor } from '@/lib/money/palette'
import '@/components/onboarding/onboarding.css'
import { OnboardingShell } from '@/components/onboarding/OnboardingShell'
import { ProgressRail } from '@/components/onboarding/ProgressRail'
import { FooterNav } from '@/components/onboarding/FooterNav'
import { StepWelcome } from '@/components/onboarding/StepWelcome'
import { StepProjects } from '@/components/onboarding/StepProjects'
import { StepSpend } from '@/components/onboarding/StepSpend'
import { StepDone } from '@/components/onboarding/StepDone'
import {
  createProject as createProjectAction,
  removeProject as removeProjectAction,
  renameProject as renameProjectAction,
  loadSampleData as loadSampleDataAction,
  finishOnboarding as finishOnboardingAction,
  type ProjectView,
  type MintedKey,
  type AddedExpense,
} from './actions'

export interface InitialProject {
  id: string
  name: string
  slug: string
  color: string
}

/** A project as the wizard holds it — committed rows, plus transient error/retry
 *  state for optimistic-then-failed inserts. */
export interface WizardProject {
  id: string
  name: string
  slug: string | null
  color: string
  error?: boolean
  onRetry?: () => void
}

type Step = 0 | 1 | 2 | 3
type Mode = 'guided' | null
type Direction = 'forward' | 'back'

const SESSION_KEY = 'fm.onboarding.v1'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The first real (non-personal) project name, for the moat/done examples. */
function firstExample(projects: WizardProject[]): string {
  const real = projects.find((p) => p.name.toLowerCase() !== 'personal')
  return real?.name ?? 'AI app'
}

export function OnboardingFlow({
  initialProjects,
  appUrl,
  plaidConfigured,
  hasRealData,
}: {
  initialProjects: InitialProject[]
  appUrl: string
  plaidConfigured: boolean
  hasRealData: boolean
}) {
  // ── State ────────────────────────────────────────────────────────────────
  const resuming = initialProjects.length > 0
  const [step, setStep] = useState<Step>(resuming ? 1 : 0)
  const [, setMode] = useState<Mode>(resuming ? 'guided' : null)
  const [direction, setDirection] = useState<Direction>('forward')
  const [skipped, setSkipped] = useState<Set<number>>(new Set())

  const [projects, setProjects] = useState<WizardProject[]>(
    initialProjects.map((p) => ({ ...p })),
  )
  const [minted, setMinted] = useState<MintedKey | null>(null)
  const [expense, setExpense] = useState<AddedExpense | null>(null)
  const [expenseCount, setExpenseCount] = useState(0)

  const [finishing, startFinish] = useTransition()
  const [skipping, startSkip] = useTransition()

  // ── Transitions / focus ───────────────────────────────────────────────────
  const h1Ref = useRef<HTMLDivElement>(null)
  const focusInputRef = useRef<(() => void) | null>(null)
  const [animKey, setAnimKey] = useState(0)
  const liveRef = useRef<HTMLDivElement>(null)

  const registerInputFocus = useCallback((fn: () => void) => {
    focusInputRef.current = fn
  }, [])

  // Restore the soft session hint (position only — data is server-truth).
  useEffect(() => {
    if (resuming) return
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { step?: number }
        if (typeof parsed.step === 'number' && parsed.step >= 0 && parsed.step <= 3) {
          setStep(parsed.step as Step)
          if (parsed.step >= 1) setMode('guided')
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the soft hint on each step change.
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ step }))
    } catch {
      /* ignore */
    }
  }, [step])

  // Move focus + announce on each step change.
  useEffect(() => {
    setAnimKey((k) => k + 1)
    const t = window.setTimeout(() => {
      // Step 1 focuses the input (the field IS the task); others focus the H1.
      if (step === 1 && focusInputRef.current) {
        focusInputRef.current()
      } else {
        h1Ref.current?.focus()
      }
    }, prefersReducedMotion() ? 0 : 60)

    if (liveRef.current) {
      const labels = ['welcome', 'your projects', 'bring in your spend', 'you’re set']
      liveRef.current.textContent =
        step === 0 ? 'Welcome' : `Step ${step} of 3: ${labels[step]}`
    }
    return () => window.clearTimeout(t)
  }, [step])

  // ── Navigation ──────────────────────────────────────────────────────────
  const goTo = useCallback((next: Step, dir: Direction) => {
    setDirection(dir)
    setStep(next)
  }, [])

  // ── Project mutations (optimistic + confirm) ──────────────────────────────
  const commitProject = useCallback((name: string) => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    // Optimistic row (color is finalized by the server response).
    setProjects((prev) => {
      // Soft dedup hint: if a same-named row exists, don't add a duplicate.
      if (prev.some((p) => p.name.toLowerCase() === name.toLowerCase())) return prev
      // Mirror the server's color rule so there's no gray→accent flash: the
      // Nth non-personal project takes nextProjectColor(count of non-personal).
      const color = nextProjectColor(
        prev.filter((p) => p.name.toLowerCase() !== 'personal').length,
      )
      return [
        ...prev,
        { id: tempId, name, slug: null, color },
      ]
    })

    const run = () =>
      createProjectAction(name)
        .then((row: ProjectView) => {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === tempId
                ? { id: row.id, name: row.name, slug: row.slug, color: row.color }
                : p,
            ),
          )
        })
        .catch(() => {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === tempId
                ? { ...p, error: true, onRetry: () => { setProjects((q) => q.map((r) => (r.id === tempId ? { ...r, error: false, onRetry: undefined } : r))); run() } }
                : p,
            ),
          )
        })
    run()
  }, [])

  const handleRemove = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (!id.startsWith('tmp-')) void removeProjectAction(id).catch(() => {})
  }, [])

  const handleRename = useCallback((id: string, name: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
    if (!id.startsWith('tmp-')) void renameProjectAction(id, name).catch(() => {})
  }, [])

  // ── Fork / finish handlers ────────────────────────────────────────────────
  const onSetup = useCallback(() => {
    setMode('guided')
    goTo(1, 'forward')
  }, [goTo])

  const onSample = useCallback(async () => {
    // Server action redirects on success; throwing surfaces the inline error.
    await loadSampleDataAction()
  }, [])

  const clearSessionHint = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }

  const onFinish = useCallback(() => {
    clearSessionHint()
    startFinish(async () => {
      await finishOnboardingAction({ usedSampleData: false })
    })
  }, [])

  const onSkipSetup = useCallback(() => {
    clearSessionHint()
    startSkip(async () => {
      await finishOnboardingAction({ usedSampleData: false })
    })
  }, [])

  // Step-1 skip: ensure the primitive exists, then advance to spend.
  const skipToPersonal = useCallback(() => {
    if (projects.length === 0) commitProject('Personal')
    setSkipped((s) => new Set(s).add(1))
    goTo(2, 'forward')
  }, [projects.length, commitProject, goTo])

  // Keyboard: Enter (outside a textarea/input) = primary Continue on steps 1–2.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return
      const t = e.target as HTMLElement
      if (
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.tagName === 'SELECT' ||
        t.isContentEditable
      )
        return
      if (step === 1 && projects.length > 0) goTo(2, 'forward')
      else if (step === 2) goTo(3, 'forward')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, projects.length, goTo])

  // ── Derived ────────────────────────────────────────────────────────────────
  const example = firstExample(projects)
  const personalOnly =
    projects.length === 1 && projects[0]?.name.toLowerCase() === 'personal'
  const expenseProject = expense
    ? projects.find((p) => p.id === expense.projectId)
    : undefined

  const slideClass = prefersReducedMotion()
    ? ''
    : direction === 'forward'
      ? 'fm-step-in-forward'
      : 'fm-step-in-back'

  // ── Render ──────────────────────────────────────────────────────────────
  const rail =
    step >= 1 && step <= 3 ? (
      <ProgressRail current={step as 1 | 2 | 3} skipped={skipped} />
    ) : null

  let footer: React.ReactNode = null
  if (step === 1) {
    footer = (
      <FooterNav
        onBack={() => goTo(0, 'back')}
        onContinue={() => goTo(2, 'forward')}
        continueLabel={
          projects.length > 0
            ? `Continue with ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
            : 'Continue'
        }
        continueDisabled={projects.length === 0}
        continueHint="add at least one project to continue"
        onSkipStep={skipToPersonal}
        skipLabel="skip step"
      />
    )
  } else if (step === 2) {
    footer = (
      <FooterNav
        onBack={() => goTo(1, 'back')}
        onContinue={() => goTo(3, 'forward')}
        continueLabel="Continue"
      />
    )
  }

  return (
    <OnboardingShell
      onSkipSetup={onSkipSetup}
      showSkip={step !== 3}
      skipping={skipping}
      rail={rail}
      footer={footer}
      wide={step === 0 || step === 3}
    >
      {/* a11y: announce step changes; never the secret key */}
      <div ref={liveRef} aria-live="polite" className="sr-only" />

      <div
        ref={h1Ref}
        key={animKey}
        className={cn(slideClass, 'flex flex-1 flex-col focus:outline-none')}
        tabIndex={-1}
      >
        {step === 0 && (
          <StepWelcome
            resuming={resuming}
            resumeCount={projects.length}
            showDemo={!hasRealData}
            onSetup={onSetup}
            onSample={onSample}
          />
        )}
        {step === 1 && (
          <StepProjects
            projects={projects}
            onAdd={commitProject}
            onRemove={handleRemove}
            onRename={handleRename}
            registerInputFocus={registerInputFocus}
          />
        )}
        {step === 2 && (
          <StepSpend
            appUrl={appUrl}
            plaidConfigured={plaidConfigured}
            projects={projects}
            exampleProject={example}
            minted={minted}
            expenseCount={expenseCount}
            onMinted={setMinted}
            onExpenseAdded={(e) => {
              setExpense(e)
              setExpenseCount((c) => c + 1)
            }}
          />
        )}
        {step === 3 && (
          <StepDone
            projects={projects}
            personalOnly={personalOnly}
            keyTail={minted?.last4 ?? null}
            expense={
              expense
                ? {
                    amountCents: expense.amountCents,
                    merchant: expense.merchant,
                    projectColor: expenseProject?.color,
                    projectName: expenseProject?.name,
                  }
                : null
            }
            exampleProject={example}
            finishing={finishing}
            onFinish={onFinish}
            onAddMore={() => goTo(1, 'back')}
          />
        )}
      </div>
    </OnboardingShell>
  )
}
