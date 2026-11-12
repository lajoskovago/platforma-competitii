import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import { APP_NAME } from "@/lib/brand";
import { formatDate, isoToBucharest } from "@/lib/format";

// DejaVu Sans covers all Romanian diacritics (ș ț ă î â)
const FONT = path.join(process.cwd(), "node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

export type PdfColumn = { title: string; width: number; bold?: boolean };
export type PdfSection = { heading?: string; rows: string[][] };

/**
 * A4 landscape table: title, subtitle, optional section headings (e.g. one per day),
 * header row repeated on every page, page numbers.
 */
export function renderTablePdf(opts: {
  title: string;
  subtitle: string;
  countLabel: string;
  note?: string;
  columns: PdfColumn[];
  sections: PdfSection[];
  empty: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, font: FONT, bufferPages: true });
    doc.registerFont("regular", FONT);
    doc.registerFont("bold", FONT_BOLD);
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const tableWidth = opts.columns.reduce((s, c) => s + c.width, 0);

    doc.font("bold").fontSize(16).fillColor("#0f172a").text(opts.title, left, doc.y);
    doc.font("regular").fontSize(9).fillColor("#475569").text(opts.subtitle);
    doc.text(
      [opts.countLabel, `generat ${formatDate(isoToBucharest(new Date().toISOString()).date)}`, APP_NAME, opts.note]
        .filter(Boolean)
        .join(" · "),
    );
    doc.moveDown(0.6);

    const headerRow = () => {
      const y = doc.y;
      doc.font("bold").fontSize(8);
      // titles may wrap onto two lines: size the header row to the tallest one
      const h = Math.max(...opts.columns.map((c) => doc.heightOfString(c.title, { width: c.width - 8 }))) + 8;
      doc.rect(left, y, tableWidth, h).fill("#f1f5f9");
      let x = left;
      doc.font("bold").fontSize(8).fillColor("#334155");
      for (const c of opts.columns) {
        doc.text(c.title, x + 4, y + 4, { width: c.width - 8 });
        x += c.width;
      }
      doc.y = y + h + 2;
    };
    const ensureSpace = (h: number) => {
      if (doc.y + h > bottom()) {
        doc.addPage();
        headerRow();
      }
    };

    const total = opts.sections.reduce((n, s) => n + s.rows.length, 0);
    if (!total) {
      doc.font("regular").fontSize(10).fillColor("#334155").text(opts.empty);
    } else {
      headerRow();
      for (const section of opts.sections) {
        if (section.heading) {
          ensureSpace(36);
          doc.font("bold").fontSize(10).fillColor("#c2410c").text(section.heading, left, doc.y + 4);
          doc.moveDown(0.2);
        }
        for (const cells of section.rows) {
          doc.font("regular").fontSize(8.5);
          const h =
            Math.max(...cells.map((t, i) => doc.heightOfString(t || " ", { width: opts.columns[i].width - 8 }))) + 8;
          ensureSpace(h);
          const y = doc.y;
          let x = left;
          cells.forEach((t, i) => {
            doc
              .font(opts.columns[i].bold ? "bold" : "regular")
              .fontSize(8.5)
              .fillColor("#0f172a")
              .text(t, x + 4, y + 4, { width: opts.columns[i].width - 8 });
            x += opts.columns[i].width;
          });
          doc.moveTo(left, y + h).lineTo(left + tableWidth, y + h).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
          doc.y = y + h + 1;
        }
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // writing inside the bottom margin would otherwise make pdfkit start a new page
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("regular")
        .fontSize(7)
        .fillColor("#94a3b8")
        .text(`Pagina ${i + 1} din ${range.count}`, left, doc.page.height - 24, {
          width: tableWidth,
          align: "right",
          lineBreak: false,
        });
      doc.page.margins.bottom = savedBottom;
    }
    doc.end();
  });
}

export function pdfResponse(pdf: Buffer, fileName: string) {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
