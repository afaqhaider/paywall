import PDFDocument from "pdfkit";

/**
 * Reuses the same `pdfkit` library and buffer-collection pattern already
 * established in `customer-portal/financial-documents/financial-pdf.util.ts`
 * for invoice/receipt PDFs - no new PDF dependency is added here.
 */
function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

const PAGE_LEFT = 50;
const PAGE_RIGHT = 550;
const PAGE_BOTTOM = 760;

/** Renders a simple tabular report PDF: title, generated-at timestamp, and a plain table of rows. */
export function generateReportPdf(title: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.fontSize(18).font("Helvetica-Bold").text(title);
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#555555")
    .text(`Generated at ${new Date().toISOString()}`);
  doc.fillColor("#000000").moveDown(1);

  if (rows.length === 0) {
    doc.fontSize(11).text("No data available for this report.");
    return toBuffer(doc);
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const colWidth = Math.max(60, Math.floor((PAGE_RIGHT - PAGE_LEFT) / headers.length));

  let y = doc.y;
  const drawHeaderRow = () => {
    doc.font("Helvetica-Bold").fontSize(8);
    headers.forEach((header, i) => {
      doc.text(header, PAGE_LEFT + i * colWidth, y, { width: colWidth, ellipsis: true });
    });
    y += 14;
    doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor("#cccccc").stroke();
    y += 4;
  };

  drawHeaderRow();
  doc.font("Helvetica").fontSize(8);

  for (const row of rows) {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = 50;
      drawHeaderRow();
      doc.font("Helvetica").fontSize(8);
    }
    headers.forEach((header, i) => {
      doc.text(cellText(row[header]), PAGE_LEFT + i * colWidth, y, {
        width: colWidth,
        ellipsis: true,
      });
    });
    y += 14;
  }
  doc.y = y;

  return toBuffer(doc);
}
