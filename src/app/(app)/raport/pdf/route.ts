import type { NextRequest } from "next/server";
import { BUCKETS, getActivityReport } from "@/lib/activity-report";
import { getCurrentUser, isNominator } from "@/lib/auth";
import { lei } from "@/lib/decont";
import { formatDate } from "@/lib/format";
import { pdfResponse, renderTablePdf, slug } from "@/lib/pdf";

export const runtime = "nodejs";

/** PDF of the officials' activity report, same filters as /raport. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isNominator(user)) return new Response("Neautorizat", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const filters = {
    de: sp.get("de") ?? "",
    pana: sp.get("pana") ?? "",
    oras: sp.get("oras") ?? "",
    regiune: sp.get("regiune") ?? "",
    q: sp.get("q") ?? "",
  };
  const { rows, from, to } = await getActivityReport(user, filters);
  const totalRow = [
    "TOTAL",
    ...BUCKETS.map((b) => String(rows.reduce((s, r) => s + r.counts[b.key], 0))),
    String(rows.reduce((s, r) => s + r.total, 0)),
    lei(Math.round(rows.reduce((s, r) => s + r.earned, 0) * 100) / 100),
  ];

  const pdf = await renderTablePdf({
    title: "Raport arbitri și oficiali",
    subtitle: [
      `Perioada: ${formatDate(from)} – ${formatDate(to)}`,
      filters.oras && `Oraș: ${filters.oras}`,
      user.isMaster ? filters.regiune && `Regiunea ${filters.regiune}` : `Regiunea ${user.region}`,
    ]
      .filter(Boolean)
      .join("  ·  "),
    countLabel: `${rows.length} persoane`,
    note: "meciuri jucate, nominalizări confirmate",
    columns: [
      { title: "Nume", width: 170, bold: true },
      ...BUCKETS.map((b) => ({ title: b.label, width: 70 })),
      { title: "Total", width: 50, bold: true },
      { title: "Sume", width: 130 },
    ],
    sections: [
      {
        rows: [
          ...rows.map((r) => [
            `${r.name}${r.city ? `\n${r.city}` : ""}`,
            ...BUCKETS.map((b) => String(r.counts[b.key] || "–")),
            String(r.total),
            `${lei(r.earned)}${r.selfInvoiced > 0 ? `\ndin care facturat: ${lei(r.selfInvoiced)}` : ""}`,
          ]),
          totalRow,
        ],
      },
    ],
    empty: "Nicio persoană pentru filtrele alese.",
  });
  return pdfResponse(pdf, `raport-oficiali${filters.oras ? `-${slug(filters.oras)}` : ""}-${from}-${to}.pdf`);
}
