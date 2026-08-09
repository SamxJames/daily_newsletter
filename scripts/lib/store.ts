import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./config";
import type { Digest } from "./types";

const DATA_DIR = resolve(ROOT, "data");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function saveDigest(digest: Digest): string {
  ensureDir();
  const name = digest.kind === "weekly" ? `${digest.date}-weekly.json` : `${digest.date}.json`;
  const path = resolve(DATA_DIR, name);
  writeFileSync(path, JSON.stringify(digest, null, 2));
  return path;
}

export function listDigestDates(kind: "daily" | "weekly" = "daily"): string[] {
  ensureDir();
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => (kind === "weekly" ? f.includes("-weekly") : !f.includes("-weekly")))
    .map((f) => f.replace("-weekly", "").replace(".json", ""))
    .sort()
    .reverse();
}

export function readDigest(date: string, kind: "daily" | "weekly" = "daily"): Digest | null {
  const name = kind === "weekly" ? `${date}-weekly.json` : `${date}.json`;
  const path = resolve(DATA_DIR, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Digest;
}

/** The last N daily digests, newest first — the input for the Sunday rollup. */
export function recentDigests(count: number): Digest[] {
  return listDigestDates("daily")
    .slice(0, count)
    .map((date) => readDigest(date))
    .filter((d): d is Digest => d !== null);
}

/**
 * Most recently stored daily digest — normally yesterday's, since this is
 * called before today's digest is saved. Used so each section can avoid
 * re-covering a story that hasn't actually moved on since last time.
 */
export function previousDigest(): Digest | null {
  const [mostRecent] = listDigestDates("daily");
  return mostRecent ? readDigest(mostRecent) : null;
}
