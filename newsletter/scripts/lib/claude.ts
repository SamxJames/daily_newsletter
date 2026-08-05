import { requireEnv } from "./config";
import type { SourceLink } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";

interface ContentBlock {
  type: string;
  text?: string;
  content?: unknown;
  [key: string]: unknown;
}

interface MessagesResponse {
  content: ContentBlock[];
  [key: string]: unknown;
}

export interface ClaudeCallOptions {
  model: string;
  maxTokens: number;
  system?: string;
  prompt: string;
  /** Enable the server-side web search tool. */
  webSearch?: boolean;
  maxSearches?: number;
}

async function postWithRetry(body: unknown, attempts = 3): Promise<MessagesResponse> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Retryable API error ${response.status}: ${await response.text()}`);
      }
      if (!response.ok) {
        throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
      }
      return (await response.json()) as MessagesResponse;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        // Exponential backoff, jittered, so a transient blip doesn't lose the run.
        const wait = 2 ** attempt * 1000 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Pull all text blocks out of a response, ignoring tool-use scaffolding. */
function extractText(data: MessagesResponse): string {
  return data.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}

/**
 * Pull source URLs out of web_search_tool_result blocks so every news-derived
 * claim can carry attribution through to the rendered digest.
 */
function extractSources(data: MessagesResponse): SourceLink[] {
  const sources: SourceLink[] = [];
  const seen = new Set<string>();

  for (const block of data.content) {
    if (block.type !== "web_search_tool_result") continue;
    const results = Array.isArray(block.content) ? block.content : [];
    for (const result of results as Array<Record<string, unknown>>) {
      const url = typeof result.url === "string" ? result.url : null;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({
        title: typeof result.title === "string" ? result.title : url,
        url,
        outlet: outletFromUrl(url),
      });
    }
  }
  return sources;
}

export function outletFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export async function callClaude(
  options: ClaudeCallOptions,
): Promise<{ text: string; sources: SourceLink[] }> {
  const body: Record<string, unknown> = {
    model: options.model,
    max_tokens: options.maxTokens,
    messages: [{ role: "user", content: options.prompt }],
  };
  if (options.system) body.system = options.system;
  if (options.webSearch) {
    body.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: options.maxSearches ?? 4,
      },
    ];
  }

  const data = await postWithRetry(body);
  return { text: extractText(data), sources: extractSources(data) };
}

/** Call Claude expecting a JSON object back, tolerating stray code fences. */
export async function callClaudeJson<T>(options: ClaudeCallOptions): Promise<{
  value: T;
  sources: SourceLink[];
}> {
  const { text, sources } = await callClaude(options);
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  // Fall back to the outermost brace pair if the model wrapped the JSON in prose.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return { value: JSON.parse(candidate) as T, sources };
  } catch (error) {
    throw new Error(
      `Could not parse JSON from Claude response: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
