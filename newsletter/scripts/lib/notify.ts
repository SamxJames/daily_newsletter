import { optionalEnv } from "./config";

/**
 * Fires only when the run fails outright and nothing publishes. Section-level
 * problems are deliberately NOT alerted on — they show up in the status rail on
 * the page, which gets read anyway.
 */
export async function notifyFailure(context: string, error: unknown): Promise<void> {
  const webhook = optionalEnv("DISCORD_WEBHOOK_URL");
  const message = error instanceof Error ? error.stack || error.message : String(error);

  console.error(`FATAL (${context}):`, message);

  if (!webhook) {
    console.error("DISCORD_WEBHOOK_URL not set — skipping failure notification");
    return;
  }

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Daily Brief",
        embeds: [
          {
            title: "Newsletter pipeline failed",
            description: `**${context}**\n\`\`\`\n${message.slice(0, 1500)}\n\`\`\``,
            color: 0xc0392b,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (notifyError) {
    // Never let the alerting path mask the original failure.
    console.error("Failed to send Discord notification:", notifyError);
  }
}
