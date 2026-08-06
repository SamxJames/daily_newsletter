# Daily Brief

A personalised daily briefing. Gathers market, FPL, data, career, insurance, Milton Keynes and general news, synthesises it with Claude, emails a short summary, and publishes the full digest to a password-gated site.

Built to the spec in `daily-newsletter-spec.md`.

---

## Setup

Everything below can be done from a phone browser. Roughly 20 minutes.

### 1. Get the API keys

| Service | Where | Free tier |
|---|---|---|
| Anthropic | console.anthropic.com → API Keys | Pay-as-you-go, ~£3–8/month at this volume |
| Alpha Vantage | alphavantage.co/support/#api-key | 25 requests/day — instant, no card |
| Resend | resend.com → API Keys | 3,000 emails/month |

Discord webhook: in your existing server, Channel Settings → Integrations → Webhooks → New Webhook → Copy URL. Use a separate channel from the trading bot if you'd rather keep alerts apart.

### 2. Push this repo to GitHub

Make it **private** — `data/` accumulates your holdings and briefing history.

### 3. Add repository secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `ANTHROPIC_API_KEY` | from step 1 |
| `ALPHAVANTAGE_API_KEY` | from step 1 |
| `RESEND_API_KEY` | from step 1 |
| `NEWSLETTER_TO` | the email address to receive the brief |
| `DISCORD_WEBHOOK_URL` | for total-failure alerts |
| `VERCEL_DEPLOY_HOOK` | added in step 4 |

### 4. Deploy to Vercel

1. vercel.com → Add New → Project → import this repo. Framework auto-detects as Next.js.
2. Before deploying, add environment variables:
   - `SITE_USER` — e.g. `sam`
   - `SITE_PASSWORD` — pick something long
3. Deploy.
4. Settings → Git → Deploy Hooks → create one named `daily`, branch `main`. Copy the URL into the `VERCEL_DEPLOY_HOOK` GitHub secret.

The site is gated by HTTP basic auth in `middleware.ts`. It **fails closed** — with no `SITE_PASSWORD` set it returns 503 rather than publishing your holdings publicly.

### 5. Set the recipient

Either set the `NEWSLETTER_TO` secret (recommended) or edit `email.to` in `config/newsletter.config.json`.

Resend's shared `onboarding@resend.dev` sender works immediately but only delivers to the address on your Resend account. To send anywhere else, verify a domain in Resend and update `email.from`.

### 6. Run it

Repo → Actions → Daily Brief → Run workflow. Tick "Build the digest without sending the email" for a first run if you want to check the output before anything lands in your inbox.

After that it runs itself at 06:30 UK daily, with the weekly rollup on Sundays at 08:00.

---

## Configuration

`config/newsletter.config.json` holds everything tunable — no need to touch the pipeline code:

- **`markets.holdings` / `markets.watchlist`** — tickers. Alpha Vantage uses `.LON` suffixes for LSE listings. Currently 12 tickers against a 25/day cap, so there's headroom for about 8 more.
- **`sections`** — each has `enabled`, a `prompt` steering tone and focus, and `queries` seeding the searches. Set `enabled: false` to drop a section; reorder the array to reorder the page.
- **`claude.model`** — the synthesis model.

The watchlist is a placeholder set of UK defence and infrastructure names. Swap in whatever you actually want tracked.

---

## How it works

```
GitHub Actions (cron)
  ├─ Alpha Vantage  → holdings and watchlist quotes
  ├─ FPL API        → deadline, price moves, injury news
  ├─ Claude + web search → one call per section, with sources
  ├─ Claude         → headline and TL;DR across sections
  ├─ data/YYYY-MM-DD.json committed back to the repo
  ├─ Resend         → short email linking to the site
  └─ Vercel hook    → rebuild and publish
```

Storing each day's digest as JSON gives the archive and the weekly rollup for free — Sunday's run synthesises across the last seven files rather than re-searching a week after the fact.

### Failure handling

Two tiers, as specified:

- **Section-level** — a failed or empty section degrades only itself. Status shows in the rail at the top of the page and in the expandable run log at the bottom. Judged by eye.
- **Total failure** — if nothing publishes, a Discord webhook fires. This is the only automated alert.

---

## Local development

```bash
npm install
npm run typecheck
npm run daily:dry     # build a digest without emailing
npm run dev           # preview at localhost:3000
```

`npm run dev` needs `SITE_PASSWORD` set or the gate returns 503:

```bash
SITE_PASSWORD=test npm run dev
```

---

## Notes

- **DST** — GitHub cron is UTC only, so both workflows register two schedules and self-check the London hour, skipping the off-season one. No double sends.
- **Alpha Vantage pacing** — requests are spaced 13s apart to stay under 5/minute. The markets step takes ~3 minutes; this is expected.
- **Vercel password protection** — the native feature needs Pro plus a $150/month add-on. The middleware gate here does the same job on the free Hobby plan.
