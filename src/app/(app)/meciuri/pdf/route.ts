import type { NextRequest } from "next/server";
import { getCurrentUser, isNominator } from "@/lib/auth";
import {
  COMPETITION_LABEL,
  POSITION_LABEL,
  REFEREE_POSITIONS,
  formatDate,
  formatTime,
  isoToBucharest,
  type OfficialPosition,
} from "@/lib/format";
import { capitalize, pdfResponse, renderTablePdf, slug, type PdfSection } from "@/lib/pdf";
import { listGames, sideName, type ListedGame } from "@/lib/queries";

export const runtime = "nodejs";

/** PDF of the games list, with the same filters as /meciuri. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (!user.isOfficial && !isNominator(user))) return new Response("Neautorizat", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const tip = sp.get("tip") ?? "";
  const oras = sp.get("oras") ?? "";
  const de = sp.get("de") ?? "";
  const pana = sp.get("pana") ?? "";
  const cand = sp.get("cand") ?? "upcoming";

  const games = await listGames({
    competition: tip === "regional" || tip === "national" || tip === "friendly" ? tip : undefined,
    when: cand === "past" ? "past" : "upcoming",
    city: oras || undefined,
    from: de || undefined,
    to: pana || undefined,
    limit: 1000,
  });

  const subtitle = [
    tip ? COMPETITION_LABEL[tip as keyof typeof COMPETITION_LABEL]?.long : "Toate meciurile",
    oras && `Oraș: ${oras}`,
    de || pana
      ? `Perioada: ${de ? formatDate(de) : "…"} – ${pana ? formatDate(pana) : "…"}`
      : cand === "past"
        ? "Meciuri trecute"
        : "Meciuri următoare",
  ]
    .filter(Boolean)
    .join("  ·  ");

  const sections: PdfSection[] = [];
  for (const g of games) {
    const heading = capitalize(formatDate(isoToBucharest(g.starts_at).date));
    let section = sections[sections.length - 1];
    if (!section || section.heading !== heading) {
      section = { heading, rows: [] };
      sections.push(section);
    }
    section.rows.push([
      formatTime(g.starts_at),
      `${COMPETITION_LABEL[g.competition].short}\n${g.category?.name ?? ""}${g.label ? `\n${g.label}` : ""}`,
      `${sideName(g, "home", g.home)} – ${sideName(g, "away", g.away)}${
        g.status === "played" ? `\nScor: ${g.home_score} – ${g.away_score}` : ""
      }`,
      g.gym ? `${g.gym.name}\n${g.gym.city}${g.gym.address ? `, ${g.gym.address}` : ""}` : "—",
      officialsText(g),
    ]);
  }

  const pdf = await renderTablePdf({
    title: "Program meciuri",
    subtitle,
    countLabel: `${games.length} meciuri`,
    note: "(?) = nominalizare neconfirmată",
    columns: [
      { title: "Ora", width: 42 },
      { title: "Tip / categorie", width: 95 },
      { title: "Meci", width: 210, bold: true },
      { title: "Sala", width: 160 },
      { title: "Arbitri și oficiali", width: 255 },
    ],
    sections,
    empty: "Niciun meci pentru filtrele alese.",
  });
  return pdfResponse(pdf, `program-meciuri${oras ? `-${slug(oras)}` : ""}${de ? `-${de}` : ""}.pdf`);
}

function officialsText(g: ListedGame) {
  const shown = g.nominations.filter((n) => n.status !== "rejected");
  if (!shown.length) return "—";
  const order = (p: string) => ((REFEREE_POSITIONS as readonly string[]).includes(p) ? 0 : 1) + p;
  return shown
    .sort((a, b) => order(a.position).localeCompare(order(b.position)))
    .map((n) => `${POSITION_LABEL[n.position as OfficialPosition]}: ${n.name}${n.status === "pending" ? " (?)" : ""}`)
    .join("\n");
}
