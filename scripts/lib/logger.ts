import type { LogEntry, SectionStatus } from "./types";

/**
 * Collects per-section outcomes for the run. These are surfaced on the webpage
 * (the status rail) rather than pushed to an alerting channel — only a total
 * pipeline failure triggers a Discord ping.
 */
export class RunLogger {
  private entries: LogEntry[] = [];

  record(sectionId: string, status: SectionStatus, durationMs: number, detail?: string) {
    this.entries.push({ sectionId, status, durationMs, detail });
    const label = status.toUpperCase().padEnd(6);
    console.log(`[${label}] ${sectionId} (${durationMs}ms)${detail ? ` — ${detail}` : ""}`);
  }

  /** Times an async step and records its outcome. Never throws — a failed section
   *  degrades that section only, leaving the rest of the digest intact. */
  async track<T>(
    sectionId: string,
    fn: () => Promise<T>,
  ): Promise<{ value: T | null; status: SectionStatus }> {
    const started = Date.now();
    try {
      const value = await fn();
      const empty =
        value == null || (Array.isArray(value) && value.length === 0);
      const status: SectionStatus = empty ? "empty" : "ok";
      this.record(sectionId, status, Date.now() - started);
      return { value: empty ? null : value, status };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.record(sectionId, "failed", Date.now() - started, detail);
      return { value: null, status: "failed" };
    }
  }

  all(): LogEntry[] {
    return this.entries;
  }

  statusFor(sectionId: string): SectionStatus {
    return this.entries.find((e) => e.sectionId === sectionId)?.status ?? "failed";
  }
}
