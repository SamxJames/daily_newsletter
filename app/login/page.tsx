export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const failed = searchParams.error === "1";

  return (
    <main className="shell login-shell">
      <div className="login-card">
        <div className="masthead-date">Daily Brief</div>
        <h1 className="headline login-headline">Sign in</h1>
        <form method="POST" action="/api/login" className="login-form">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            required
            className="login-input"
          />
          <button type="submit" className="login-submit">
            Continue
          </button>
        </form>
        {failed && <p className="login-error">Incorrect password.</p>}
      </div>
    </main>
  );
}
