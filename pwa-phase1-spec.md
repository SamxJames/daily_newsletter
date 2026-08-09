# Daily Brief — PWA Phase Spec

## 1. Goal

Turn the existing password-gated Next.js site into an installable PWA: home-screen icon, full-screen standalone launch, and a push notification when the daily digest is ready. Builds directly on the existing site — no separate codebase.

Explicitly **out of scope** for this phase: offline page caching beyond what the service worker needs for push, multi-device subscriptions, and any App Store work (that's Phase 2, separately scoped, native-shell territory).

## 2. What "done" looks like

- Visiting the site on iOS Safari and using Share → Add to Home Screen produces a proper icon and launches full-screen, no browser chrome.
- On first launch, a simple in-page prompt asks to enable notifications; accepting triggers iOS's native permission dialog.
- The next time the daily pipeline runs and produces a digest, a push notification arrives on the device, and tapping it opens the site.
- If the push step fails for any reason, the email and website still work as before — push is an additive channel, not a dependency.

## 3. Architecture

```
Browser (installed PWA)
  ├─ Service worker registers, requests push permission
  ├─ Subscription object POSTed to /api/subscribe
  └─ /api/subscribe commits it to data/push-subscription.json via the GitHub API

GitHub Actions (daily run, after digest is saved)
  ├─ Reads data/push-subscription.json (already checked out)
  ├─ Sends a Web Push message via the `web-push` library + VAPID keys
  └─ Logs outcome — failure here does not fail the run
```

## 4. Decisions

**Where the push subscription lives — proposed: commit it to the repo via the GitHub API.**
When the browser grants permission, it generates a subscription object that has to be stored somewhere the next day's GitHub Action can read. Options considered:
- *Manual*: copy the subscription into a GitHub secret by hand. Zero infra, but breaks silently if the subscription ever rotates (rare for a single device, but possible).
- *External KV store* (Vercel KV / Upstash): proper solution, but a new paid/free-tier dependency for something this small.
- *Commit via GitHub API* (proposed): the `/api/subscribe` route uses a scoped GitHub PAT to write `data/push-subscription.json` straight into the repo, same pattern already used for digest storage. Fully automatic, no new external service, survives subscription rotation without manual intervention.

**VAPID keys — generate once, store as secrets.**
Run `npx web-push generate-vapid-keys` locally, once. Public key gets baked into the client-side subscription code (this is meant to be public). Private key and a subject (`mailto:` address) go into two new GitHub secrets: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. `/api/subscribe` also needs the public key at runtime as a Vercel environment variable.

**Where the push fires in the pipeline — proposed: after digest save, alongside the email send, non-blocking.**
Consistent with the existing failure-handling principle (logs-based, alert only on total failure): a failed push send gets logged but does **not** trigger the Discord total-failure alert, since email remains the primary channel and the digest itself succeeded. It also doesn't block or delay the email send — they fire independently.

**New secret needed:** `GITHUB_PAT` (fine-grained, repo contents read/write only, scoped to this repo) for the subscribe endpoint.

**Icon set.**
iOS needs several sizes — 180×180 (apple-touch-icon), plus 192×192 and 512×512 for the manifest. The existing visual identity is fairly text/typography-driven (Bricolage Grotesque wordmark, status-rail ticks), which won't read at icon size. Proposed: a simplified mark — a single geometric form in the teal accent, adaptive for light/dark home screens — rather than trying to shrink existing page elements. I'll design this at build time.

## 5. What the GitHub Action gains

One new step in `daily.yml`, after the existing "Commit digest" step: read the stored subscription, send the push via `web-push`, log success/failure, continue regardless.

## 6. Open to change

The subscription-storage approach (§4, GitHub API commit) and the trigger point are the two decisions most worth a second look before I build — everything else is fairly mechanical. Happy to switch to the external KV store or the manual-secret approach if either sounds better to you.
