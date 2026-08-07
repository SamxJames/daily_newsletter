import { loadConfig, localDate } from "./lib/config";
import { RunLogger } from "./lib/logger";
import { notifyFailure } from "./lib/notify";
import { saveDigest, previousDigest } from "./lib/store";
import { synthesizeSummary } from "./lib/synthesize";
import { sendEmail } from "./lib/email";
import { fetchQuotes, formatQuotesForPrompt } from "./fetch/markets";
import { fetchFplSummary } from "./fetch/fpl";
import { buildSection } from "./fetch/section";
import type { Digest, DigestSection, Quote } from "./lib/types";

async function main() {
  const config = loadConfig();
  const log = new RunLogger();
  const date = localDate(config.owner.timezone);
  const skipEmail = process.argv.includes("--no-email");

  console.log(`Building daily digest for ${date}`);

  // --- Pre-fetch structured data that specific sections depend on ---
  const budget = { remaining: config.markets.maxRequestsPerRun };

  const holdingsResult = await log.track("markets:holdings", () =>
    fetchQuotes(config.markets.holdings, budget),
  );
  const watchlistResult = await log.track("markets:watchlist", () =>
    fetchQuotes(config.markets.watchlist, budget),
  );
  const fplResult = await log.track("fpl:api", () => fetchFplSummary());

  const yesterday = previousDigest();
  const yesterdaySections = new Map(
    (yesterday?.sections ?? []).map((s) => [s.id, s.body]),
  );

  const holdings: Quote[] = holdingsResult.value ?? [];
  const watchlist: Quote[] = watchlistResult.value ?? [];

  const marketContext = [
    formatQuotesForPrompt("Sam's ISA holdings", holdings),
    formatQuotesForPrompt("Defence & infrastructure watchlist", watchlist),
  ]
    .filter(Boolean)
    .join("\n\n");

  // --- Build each section. A failure here degrades one section, not the run ---
  const sections: DigestSection[] = [];

  for (const sectionConfig of config.sections.filter((s) => s.enabled)) {
    const context =
      sectionConfig.kind === "markets"
        ? marketContext
        : sectionConfig.kind === "fpl"
          ? (fplResult.value ?? undefined)
          : undefined;

    const result = await log.track(sectionConfig.id, () =>
      buildSection(
        sectionConfig,
        config,
        context || undefined,
        yesterdaySections.get(sectionConfig.id) || undefined,
      ),
    );

    sections.push({
      id: sectionConfig.id,
      title: sectionConfig.title,
      status: log.statusFor(sectionConfig.id),
      body: result.value?.body ?? "",
      sources: result.value?.sources ?? [],
    });
  }

  if (sections.every((s) => s.body.trim().length === 0)) {
    throw new Error("Every section came back empty or failed — treating as a total failure");
  }

  // --- Headline and TL;DR across the whole digest ---
  const summaryResult = await log.track("summary", () => synthesizeSummary(sections, config));
  const summary = summaryResult.value ?? {
    headline: "Today's briefing",
    tldr: [],
  };

  const digest: Digest = {
    date,
    kind: "daily",
    headline: summary.headline,
    tldr: summary.tldr,
    sections,
    markets: { holdings, watchlist },
    log: log.all(),
    generatedAt: new Date().toISOString(),
  };

  const path = saveDigest(digest);
  console.log(`Saved digest to ${path}`);

  if (skipEmail) {
    console.log("--no-email passed, skipping send");
  } else {
    await sendEmail(digest, config);
    console.log("Email sent");
  }
}

main().catch(async (error) => {
  await notifyFailure("daily run", error);
  process.exit(1);
});
