import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import webpush from "web-push";
import { ROOT, loadConfig, requireEnv } from "./lib/config";
import { listDigestDates, readDigest } from "./lib/store";

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Sends today's push notification, if a subscription is on file. Deliberately
 * never throws past main() — push is additive; a failure here must not fail
 * the workflow run or trigger the Discord total-failure alert, which is
 * reserved for the digest itself failing to build.
 */
async function main() {
  const path = resolve(ROOT, "data/push-subscription.json");
  if (!existsSync(path)) {
    console.log("[push] No subscription on file — skipping.");
    return;
  }

  const subscription = JSON.parse(readFileSync(path, "utf8")) as StoredSubscription;

  const config = loadConfig();
  webpush.setVapidDetails(
    requireEnv("VAPID_SUBJECT"),
    requireEnv("VAPID_PUBLIC_KEY"),
    requireEnv("VAPID_PRIVATE_KEY"),
  );

  const [latestDate] = listDigestDates("daily");
  const digest = latestDate ? readDigest(latestDate) : null;

  const payload = JSON.stringify({
    title: "Daily Brief",
    body: digest?.headline || "Today's briefing is ready.",
    url: latestDate ? `${config.siteUrl}/${latestDate}` : config.siteUrl,
  });

  await webpush.sendNotification(subscription, payload);
  console.log("[push] Sent successfully.");
}

main().catch((error) => {
  console.error("[push] Failed to send:", error instanceof Error ? error.message : error);
});
