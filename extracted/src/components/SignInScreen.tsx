export function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-10 h-10 rounded bg-[var(--primary)] flex items-center justify-center mx-auto">
          <span className="text-white text-sm font-bold">R</span>
        </div>
        <div>
          <h1 className="font-serif text-lg font-semibold">Rewards & Recognition</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Sign in with your org Google account</p>
        </div>
        <button
          onClick={onSignIn}
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-md text-sm font-medium hover:bg-[var(--secondary)] transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
