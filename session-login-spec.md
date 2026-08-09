# Daily Brief — Session Login Spec

## 1. Goal

Replace the HTTP Basic Auth gate with a proper login form that issues a long-lived, signed session cookie — so the installed PWA effectively never re-prompts for a password in normal daily use, without depending on iOS's currently unreliable Face ID/Keychain support inside installed standalone apps.

This directly targets the actual annoyance (repeated logins) rather than chasing biometrics, which the evidence says may just not work well in this context regardless of how much engineering goes into it.

## 2. Why not Basic Auth + Face ID

Confirmed from current sources: installed home-screen PWAs on iOS run in a different context to a Safari tab and lose reliable access to Keychain autofill — this affects Basic Auth *and* proper WebAuthn/passkey implementations alike, and is a platform-level gap, not something fixable from our side. Chasing it further risks real build effort for something that may not end up working. A long session sidesteps the problem entirely.

## 3. What "done" looks like

- Visiting the site without a valid session shows a simple one-field (password-only) login page.
- Correct password → signed cookie issued, redirected straight to the digest.
- Wrong password → simple inline error, no redirect.
- From then on, both the browser tab and the installed home-screen app skip the login page entirely, for as long as the session is valid.
- Staying in regular use keeps the session alive indefinitely (sliding expiry, below) — it only actually expires if the site goes untouched for a long stretch.
- Manifest, icons, and the service worker remain excluded from the gate, unchanged from the PWA phase.

## 4. Architecture

```
Request comes in
  ├─ middleware.ts checks for a valid signed session cookie
  ├─ Valid → request proceeds, cookie's expiry is refreshed (sliding window)
  └─ Missing/invalid → redirect to /login

/login (page)
  └─ Simple form, single password field, POSTs to /api/login

/api/login (route)
  ├─ Validates password against SITE_PASSWORD
  ├─ Correct → issues a signed, HttpOnly, Secure cookie, redirects to /
  └─ Incorrect → re-renders /login with an error
```

**Signing**: an HMAC over a payload (issued time) using a new `SESSION_SECRET`, via Node's built-in `crypto` — no new dependency needed. The cookie is only valid if its signature checks out; forging one without the secret isn't feasible.

**Sliding expiry**: proposed default **180 days**, refreshed on every successful request. In practice, since you'll open the app regularly, the session effectively never expires through normal use — it only lapses if the site goes untouched for six months, which is a reasonable safety property for something holding your ISA holdings and career notes.

**Revocation**: no explicit logout flow is needed for a single-user tool, but rotating `SESSION_SECRET` in Vercel instantly invalidates every issued session at once — that's the documented way to force a re-login everywhere (e.g. if a device is ever lost).

## 5. Changes from the current setup

- `middleware.ts`: swap the 401/WWW-Authenticate Basic Auth challenge for a cookie check + redirect
- New: `/login` page, `/api/login` route
- `SITE_USER` becomes redundant — proposing to drop it in favour of a single password field, since there's only one user
- New secret: `SESSION_SECRET` (Vercel env var — generate once with `openssl rand -hex 32`)
- `SITE_PASSWORD` stays as-is, reused for the new login form

## 6. Security notes

- `Secure` flag requires HTTPS, which Vercel already provides by default
- `HttpOnly` — cookie isn't readable from client-side JS, standard practice
- `SameSite=Lax` — reasonable default, doesn't interfere with normal navigation
- Still fails closed: if `SITE_PASSWORD` or `SESSION_SECRET` aren't configured, the site should refuse to serve rather than silently allow access — same principle as the current middleware

## 7. Effort

Small — comparable to the PWA phase, a few hours. One new page, one new API route, a middleware rewrite, no new external dependencies. Sonnet-tier work, same as before.
