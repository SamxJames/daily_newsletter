import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NewsletterConfig } from "./types";

// process.cwd() rather than import.meta.dirname: webpack bundles this file for
// the Next build, where import.meta.dirname is undefined. Both the site build
// and the npm pipeline scripts run from the project root.
export const ROOT = process.cwd();

export function loadConfig(): NewsletterConfig {
  const path = resolve(ROOT, "config/newsletter.config.json");
  return JSON.parse(readFileSync(path, "utf8")) as NewsletterConfig;
}

/** Read a required env var, failing loudly rather than silently producing a broken digest. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

/** Today's date in the owner's timezone as YYYY-MM-DD. */
export function localDate(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Human-readable date, e.g. "Monday 3 August 2026". */
export function displayDate(timezone: string, isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
