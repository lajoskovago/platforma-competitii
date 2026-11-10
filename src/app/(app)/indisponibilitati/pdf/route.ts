import type { NextRequest } from "next/server";
import { getCurrentUser, isNominator } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { capitalize, pdfResponse, renderTablePdf, slug, type PdfSection } from "@/lib/pdf";
import { getUnavailabilityList } from "@/lib/unavailability";

export const runtime = "nodejs";

/** PDF of the unavailability list, with the same filters as /indisponibilitati. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isNominator(user)) return new Response("Neautorizat", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const filters = {
    cand: sp.get("cand") === "past" ? "past" : "upcoming",
    regiune: user.isMaster ? (sp.get("regiune") ?? "") : "",
    q: sp.get("q") ?? "",
    oras: sp.get("oras") ?? "",
    de: sp.get("de") ?? "",
    pana: sp.get("pana") ?? "",
  };
  const { list } = await getUnavailabilityList(filters);

  const subtitle = [
    user.isMaster ? (filters.regiune ? `Regiunea ${filters.regiune}` : "Toate regiunile") : `Regiunea ${user.region}`,
    filters.oras && `Oraș: ${filters.oras}`,
    filters.q && `Nume: „${filters.q}”`,
    filters.de || filters.pana
      ? `Perioada: ${filters.de ? formatDate(filters.de) : "…"} – ${filters.pana ? formatDate(filters.pana) : "…"}`
      : filters.cand === "past"
        ? "Perioade trecute"
        : "Perioade actuale și viitoare",
  ]
    .filter(Boolean)
    .join("  ·  ");

  // one section per first day of the period
  const sections: PdfSection[] = [];
  for (const r of list) {
    const heading = capitalize(formatDate(r.start_date));
    let section = sections[sections.length - 1];
    if (!section || section.heading !== heading) {
      section = { heading, rows: [] };
      sections.push(section);
    }
    const p = r.person;
    section.rows.push([
      p?.full_name || "—",
      [p?.is_referee && "Arbitru", p?.is_table_official && "Oficial de masă"].filter(Boolean).join(", ") || "—",
      [p?.city, p?.region].filter(Boolean).join(" · ") || "—",
      r.end_date !== r.start_date ? `${formatDate(r.start_date)} – ${formatDate(r.end_date)}` : formatDate(r.start_date),
      r.start_time || r.end_time ? `${r.start_time?.slice(0, 5) ?? "00:00"}–${r.end_time?.slice(0, 5) ?? "24:00"}` : "Toată ziua",
      r.note ?? "",
    ]);
  }

  const pdf = await renderTablePdf({
    title: "Indisponibilități arbitri și oficiali",
    subtitle,
    countLabel: `${list.length} perioade`,
    columns: [
      { title: "Nume", width: 150, bold: true },
      { title: "Rol", width: 105 },
      { title: "Oraș / regiune", width: 110 },
      { title: "Perioada", width: 190 },
      { title: "Ore", width: 70 },
      { title: "Observații", width: 137 },
    ],
    sections,
    empty: "Nicio indisponibilitate pentru filtrele alese.",
  });
  return pdfResponse(pdf, `indisponibilitati${filters.oras ? `-${slug(filters.oras)}` : ""}.pdf`);
}
