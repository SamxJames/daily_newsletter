# Personal Daily Newsletter — Project Spec

## 1. Purpose
A daily digest, personalised to Sam, covering six sections, delivered by email and available as a webpage. Built as a standalone automation following the same pattern as the existing trading bot / Discord digest infra (GitHub Actions cron + webhook/API delivery).

## 2. Sections & Content Sources

| Section | Content | Source |
|---|---|---|
| **Investing** | Broad market overview: major index moves (S&P 500, FTSE, Nikkei, etc.), key macro drivers (rates, inflation, central bank moves, geopolitical events) and *why* markets moved, not just price ticks. Includes price moves for ISA holdings (Vanguard S&P 500, Vanguard FTSE Dev World ex-UK, iShares MSCI Japan, ASML, AMD, WisdomTree Europe Defence) and UK defence/infrastructure watchlist as a supporting layer, not the main focus | Web search for macro news/analysis (primary) + **Alpha Vantage** (official, NASDAQ-licensed, free tier: 25 requests/day, covers LSE and other global exchanges) for holding-specific price data — chosen over Yahoo Finance's unofficial API, which risks being rate-limited/blocked since GitHub Actions runners share rotating datacenter IPs that Yahoo flags more readily than a residential connection |
| **FPL** | General Fantasy Premier League news: gameweek deadlines, price changes, injury news, differential picks | Official FPL API (`fantasy.premierleague.com/api/`) — free, no key needed |
| **Data** | BI/data industry news: Power BI, BigQuery, DAX, semantic layer, data viz trends | Web search |
| **Career** | Data leadership market signals: Head of Data/Director-level hiring trends, salary benchmarks, relevant thought leadership | Web search |
| **UK Insurance** | FCA regulatory updates, insurtech/MGA news relevant to Policy Expert's space | Web search |
| **MK & local networking** | Upcoming networking/tech events in the Milton Keynes area (e.g. MK Tech Week), flagged as they're announced, plus general local MK news (council/planning, development, community stories) | Web search |
| **General news** | Top UK/world headlines, kept brief | Web search or a news API (e.g. NewsAPI free tier), deliberately sampled across a varied set of reliable outlets (e.g. BBC, Reuters, AP, FT) rather than a single source, to avoid one outlet's framing dominating the digest |

## 3. Architecture

```
GitHub Actions (daily cron, e.g. 06:30 UK time)
   │
   ├─ 1. Fetch: stock prices, FPL data, news searches
   ├─ 2. Call Claude API → synthesize digest from gathered data
   ├─ 3a. Send brief summary email via Resend (free tier), linking to the full webpage
   └─ 3b. Publish full page → Vercel (password-protected)
```

- **Compute**: GitHub Actions, scheduled workflow (`cron` trigger) — no server needed, consistent with your existing bot infra
- **Content generation**: Claude API call (Sonnet), given the day's raw data, prompted to produce a structured digest across the six sections
- **Email delivery**: **Resend** — free tier: 3,000 emails/month, 100/day, 1 verified domain. Comfortably covers 1 email/day. (Confirmed current as of Aug 2026; SendGrid's free tier no longer exists, which rules that option out.)
- **Webpage delivery**: page rebuilt daily and deployed to **Vercel** (free Hobby plan) as a Next.js app — a fully static export won't support the middleware-based password gate below, so this needs to run as a standard Next.js deployment (still free on Hobby). Note: Vercel's native Password Protection requires the Pro plan plus a $150/month add-on, which isn't worth it here — instead, use a lightweight self-hosted password gate (e.g. Next.js middleware basic auth), which works on the free plan and is sufficient for keeping this private to Sam. GitHub Action triggers the deploy (e.g. via Vercel CLI/deploy hook)
- **Configuration**: holdings, watchlist tickers, section toggles, and other tunables live in a single config file (JSON/YAML) in the repo, kept separate from pipeline code, so they can be updated without touching the scripts
- **Secrets**: Claude API key, Resend API key, Alpha Vantage API key stored as GitHub Actions repo secrets

## 3a. Sourcing & Attribution

Wherever a section draws on news or web search (investing, data, career, UK insurance, general news), the digest includes a link to the original article alongside the summary — not just a bare claim. This applies to both the email and webpage versions. Practically: the synthesis step needs to retain the URL for each search result it draws from and carry it through into the final formatted output (e.g. as a "Source: [outlet name]" link under each item).

## 3b. Weekly Rollup (Sundays)

In addition to the daily digest, a "week in review" runs on Sundays — same architecture (GitHub Actions, second scheduled workflow or a conditional branch in the daily one), summarising the week's notable items per section rather than repeating daily detail. Particularly useful for sections that are sparse day-to-day (career, UK insurance, MK & local networking) where a single day's search often turns up little, but a week's worth of items is worth surfacing together. Implementation-wise: either store each day's raw digest content (e.g. as a JSON file per day in the repo) and have the Sunday run synthesize across the past 7 files, or re-run broader searches once a week — storing daily outputs is more reliable since it reflects what was actually reported that day rather than re-searching after the fact.

## 3c. Front-End Direction

**Email vs. webpage split**: the email is a brief summary only (headline items per section, no charts/interactivity) with a link through to the full webpage digest for that day. This keeps email HTML simple (inline CSS, cross-client safe) while the webpage carries the real content depth — richer formatting, interactive charts (e.g. a holdings/ISA performance chart), and the full write-up per section.

**Visual identity**: a distinctive, intentional design — not a generic AI-template look (avoid the common defaults: cream background + terracotta accent, near-black with a single neon accent, or generic broadsheet columns unless deliberately chosen). Proper type hierarchy, a considered layout, and a genuine point of view given the daily-read, data-professional audience (i.e. Sam). The TL;DR/skim layer and "nothing significant today" empty states should be designed as real elements, not afterthoughts.

**Light + dark theme**: both required, designed together as a pair rather than dark-mode-as-inverted-light-mode — separate palettes tuned for readability in each.

**Mobile-first**: layout designed for phone reading first (this will be checked daily on mobile), then scaled up for desktop. Archive/navigation (browsing past digests) also needs a mobile-friendly pattern, e.g. a simple chronological list rather than a dense date-picker grid.

## 3d. Failure Handling

Two tiers, no dry-run phase (going straight to live):
- **Partial/section-level failures**: no automated alerting. Each run writes a **log file** (per-section status: succeeded / failed / empty, with error detail where relevant) alongside the digest output. The log is surfaced on the webpage itself (e.g. a small status strip or footer, visible only via the password-protected page) so these are caught by eye during the daily read. Logs also persist in the repo/build history for later debugging.
- **Total pipeline failure** (e.g. the whole run errors out and nothing publishes): a fallback alert via the existing **Discord webhook** infra (reused from the trading bot), so a fully silent failure day doesn't go unnoticed. This is the only automated alert in v1 — everything short of total failure is judged by eye via the logs.

## 3e. Cost Scoping

Rough monthly cost, to size before committing:
- **Claude API**: 1 synthesis call/day (30/month) + 1 weekly rollup call (~4/month) — token cost depends on how much raw search content gets passed in per call; worth estimating actual token counts once the search step is built, but likely single-digit £/month for a single-user digest
- **Web search calls**: ~6 sections × 1–2 searches/day — if using Claude's own web search tool this is bundled into the API cost; if using a separate search API, check its free tier/pricing
- **Resend**: free (within 3,000/month, 100/day limits)
- **Vercel**: free (Hobby plan) covers hosting; native Password Protection costs $150/month (Pro + add-on) and should be avoided — a self-hosted middleware-based password gate keeps this on the free plan
- **GitHub Actions**: free tier minutes comfortably cover one short daily job

Will pin down actual figures once the build is underway and real token/call volumes are known.

## 4. Data flow detail

1. **Investing**: search for macro market overview (index moves, rates, inflation, central banks, geopolitical drivers) and *why* — root-cause framing, not just numbers; pull latest close + % change for each ISA holding and watchlist ticker via Alpha Vantage as a supporting layer (~16 tickers fits within the 25-requests/day free cap, but leaves little buffer — worth confirming the final watchlist count before build so the daily run doesn't run out of quota mid-way)
2. **FPL**: pull general news via search (or FPL API bootstrap-static endpoint for price changes/injuries) — team-specific detail deferred since no team ID provided yet
3. **News/industry/career/insurance sections**: targeted web searches per section, summarised — for the general news section specifically, queries deliberately span multiple reliable outlets (e.g. BBC, Reuters, AP, FT) rather than pulling from whichever source ranks first, so no single outlet's framing dominates
4. **Synthesis step**: one Claude API call combining all raw inputs into a formatted digest (Markdown), following a fixed template so formatting stays consistent day to day, with each news-derived item carrying a source link through to the output
5. **Output**: digest converted to email HTML (via Resend) and to a static page (via a simple HTML template or React Email components, reused for both)

## 5. Open items for build phase

- Domain for Resend verification (or use Resend's shared testing domain initially, which allows sending only to your own verified address — fine for a personal-use case)
- Set up Vercel project + password protection, decide repo (new repo, or within an existing one)
- Set a fixed daily send time
- Decide watchlist tickers for the defence/infrastructure section explicitly (reuse the equity research brief list already built, or a fresh list)
- Confirm the Discord webhook URL to reuse (same one as the trading bot, or a separate channel for this project)

## 6. Rough build sequence

1. Scaffold repo + GitHub Action skeleton (cron trigger, secrets wiring)
2. Build data-fetch scripts per section (start with FPL + stocks, since APIs are straightforward)
3. Build the Claude API synthesis call with a fixed prompt template
4. Wire up Resend send
5. Wire up Vercel deploy (with password protection)
6. Test end-to-end with a manual workflow trigger before relying on the schedule
