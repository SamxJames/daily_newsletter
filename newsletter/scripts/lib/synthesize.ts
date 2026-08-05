import { callClaudeJson } from "./claude";
import type { DigestSection, NewsletterConfig } from "./types";

interface TldrResponse {
  headline: string;
  tldr: string[];
}

const SYSTEM = `You write the top-of-page summary for a personal daily briefing.

Return ONLY a JSON object, no prose and no code fences:
{"headline": "...", "tldr": ["...", "...", "..."]}

- headline: under 12 words, states the single most consequential thing in the briefing. Specific, not a label. "Bank of England holds as inflation cools" beats "Markets update".
- tldr: 3-5 bullets, each under 20 words, covering the most consequential items ACROSS sections. Concrete facts, not topic labels. Plain British English, no markdown, no links.
- Only summarise what is actually in the sections given. Invent nothing.`;

export async function synthesizeSummary(
  sections: DigestSection[],
  config: NewsletterConfig,
): Promise<TldrResponse> {
  const populated = sections.filter((s) => s.body.trim().length > 0);

  if (populated.length === 0) {
    return {
      headline: "No sections available today",
      tldr: ["Every section failed or returned nothing — check the run log below."],
    };
  }

  const body = populated
    .map((s) => `## ${s.title}\n${s.body}`)
    .join("\n\n");

  const { value } = await callClaudeJson<TldrResponse>({
    model: config.claude.model,
    maxTokens: 1200,
    system: SYSTEM,
    prompt: `Here is today's briefing content. Produce the headline and TL;DR.\n\n${body}`,
  });

  return {
    headline: value.headline ?? "Today's briefing",
    tldr: Array.isArray(value.tldr) ? value.tldr.slice(0, 5) : [],
  };
}
