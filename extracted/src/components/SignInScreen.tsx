import { useState } from 'react'

type Mode = 'signin' | 'signup' | 'forgot'

export function SignInScreen({
  onSignInWithGoogle,
  onSignInWithEmail,
  onSignUpWithEmail,
  onResetPassword,
}: {
  onSignInWithGoogle: () => void
  onSignInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  onSignUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  onResetPassword: (email: string) => Promise<{ error: string | null }>
}) {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'forgot') {
        const { error } = await onResetPassword(email)
        if (error) setError(error)
        else setInfo('Password reset email sent -- check your inbox.')
        return
      }
      const { error } = mode === 'signup' ? await onSignUpWithEmail(email, password) : await onSignInWithEmail(email, password)
      if (error) setError(error)
      else if (mode === 'signup') setInfo('Account created -- check your inbox to verify your email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="ds-card p-8 max-w-sm w-full text-center space-y-4">
        <div className="rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center mx-auto" style={{ width: 40, height: 40 }}>
          <span className="text-white" style={{ font: 'var(--label-large)', letterSpacing: '0.1px' }}>R</span>
        </div>
        <div>
          <h1 className="ds-headline-s">Rewards & Recognition</h1>
          <p className="ds-body-s text-[var(--muted-foreground)] mt-1">Sign in with your org account</p>
        </div>

        <button onClick={onSignInWithGoogle} className="btn btn-outlined btn-lg w-full">
          Sign in with Google
        </button>

        {!showEmailForm ? (
          <button className="btn btn-text btn-sm" onClick={() => setShowEmailForm(true)}>
            Use email and password instead
          </button>
        ) : (
          <div className="text-left space-y-3 pt-2 border-t border-[var(--border)]">
            <div className="ds-tabs" style={{ justifyContent: 'center' }}>
              <button className={`ds-tab ${mode === 'signin' ? 'is-active' : ''}`} onClick={() => { setMode('signin'); setError(null); setInfo(null) }}>Sign in</button>
              <button className={`ds-tab ${mode === 'signup' ? 'is-active' : ''}`} onClick={() => { setMode('signup'); setError(null); setInfo(null) }}>Sign up</button>
            </div>

            {mode === 'signup' && (
              <p className="ds-body-s text-[var(--muted-foreground)]">
                Use the exact email your admin added you with. You'll verify it before you can sign in.
              </p>
            )}

            <div>
              <label className="ds-label-m text-[var(--foreground)] block mb-1.5">Email</label>
              <input type="email" className="ds-input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="ds-label-m text-[var(--foreground)] block mb-1.5">Password</label>
                <input type="password" className="ds-input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}

            {error && <p className="ds-body-s text-[var(--error-foreground)] bg-[var(--error-light-background)] rounded-[var(--radius-sm)] px-3 py-2">{error}</p>}
            {info && <p className="ds-body-s text-[var(--success-foreground)] bg-[var(--success-light-background)] rounded-[var(--radius-sm)] px-3 py-2">{info}</p>}

            <button
              className="btn btn-filled btn-md w-full disabled:opacity-40 disabled:pointer-events-none"
              disabled={busy || !email.trim() || (mode !== 'forgot' && !password)}
              onClick={submit}
            >
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
            </button>

            {mode === 'signin' && (
              <button className="btn btn-text btn-sm" onClick={() => { setMode('forgot'); setError(null); setInfo(null) }}>
                Forgot password?
              </button>
            )}
            {mode === 'forgot' && (
              <button className="btn btn-text btn-sm" onClick={() => { setMode('signin'); setError(null); setInfo(null) }}>
                Back to sign in
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
