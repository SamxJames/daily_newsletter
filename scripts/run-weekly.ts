import { callClaudeJson } from "./lib/claude";
import { loadConfig, localDate } from "./lib/config";
import { RunLogger } from "./lib/logger";
import { notifyFailure } from "./lib/notify";
import { recentDigests, saveDigest } from "./lib/store";
import { sendEmail } from "./lib/email";
import type { Digest, DigestSection, SourceLink } from "./lib/types";

const SYSTEM = `You write a weekly "week in review" for Sam, a senior data professional in Milton Keynes, UK.

You are given the past week's daily briefings. Distil the week — do not replay it day by day.

Return ONLY a JSON object, no code fences:
{
  "headline": "under 12 words, the week's single most consequential development",
  "tldr": ["3-5 bullets, under 20 words each, the week's most important items"],
  "sections": [{"id": "...", "title": "...", "body": "markdown"}]
}

For each section body:
- Identify the throughline: what actually developed over the week, and why it matters going forward.
- Prioritise items that built over several days over one-off blips.
- Keep existing markdown links intact when reusing a specific claim, so attribution survives.
- 100-200 words per section. Omit a section entirely if the week had nothing worth reporting in it.
- Plain British English, analytical, no filler.`;

interface WeeklyResponse {
  headline: string;
  tldr: string[];
  sections: Array<{ id: string; title: string; body: string }>;
}

async function main() {
  const config = loadConfig();
  const log = new RunLogger();
  const date = localDate(config.owner.timezone);
  const skipEmail = process.argv.includes("--no-email");

  const week = recentDigests(7);
  if (week.length === 0) {
    throw new Error("No daily digests found to roll up");
  }
  console.log(`Rolling up ${week.length} daily digests`);

  // Carry every source link forward so the rollup stays attributable.
  const sourcesBySection = new Map<string, SourceLink[]>();
  for (const day of week) {
    for (const section of day.sections) {
      const existing = sourcesBySection.get(section.id) ?? [];
      sourcesBySection.set(section.id, [...existing, ...section.sources]);
    }
  }

  const corpus = week
    .slice()
    .reverse()
    .map((day) => {
      const body = day.sections
        .filter((s) => s.body.trim().length > 0)
        .map((s) => `### ${s.title} [id:${s.id}]\n${s.body}`)
        .join("\n\n");
      return `# ${day.date}\n${body}`;
    })
    .join("\n\n---\n\n");

  const result = await log.track("weekly:synthesis", () =>
    callClaudeJson<WeeklyResponse>({
      model: config.claude.model,
      maxTokens: config.claude.maxTokens,
      system: SYSTEM,
      prompt: `Here are the past ${week.length} daily briefings. Produce the week in review.\n\n${corpus}`,
    }),
  );

  if (!result.value) throw new Error("Weekly synthesis failed");
  const weekly = result.value.value;

  const sections: DigestSection[] = (weekly.sections ?? []).map((s) => {
    // De-duplicate sources by URL, keeping the week's spread manageable.
    const seen = new Set<string>();
    const sources = (sourcesBySection.get(s.id) ?? []).filter((source) => {
      if (seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    });

    return {
      id: s.id,
      title: s.title,
      status: "ok" as const,
      body: s.body,
      sources: sources.slice(0, 12),
    };
  });

  const digest: Digest = {
    date,
    kind: "weekly",
    headline: weekly.headline ?? "Week in review",
    tldr: Array.isArray(weekly.tldr) ? weekly.tldr.slice(0, 5) : [],
    sections,
    log: log.all(),
    generatedAt: new Date().toISOString(),
  };

  const path = saveDigest(digest);
  console.log(`Saved weekly digest to ${path}`);

  if (skipEmail) {
    console.log("--no-email passed, skipping send");
  } else {
    await sendEmail(digest, config);
    console.log("Email sent");
  }
}

main().catch(async (error) => {
  await notifyFailure("weekly rollup", error);
  process.exit(1);
});
