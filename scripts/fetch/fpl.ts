const BOOTSTRAP = "https://fantasy.premierleague.com/api/bootstrap-static/";

interface FplElement {
  web_name: string;
  now_cost: number;
  cost_change_event: number;
  status: string;
  news: string;
  form: string;
  selected_by_percent: string;
  team: number;
}

interface FplEvent {
  id: number;
  name: string;
  deadline_time: string;
  is_next: boolean;
  finished: boolean;
}

interface FplTeam {
  id: number;
  name: string;
}

interface Bootstrap {
  elements: FplElement[];
  events: FplEvent[];
  teams: FplTeam[];
}

/**
 * Pulls the official FPL bootstrap feed and reduces it to the handful of facts
 * worth briefing on: next deadline, sharpest price moves, and fresh injury news.
 * Returns a compact text block for the synthesis prompt.
 */
export async function fetchFplSummary(): Promise<string> {
  const response = await fetch(BOOTSTRAP, {
    headers: { "User-Agent": "personal-daily-newsletter/1.0" },
  });
  if (!response.ok) throw new Error(`FPL API returned HTTP ${response.status}`);

  const data = (await response.json()) as Bootstrap;
  const teamName = new Map(data.teams.map((t) => [t.id, t.name]));

  const next = data.events.find((e) => e.is_next) ?? data.events.find((e) => !e.finished);

  const risers = [...data.elements]
    .filter((e) => e.cost_change_event > 0)
    .sort((a, b) => b.cost_change_event - a.cost_change_event)
    .slice(0, 5);

  const fallers = [...data.elements]
    .filter((e) => e.cost_change_event < 0)
    .sort((a, b) => a.cost_change_event - b.cost_change_event)
    .slice(0, 5);

  // status 'a' means available; anything else carries injury/suspension news.
  const flagged = data.elements
    .filter((e) => e.status !== "a" && e.news)
    .sort((a, b) => Number(b.selected_by_percent) - Number(a.selected_by_percent))
    .slice(0, 8);

  const inForm = [...data.elements]
    .sort((a, b) => Number(b.form) - Number(a.form))
    .slice(0, 5);

  const price = (p: FplElement) => `£${(p.now_cost / 10).toFixed(1)}m`;
  const named = (p: FplElement) => `${p.web_name} (${teamName.get(p.team) ?? "?"})`;

  const parts: string[] = [];

  if (next) {
    parts.push(
      `Next gameweek: ${next.name}, deadline ${new Date(next.deadline_time).toUTCString()}`,
    );
  }
  if (risers.length) {
    parts.push(
      `Price risers: ${risers.map((p) => `${named(p)} ${price(p)}`).join(", ")}`,
    );
  }
  if (fallers.length) {
    parts.push(
      `Price fallers: ${fallers.map((p) => `${named(p)} ${price(p)}`).join(", ")}`,
    );
  }
  if (flagged.length) {
    parts.push(
      `Flagged players (most-owned first):\n${flagged
        .map((p) => `- ${named(p)}, ${Number(p.selected_by_percent).toFixed(1)}% owned: ${p.news}`)
        .join("\n")}`,
    );
  }
  if (inForm.length) {
    parts.push(
      `In form: ${inForm.map((p) => `${named(p)} ${price(p)}, form ${p.form}`).join(", ")}`,
    );
  }

  return parts.join("\n\n");
}
