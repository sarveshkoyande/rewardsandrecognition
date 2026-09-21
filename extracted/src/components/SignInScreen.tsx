export function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="ds-card p-8 max-w-sm w-full text-center space-y-4">
        <div className="rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center mx-auto" style={{ width: 40, height: 40 }}>
          <span className="text-white" style={{ font: 'var(--label-large)', letterSpacing: '0.1px' }}>R</span>
        </div>
        <div>
          <h1 className="ds-headline-s">Rewards & Recognition</h1>
          <p className="ds-body-s text-[var(--muted-foreground)] mt-1">Sign in with your org Google account</p>
        </div>
        <button onClick={onSignIn} className="btn btn-outlined btn-lg w-full">
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
