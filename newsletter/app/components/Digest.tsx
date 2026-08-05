import { marked } from "marked";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import type { Digest, DigestSection, Quote } from "@/scripts/lib/types";

marked.setOptions({ gfm: true, breaks: false });

function slug(id: string) {
  return `section-${id}`;
}

/** Renders markdown, forcing external links to open safely in a new tab. */
function Body({ markdown }: { markdown: string }) {
  const html = (marked.parse(markdown) as string).replace(
    /<a href="http/g,
    '<a target="_blank" rel="noopener noreferrer" href="http',
  );
  return <div className="section-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

function StatusRail({ sections }: { sections: DigestSection[] }) {
  return (
    <ul className="rail" aria-label="Section status">
      {sections.map((section) => {
        const status = section.body.trim() ? "ok" : section.status === "failed" ? "failed" : "empty";
        return (
          <li key={section.id} className="rail-item">
            <a className="rail-link" href={`#${slug(section.id)}`} data-status={status}>
              <span className="rail-tick" data-status={status} aria-hidden="true" />
              {section.title}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Quotes({ title, quotes }: { title: string; quotes: Quote[] }) {
  const usable = quotes.filter((q) => q.price != null);
  if (usable.length === 0) return null;

  return (
    <table className="quotes">
      <caption>{title}</caption>
      <tbody>
        {usable.map((quote) => {
          const change = quote.changePercent;
          const tone = change == null ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
          return (
            <tr key={quote.symbol}>
              <td className="label">{quote.label}</td>
              <td className={tone}>
                {change == null
                  ? "—"
                  : `${change > 0 ? "+" : ""}${change.toFixed(2)}%`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Sources({ sources }: { sources: DigestSection["sources"] }) {
  if (sources.length === 0) return null;
  return (
    <div className="sources">
      <div className="sources-label">Sources</div>
      <ul className="sources-list">
        {sources.slice(0, 10).map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.outlet ?? source.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunLog({ digest }: { digest: Digest }) {
  return (
    <details className="footer">
      <summary>Run log</summary>
      {digest.log.map((entry) => (
        <div className="log-line" key={`${entry.sectionId}-${entry.status}`}>
          <span className="rail-tick" data-status={entry.status} aria-hidden="true" />
          <span>{entry.sectionId}</span>
          <span>{entry.status}</span>
          <span>{(entry.durationMs / 1000).toFixed(1)}s</span>
          {entry.detail ? <span className="log-detail">{entry.detail}</span> : null}
        </div>
      ))}
      <div className="log-line">Generated {new Date(digest.generatedAt).toUTCString()}</div>
    </details>
  );
}

export default function DigestView({
  digest,
  dateLabel,
}: {
  digest: Digest;
  dateLabel: string;
}) {
  const marketSections = new Set(["investing"]);

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-date">
          {digest.kind === "weekly" ? "Week in review · " : ""}
          {dateLabel}
        </div>
        <div className="masthead-links">
          <Link className="masthead-link" href="/archive">
            Archive
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <h1 className="headline">{digest.headline}</h1>

      <StatusRail sections={digest.sections} />

      {digest.tldr.length > 0 ? (
        <section className="tldr" aria-label="Summary">
          <div className="tldr-label">The short version</div>
          <ul className="tldr-list">
            {digest.tldr.map((item, index) => (
              <li key={item}>
                <span className="tldr-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {digest.sections.map((section) => (
        <section className="section" id={slug(section.id)} key={section.id}>
          <h2 className="section-title">{section.title}</h2>

          {marketSections.has(section.id) && digest.markets ? (
            <>
              <Quotes title="Holdings" quotes={digest.markets.holdings} />
              <Quotes title="Watchlist" quotes={digest.markets.watchlist} />
            </>
          ) : null}

          {section.body.trim() ? (
            <>
              <Body markdown={section.body} />
              <Sources sources={section.sources} />
            </>
          ) : (
            <div className="section-quiet" data-status={section.status}>
              <span className="rail-tick" data-status={section.status} aria-hidden="true" />
              {section.status === "failed"
                ? "This section failed to build today — see the run log."
                : "Nothing significant today."}
            </div>
          )}
        </section>
      ))}

      <RunLog digest={digest} />
    </main>
  );
}
