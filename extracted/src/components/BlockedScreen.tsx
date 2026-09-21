export function BlockedScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="ds-card p-8 max-w-sm w-full text-center space-y-4">
        <p className="text-[var(--warning-foreground)] bg-[var(--warning-light-background)] border border-[var(--warning-foreground)]/20 rounded-[var(--radius-sm)] px-4 py-3 text-sm">
          {message}
        </p>
        <button onClick={onRetry} className="btn btn-text btn-md">
          Try a different account
        </button>
      </div>
    </div>
  )
}
