import { callClaude } from "../lib/claude";
import type { NewsletterConfig, SectionConfig, SourceLink } from "../lib/types";

const SYSTEM = `You write one section of a personal daily briefing for Sam, a senior data professional in Milton Keynes, UK.

Rules:
- Search the web for what is actually current. Do not rely on prior knowledge for anything time-sensitive.
- Write in plain British English. Analytical and direct, no hype, no filler, no "in today's fast-moving world" throat-clearing.
- Explain causes, not just events. "X happened because Y" beats "X happened".
- Markdown only: short paragraphs and bullet lists. No headings — the section already has a title.
- Cite inline as [outlet name](url) on the specific claim it supports. Every factual item needs one.
- Aim for 120-220 words. Brevity is a feature; this is read on a phone at 6:30am.
- If genuinely nothing noteworthy happened, reply with exactly: NOTHING_SIGNIFICANT
  Do not pad a quiet day into filler.`;

export interface SectionResult {
  body: string;
  sources: SourceLink[];
}

export async function buildSection(
  section: SectionConfig,
  config: NewsletterConfig,
  extraContext?: string,
): Promise<SectionResult | null> {
  const contextBlock = extraContext
    ? `\n\nUse this pre-fetched data as your factual base. It is authoritative — prefer it over search results where they conflict:\n\n${extraContext}`
    : "";

  const prompt = `Write the "${section.title}" section of today's briefing.

${section.prompt}

Suggested search angles (adapt as needed, and search several to get a spread of sources rather than leaning on one):
${section.queries.map((q) => `- ${q}`).join("\n")}${contextBlock}`;

  const { text, sources } = await callClaude({
    model: config.claude.model,
    maxTokens: 2000,
    system: SYSTEM,
    prompt,
    webSearch: true,
    maxSearches: Math.max(3, section.queries.length + 1),
  });

  if (!text || text.includes("NOTHING_SIGNIFICANT")) return null;
  return { body: text, sources };
}
