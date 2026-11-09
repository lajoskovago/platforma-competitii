import { NOMINATION_STATUS, POSITION_LABEL, REFEREE_POSITIONS, type OfficialPosition } from "@/lib/format";
import type { NominationWithName } from "@/lib/queries";

/** One line under a game in lists: referees' names (+ count of table officials). */
export function OfficialsSummary({ nominations }: { nominations: NominationWithName[] }) {
  const active = nominations.filter((n) => n.status !== "rejected");
  if (!active.length) return null;
  const refs = active
    .filter((n) => (REFEREE_POSITIONS as readonly string[]).includes(n.position))
    .sort((a, b) => a.position.localeCompare(b.position));
  const table = active.length - refs.length;
  return (
    <div className="mt-1 text-xs text-slate-500">
      🧑‍⚖️ {refs.map((r) => r.name + (r.status === "pending" ? " (?)" : "")).join(", ") || "—"}
      {table > 0 && ` · ${table} oficial${table === 1 ? "" : "i"} de masă`}
    </div>
  );
}

export function NominationLine({ n }: { n: NominationWithName }) {
  const st = NOMINATION_STATUS[n.status];
  return (
    <div className="text-sm">
      <span className="text-slate-500">{POSITION_LABEL[n.position as OfficialPosition]}:</span>{" "}
      <span className="font-medium">{n.name}</span> <span title={st.label}>{st.icon}</span>
      {n.status === "rejected" && n.reason && <div className="pl-4 text-xs text-red-700">Motiv refuz: {n.reason}</div>}
    </div>
  );
}
