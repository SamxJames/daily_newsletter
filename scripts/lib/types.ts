export type SectionKind = "markets" | "fpl" | "search";

export interface SectionConfig {
  id: string;
  title: string;
  enabled: boolean;
  kind: SectionKind;
  prompt: string;
  queries: string[];
}

export interface Instrument {
  symbol: string;
  label: string;
}

export interface NewsletterConfig {
  owner: { name: string; timezone: string; sendHourLocal: string };
  siteUrl: string;
  markets: {
    provider: string;
    indices: Instrument[];
    holdings: Instrument[];
    watchlist: Instrument[];
    maxRequestsPerRun: number;
  };
  sections: SectionConfig[];
  email: { from: string; to: string; subjectPrefix: string };
  claude: { model: string; maxTokens: number };
}

/** Status of a single section's data-gathering step. */
export type SectionStatus = "ok" | "empty" | "failed";

export interface LogEntry {
  sectionId: string;
  status: SectionStatus;
  detail?: string;
  durationMs: number;
}

export interface Quote {
  symbol: string;
  label: string;
  price: number | null;
  changePercent: number | null;
  error?: string;
}

export interface SourceLink {
  title: string;
  url: string;
  outlet?: string;
}

/** A rendered section of the digest, produced by the synthesis step. */
export interface DigestSection {
  id: string;
  title: string;
  status: SectionStatus;
  /** Markdown body. Empty string when nothing significant was found. */
  body: string;
  sources: SourceLink[];
}

export interface Digest {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  kind: "daily" | "weekly";
  headline: string;
  tldr: string[];
  sections: DigestSection[];
  markets?: {
    holdings: Quote[];
    watchlist: Quote[];
  };
  log: LogEntry[];
  generatedAt: string;
}
