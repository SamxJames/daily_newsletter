import Link from "next/link";
import DigestView from "./components/Digest";
import ThemeToggle from "./components/ThemeToggle";
import { displayDate, loadConfig } from "@/scripts/lib/config";
import { listDigestDates, readDigest } from "@/scripts/lib/store";

export const dynamic = "force-static";

export default function Home() {
  const config = loadConfig();
  const [latest] = listDigestDates("daily");
  const digest = latest ? readDigest(latest) : null;

  if (!digest) {
    return (
      <main className="shell">
        <header className="masthead">
          <div className="masthead-date">Daily Brief</div>
          <div className="masthead-links">
            <Link className="masthead-link" href="/archive">
              Archive
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <h1 className="headline">No briefing yet</h1>
        <div className="empty-state">
          The first digest will appear here once the daily workflow has run.
        </div>
      </main>
    );
  }

  return (
    <DigestView digest={digest} dateLabel={displayDate(config.owner.timezone, digest.date)} />
  );
}
