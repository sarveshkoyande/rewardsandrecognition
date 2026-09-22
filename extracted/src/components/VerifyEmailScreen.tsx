import { useState } from 'react'

export function VerifyEmailScreen({
  email,
  onResend,
  onRecheck,
  onSignOut,
}: {
  email: string
  onResend: () => Promise<{ error: string | null }>
  onRecheck: () => Promise<void>
  onSignOut: () => Promise<void>
}) {
  const [status, setStatus] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function resend() {
    setStatus(null)
    const { error } = await onResend()
    setStatus(error ?? 'Verification email sent -- check your inbox.')
  }

  async function recheck() {
    setChecking(true)
    try {
      await onRecheck()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="ds-card p-8 max-w-sm w-full text-center space-y-4">
        <p className="ds-title-m">Verify your email</p>
        <p className="ds-body-s text-[var(--muted-foreground)]">
          We sent a verification link to <strong className="text-[var(--foreground)]">{email}</strong>. Click it, then come back here.
        </p>
        {status && (
          <p className="ds-body-s text-[var(--primary)] bg-[var(--primary-light-background)] rounded-[var(--radius-sm)] px-3 py-2">{status}</p>
        )}
        <button className="btn btn-filled btn-md w-full disabled:opacity-40 disabled:pointer-events-none" disabled={checking} onClick={recheck}>
          {checking ? 'Checking…' : "I've verified -- continue"}
        </button>
        <button className="btn btn-outlined btn-md w-full" onClick={resend}>
          Resend verification email
        </button>
        <button className="btn btn-text btn-sm" onClick={() => onSignOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
