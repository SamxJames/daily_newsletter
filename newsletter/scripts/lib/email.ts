import { displayDate, requireEnv } from "./config";
import type { Digest, NewsletterConfig } from "./types";

const RESEND_URL = "https://api.resend.com/emails";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The email is deliberately a teaser, not the digest: headline, TL;DR, section
 * list, and a link through. Inline styles only, single column, no images —
 * so it renders consistently across Gmail, Outlook and Apple Mail.
 */
export function renderEmail(digest: Digest, config: NewsletterConfig): string {
  const url = `${config.siteUrl}/${digest.date}`;
  const dateLabel = displayDate(config.owner.timezone, digest.date);

  const tldr = digest.tldr
    .map(
      (item) =>
        `<tr><td style="padding:0 0 10px 0;font:400 16px/1.5 Georgia,'Times New Roman',serif;color:#141a21;">— ${escapeHtml(
          item,
        )}</td></tr>`,
    )
    .join("");

  const covered = digest.sections
    .filter((s) => s.body.trim().length > 0)
    .map((s) => escapeHtml(s.title))
    .join(" &middot; ");

  const quiet = digest.sections.filter((s) => s.body.trim().length === 0).length;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef1f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;padding:28px 24px;">
  <tr><td style="font:600 11px/1 ui-monospace,'SFMono-Regular',Menlo,monospace;letter-spacing:0.12em;text-transform:uppercase;color:#0b6b60;padding-bottom:14px;">
    ${escapeHtml(dateLabel)}
  </td></tr>
  <tr><td style="font:600 25px/1.25 Georgia,'Times New Roman',serif;color:#141a21;padding-bottom:20px;">
    ${escapeHtml(digest.headline)}
  </td></tr>
  <tr><td style="border-top:1px solid #dfe5ea;padding-top:18px;"></td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tldr}</table></td></tr>
  <tr><td style="padding:20px 0 6px 0;">
    <a href="${url}" style="display:inline-block;background:#0b6b60;color:#ffffff;text-decoration:none;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:14px 22px;border-radius:8px;">Read the full briefing</a>
  </td></tr>
  <tr><td style="padding-top:18px;font:400 12px/1.6 ui-monospace,'SFMono-Regular',Menlo,monospace;color:#5c6773;">
    ${covered || "No sections returned content"}${quiet ? ` &middot; ${quiet} quiet today` : ""}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function sendEmail(digest: Digest, config: NewsletterConfig): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const to = process.env.NEWSLETTER_TO || config.email.to;

  if (!to || to === "REPLACE_WITH_YOUR_EMAIL") {
    throw new Error("No recipient set — configure email.to or the NEWSLETTER_TO env var");
  }

  const label = digest.kind === "weekly" ? "Week in Review" : config.email.subjectPrefix;
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: config.email.from,
      to: [to],
      subject: `${label}: ${digest.headline}`,
      html: renderEmail(digest, config),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}
