import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import { displayDate, loadConfig } from "@/scripts/lib/config";
import { listDigestDates, readDigest } from "@/scripts/lib/store";

export const dynamic = "force-static";

interface Entry {
  href: string;
  date: string;
  label: string;
  headline: string;
  weekly: boolean;
}

export default function Archive() {
  const config = loadConfig();

  const entries: Entry[] = [
    ...listDigestDates("daily").map((date) => ({ date, weekly: false })),
    ...listDigestDates("weekly").map((date) => ({ date, weekly: true })),
  ]
    .map(({ date, weekly }) => {
      const digest = readDigest(date, weekly ? "weekly" : "daily");
      if (!digest) return null;
      return {
        href: weekly ? `/${date}-weekly` : `/${date}`,
        date,
        weekly,
        label: displayDate(config.owner.timezone, date)
          .split(" ")
          .slice(1, 3)
          .join(" "),
        headline: digest.headline,
      };
    })
    .filter((entry): entry is Entry => entry !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-date">Archive</div>
        <div className="masthead-links">
          <Link className="masthead-link" href="/">
            Latest
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <h1 className="headline">Past briefings</h1>

      {entries.length === 0 ? (
        <div className="empty-state">Nothing archived yet.</div>
      ) : (
        <ul className="archive-list">
          {entries.map((entry) => (
            <li key={entry.href}>
              <Link href={entry.href}>
                <span className="archive-date">
                  {entry.label}
                  {entry.weekly ? " · wk" : ""}
                </span>
                <span className="archive-headline">{entry.headline}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
