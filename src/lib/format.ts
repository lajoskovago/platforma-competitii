export const TZ = "Europe/Bucharest";

/** Organiser conditions (placeholder text; keep in sync with public.app_conditions_text()). */
export const CONDITIONS_TEXT =
  "Am luat la cunoștință îndatoririle mele ca organizator: să pun gratuit la dispoziție pentru celelalte echipe sala de joc și asistența medicală.";

const dateFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("ro-RO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** "2026-11-22" (a calendar date, no time) -> "dum., 22 noiembrie 2026" */
export function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  // noon UTC keeps the same calendar day in Bucharest
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatDateRange(start: string, end?: string | null) {
  return end && end !== start ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);
}

export function formatTime(ts: string) {
  return timeFmt.format(new Date(ts));
}

export function formatDateTime(ts: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** Offset (minutes) of Bucharest relative to UTC at a given instant. */
function tzOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Bucharest wall-clock date + time ("2026-11-22", "10:30") -> ISO timestamp (UTC). */
export function bucharestToISO(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = tzOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60000).toISOString();
}

/** ISO timestamp -> { date: "YYYY-MM-DD", time: "HH:MM" } in Bucharest. */
export function isoToBucharest(ts: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** End of an auto-confirm period (exclusive, e.g. Monday 00:00) shown as the last included day. */
export function formatUntilDay(ts: string) {
  return new Intl.DateTimeFormat("ro-RO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(
    new Date(new Date(ts).getTime() - 60_000),
  );
}

export function sevenDaysAgo() {
  return Date.now() - 7 * 24 * 3600_000;
}

/** Games that started less than 3 hours ago still count as "upcoming". */
export function upcomingCutoff() {
  return Date.now() - 3 * 3600_000;
}

export const GROUP_STATUS: Record<string, { label: string; tone: Tone }> = {
  no_proposal: { label: "Fără organizator", tone: "gray" },
  waiting: { label: "Așteaptă răspunsuri", tone: "amber" },
  conflict: { label: "Mai multe propuneri – decide admin", tone: "red" },
  confirmed: { label: "Organizator confirmat", tone: "blue" },
  scheduled: { label: "Program publicat", tone: "green" },
  finished: { label: "Rezultate complete", tone: "green" },
};

export const PROPOSAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "În așteptare", tone: "amber" },
  confirmed: { label: "Confirmat", tone: "green" },
  withdrawn: { label: "Retras", tone: "gray" },
  not_selected: { label: "Neselectat", tone: "gray" },
};

export type Tone = "gray" | "amber" | "red" | "blue" | "green";

export type Competition = "regional" | "national" | "friendly";
export const COMPETITION_LABEL: Record<Competition, { short: string; long: string; tone: Tone; path: string }> = {
  regional: { short: "Regional", long: "Campionat regional", tone: "gray", path: "/" },
  national: { short: "Național", long: "Campionatul Național", tone: "blue", path: "/national" },
  friendly: { short: "Amical", long: "Meci amical", tone: "green", path: "/amicale" },
};

export const REFEREE_POSITIONS = ["referee_1", "referee_2", "referee_3"] as const;
export const TABLE_POSITIONS = [
  "scorer",
  "assistant_scorer",
  "timekeeper",
  "shot_clock",
  "statistician_1",
  "statistician_2",
  "statistician_3",
] as const;
export type OfficialPosition = (typeof REFEREE_POSITIONS)[number] | (typeof TABLE_POSITIONS)[number];

export const POSITION_LABEL: Record<OfficialPosition, string> = {
  referee_1: "Arbitru 1 (crew chief)",
  referee_2: "Arbitru 2 (umpire 1)",
  referee_3: "Arbitru 3 (umpire 2)",
  scorer: "Scorer",
  assistant_scorer: "Asistent scorer",
  timekeeper: "Cronometror",
  shot_clock: "Operator 24\"",
  statistician_1: "Statistician 1",
  statistician_2: "Statistician 2",
  statistician_3: "Statistician 3",
};

/** What a table official can do (self-declared, editable by admins). */
export const TABLE_SKILLS = ["dss", "scorer", "timekeeper", "shot_clock", "statistics"] as const;
export type TableSkill = (typeof TABLE_SKILLS)[number];
export const TABLE_SKILL_LABEL: Record<TableSkill, string> = {
  dss: "DSS",
  scorer: "Scorer",
  timekeeper: "Cronometror",
  shot_clock: 'Operator 24"',
  statistics: "Statistică",
};
/** Skill needed for a table position (referee positions: none). */
export const POSITION_SKILL: Partial<Record<OfficialPosition, TableSkill>> = {
  scorer: "scorer",
  assistant_scorer: "scorer",
  timekeeper: "timekeeper",
  shot_clock: "shot_clock",
  statistician_1: "statistics",
  statistician_2: "statistics",
  statistician_3: "statistics",
};
/** Skill the position needs on this game (Scorer on a DSS game needs the DSS skill). */
export function skillForPosition(position: OfficialPosition, scoresheet: string | null | undefined): TableSkill | undefined {
  if (position === "scorer" && scoresheet === "dss") return "dss";
  return POSITION_SKILL[position];
}
export const SCORESHEET_LABEL: Record<string, string> = { manual: "Manuală (pe hârtie)", dss: "Digitală (DSS)" };

export function readSkills(fd: FormData): TableSkill[] {
  return TABLE_SKILLS.filter((k) => fd.get(`skill_${k}`) === "on");
}

export const NOMINATION_STATUS: Record<string, { label: string; tone: Tone; icon: string }> = {
  pending: { label: "Așteaptă confirmare", tone: "amber", icon: "⏳" },
  accepted: { label: "Confirmat", tone: "green", icon: "✅" },
  rejected: { label: "Refuzat", tone: "red", icon: "❌" },
};

export function mapsLink(gym: { name: string; city: string; address?: string | null; maps_url?: string | null }) {
  if (gym.maps_url) return gym.maps_url;
  const q = [gym.name, gym.address, gym.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
