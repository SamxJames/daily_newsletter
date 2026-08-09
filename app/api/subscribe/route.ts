import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadConfig } from "@/scripts/lib/config";

export const runtime = "nodejs";

const SUBSCRIPTION_PATH = "data/push-subscription.json";

interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function isValidSubscription(value: unknown): value is PushSubscriptionPayload {
  if (!value || typeof value !== "object") return false;
  const { endpoint, keys } = value as Record<string, unknown>;
  if (typeof endpoint !== "string" || !keys || typeof keys !== "object") return false;
  const { p256dh, auth } = keys as Record<string, unknown>;
  return typeof p256dh === "string" && typeof auth === "string";
}

/**
 * Commits the subscription straight into the repo via the GitHub Contents
 * API, same pattern the daily pipeline already uses for digest storage —
 * no separate KV/database dependency for a single-device subscription.
 */
export async function POST(request: NextRequest) {
  const token = process.env.GH_PAT;
  if (!token) {
    console.error("GH_PAT not set — cannot persist push subscription");
    return NextResponse.json({ error: "Server not configured for push" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidSubscription(body)) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const { repo } = loadConfig();
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${SUBSCRIPTION_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  try {
    const existing = await fetch(apiUrl, { headers });
    const sha = existing.ok ? ((await existing.json()) as { sha: string }).sha : undefined;

    const content = Buffer.from(JSON.stringify(body, null, 2) + "\n").toString("base64");

    const commit = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Update push subscription",
        content,
        sha,
      }),
    });

    if (!commit.ok) {
      throw new Error(`GitHub API ${commit.status}: ${await commit.text()}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to persist push subscription:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
