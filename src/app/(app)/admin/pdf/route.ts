import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { GROUP_STATUS, formatDate, formatDateRange } from "@/lib/format";
import { getGroupsListing, readGroupFilters, regionLabel } from "@/lib/groups-listing";
import { pdfResponse, renderTablePdf, type PdfSection } from "@/lib/pdf";

export const runtime = "nodejs";

/** PDF of the regional groups, with the same filters and order as /admin. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Neautorizat", { status: 403 });

  const f = readGroupFilters((k) => request.nextUrl.searchParams.get(k));
  const { rows } = await getGroupsListing(f);
  const byDate = f.sort === "data";

  const sections: PdfSection[] = [];
  for (const g of rows) {
    const heading = byDate
      ? g.host
        ? formatDateRange(g.host.start_date, g.host.end_date)
        : "Fără dată stabilită"
      : (g.category_name ?? "");
    let section = sections[sections.length - 1];
    if (!section || section.heading !== heading) {
      section = { heading, rows: [] };
      sections.push(section);
    }
    section.rows.push([
      `${g.category_code ?? ""}\n${g.group_name ?? ""}`,
      regionLabel(g.region),
      g.host ? formatDateRange(g.host.start_date, g.host.end_date) : "—",
      g.host ? `${g.host.gym?.name ?? ""}\n${g.host.gym?.city ?? ""}` : "—",
      g.host?.team?.name ?? ((g.pending_count ?? 0) > 0 ? `${g.pending_count} propuneri în așteptare` : "—"),
      g.teams.map((t) => t.name).join("\n"),
      GROUP_STATUS[g.status ?? "no_proposal"].label +
        ((g.games_count ?? 0) > 0 ? `\n${g.games_done}/${g.games_count} rezultate` : ""),
    ]);
  }

  const subtitle = [
    f.categorie ? `Categoria ${f.categorie}` : "Toate categoriile",
    f.regiune && `Regiunea: ${f.regiune === "mixt" ? "mixte" : f.regiune}`,
    f.oras && `Oraș: ${f.oras}`,
    (f.de || f.pana) && `Perioada: ${f.de ? formatDate(f.de) : "…"} – ${f.pana ? formatDate(f.pana) : "…"}`,
    f.q && `Căutare: „${f.q}”`,
    f.status && `Stare: ${GROUP_STATUS[f.status]?.label ?? f.status}`,
    byDate ? "Ordonate după data turneului" : "Ordonate după categorie / grupă",
  ]
    .filter(Boolean)
    .join("  ·  ");

  const pdf = await renderTablePdf({
    title: "Grupe – Turneul 1",
    subtitle,
    countLabel: `${rows.length} ${rows.length === 1 ? "grupă" : "grupe"}`,
    columns: [
      { title: "Grupa", width: 95, bold: true },
      { title: "Regiune", width: 60 },
      { title: "Data", width: 120 },
      { title: "Sala", width: 105 },
      { title: "Organizator", width: 100 },
      { title: "Echipe", width: 165 },
      { title: "Stare", width: 124 },
    ],
    sections,
    empty: "Nicio grupă pentru filtrele alese.",
  });
  return pdfResponse(pdf, `grupe${f.categorie ? `-${f.categorie.toLowerCase()}` : ""}.pdf`);
}
