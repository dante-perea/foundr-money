'use client'

// App-wide error boundary. global-error.tsx REPLACES the root layout when it
// renders, so it must ship its own <html> and <body>. The fonts and globals.css
// from layout.tsx are NOT guaranteed here, so brand colors are inlined to keep
// the page calm and on-brand even when everything else has failed.
//
// Why this matters for a money app: a failed write or render used to be totally
// invisible (no boundary existed). Now the founder sees a calm screen and a
// retry — never a blank white void over their finances.

const BLUE = '#3b82f6'
const BLUE_HOVER = '#2563eb'
const INK = '#111827'
const MUTED = '#475569'
const SUBTLE = '#94a3b8'
const LINE = '#e2e8f0'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          color: INK,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <header style={{ borderBottom: `1px solid ${LINE}` }}>
          <div
            style={{
              maxWidth: '72rem',
              margin: '0 auto',
              height: '4rem',
              display: 'flex',
              alignItems: 'center',
              padding: '0 1.5rem',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              <span
                aria-hidden
                style={{
                  height: '0.625rem',
                  width: '0.625rem',
                  borderRadius: '9999px',
                  background: BLUE,
                }}
              />
              <span>
                foundr<span style={{ color: BLUE }}>.money</span>
              </span>
            </span>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6rem 1.5rem',
          }}
        >
          <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: SUBTLE,
                margin: 0,
              }}
            >
              something broke
            </p>
            <h1
              style={{
                marginTop: '1.25rem',
                marginBottom: 0,
                fontSize: '1.875rem',
                lineHeight: 1.2,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: INK,
              }}
            >
              We hit an unexpected error.
            </h1>
            <p
              style={{
                margin: '1rem auto 0',
                maxWidth: '24rem',
                fontSize: '1rem',
                lineHeight: 1.6,
                color: MUTED,
              }}
            >
              Your data is safe — nothing here changes your bank or your saved
              numbers. This was on our side. Try again, and if it keeps happening
              reach us at{' '}
              <a
                href="mailto:hello@perea.ai"
                style={{ color: BLUE, fontWeight: 500, textDecoration: 'none' }}
              >
                hello@perea.ai
              </a>
              .
            </p>

            <div
              style={{
                marginTop: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  borderRadius: '0.375rem',
                  background: BLUE,
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = BLUE_HOVER
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = BLUE
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: BLUE,
                  textDecoration: 'none',
                }}
              >
                Back to home →
              </a>
            </div>

            {error?.digest ? (
              <p
                style={{
                  marginTop: '2rem',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.75rem',
                  color: SUBTLE,
                }}
              >
                Reference: {error.digest}
              </p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  )
}
