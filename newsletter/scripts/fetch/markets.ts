import { optionalEnv } from "../lib/config";
import type { Instrument, Quote } from "../lib/types";

const BASE = "https://www.alphavantage.co/query";

/**
 * Alpha Vantage free tier allows 25 requests/day and 5/minute, so requests are
 * both capped and paced. Holdings are fetched before the watchlist, meaning if
 * quota runs short it's the less important list that degrades.
 */
export async function fetchQuotes(
  instruments: Instrument[],
  budget: { remaining: number },
): Promise<Quote[]> {
  const apiKey = optionalEnv("ALPHAVANTAGE_API_KEY");
  if (!apiKey) throw new Error("ALPHAVANTAGE_API_KEY is not set");

  const quotes: Quote[] = [];

  for (const instrument of instruments) {
    if (budget.remaining <= 0) {
      quotes.push({
        ...instrument,
        price: null,
        changePercent: null,
        error: "Daily API quota exhausted",
      });
      continue;
    }

    try {
      const url = `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
        instrument.symbol,
      )}&apikey=${apiKey}`;
      const response = await fetch(url);
      budget.remaining -= 1;

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as Record<string, unknown>;

      // Alpha Vantage signals throttling and bad symbols with 200 + a note field.
      if (payload.Note || payload.Information) {
        throw new Error(String(payload.Note ?? payload.Information));
      }

      const quote = payload["Global Quote"] as Record<string, string> | undefined;
      const price = quote?.["05. price"];
      const change = quote?.["10. change percent"];

      if (!price) {
        quotes.push({
          ...instrument,
          price: null,
          changePercent: null,
          error: "No quote returned",
        });
      } else {
        quotes.push({
          ...instrument,
          price: Number(price),
          changePercent: change ? Number(change.replace("%", "")) : null,
        });
      }
    } catch (error) {
      quotes.push({
        ...instrument,
        price: null,
        changePercent: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Pace to stay under 5 requests/minute.
    await new Promise((r) => setTimeout(r, 13_000));
  }

  return quotes;
}

export function formatQuotesForPrompt(label: string, quotes: Quote[]): string {
  if (quotes.length === 0) return "";
  const lines = quotes.map((q) => {
    if (q.price == null) return `- ${q.label} (${q.symbol}): unavailable`;
    const change =
      q.changePercent == null
        ? ""
        : ` (${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%)`;
    return `- ${q.label} (${q.symbol}): ${q.price}${change}`;
  });
  return `${label}:\n${lines.join("\n")}`;
}
