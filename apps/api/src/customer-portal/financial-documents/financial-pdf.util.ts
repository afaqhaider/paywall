import PDFDocument from "pdfkit";
import { formatMinorUnits } from "../../common/utils/money.util";

export interface DocumentLineItem {
  description: string;
  quantity: number;
  unitAmountMinor: number;
  amountMinor: number;
}

export interface CompanyInfo {
  name: string;
  reference: string;
}

export interface CustomerInfo {
  name: string;
  email?: string | null;
}

export interface InvoicePdfData {
  documentNumber: string;
  company: CompanyInfo;
  customer: CustomerInfo;
  issuedAt: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  lineItems: DocumentLineItem[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  paymentStatus: string;
  paymentReference?: string | null;
  /** Set when this is a read-only cached render of a LedGix ERP document - never used for an INTERNAL-mode invoice. */
  erpDocumentNumber?: string | null;
}

export interface ReceiptPdfData {
  documentNumber: string;
  company: CompanyInfo;
  customer: CustomerInfo;
  issuedAt: Date;
  description: string;
  amountMinor: number;
  currency: string;
  paymentStatus: string;
  paymentReference?: string | null;
  erpDocumentNumber?: string | null;
}

const LEGAL_FOOTER =
  "This is a system-generated document and does not require a signature. " +
  "For billing questions, contact the organization listed above. " +
  "Retain this document for your records.";

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  documentNumber: string,
  company: CompanyInfo,
): void {
  doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "right" });
  doc.fontSize(10).font("Helvetica").text(`# ${documentNumber}`, { align: "right" });
  doc.moveDown(1.5);

  doc.fontSize(14).font("Helvetica-Bold").text(company.name);
  doc.fontSize(9).font("Helvetica").fillColor("#555555").text(`Ref: ${company.reference}`);
  doc.fillColor("#000000");
  doc.moveDown(1);
}

function drawCustomerAndDates(
  doc: PDFKit.PDFDocument,
  customer: CustomerInfo,
  issuedAt: Date,
  periodStart?: Date | null,
  periodEnd?: Date | null,
): void {
  const startY = doc.y;

  doc.fontSize(10).font("Helvetica-Bold").text("Billed to", 50, startY);
  doc.font("Helvetica").text(customer.name, 50, startY + 14);
  if (customer.email) {
    doc.text(customer.email, 50, startY + 28);
  }

  doc.font("Helvetica-Bold").text("Issued", 350, startY);
  doc.font("Helvetica").text(issuedAt.toISOString().slice(0, 10), 350, startY + 14);

  if (periodStart && periodEnd) {
    doc.font("Helvetica-Bold").text("Billing period", 350, startY + 32);
    doc
      .font("Helvetica")
      .text(
        `${periodStart.toISOString().slice(0, 10)} - ${periodEnd.toISOString().slice(0, 10)}`,
        350,
        startY + 46,
      );
  }

  doc.moveDown(4);
}

function drawTotalsBlock(
  doc: PDFKit.PDFDocument,
  subtotalMinor: number,
  discountMinor: number,
  taxMinor: number,
  totalMinor: number,
  currency: string,
): void {
  const labelX = 380;
  const valueX = 480;
  const rowHeight = 16;
  let y = doc.y + 8;

  const row = (label: string, amountMinor: number, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(label, labelX, y);
    doc.text(formatMinorUnits(amountMinor, currency), valueX, y, { width: 80, align: "right" });
    y += rowHeight;
  };

  row("Subtotal", subtotalMinor);
  if (discountMinor > 0) row("Discount", -discountMinor);
  if (taxMinor > 0) row("Tax", taxMinor);
  doc.moveTo(labelX, y).lineTo(560, y).strokeColor("#cccccc").stroke();
  y += 6;
  row("Total", totalMinor, true);

  doc.y = y + 10;
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  paymentStatus: string,
  paymentReference?: string | null,
): void {
  doc.moveDown(2);
  doc.fontSize(10).font("Helvetica-Bold").text(`Payment status: ${paymentStatus}`);
  if (paymentReference) {
    doc.font("Helvetica").text(`Payment reference: ${paymentReference}`);
  }
  doc.moveDown(2);
  doc.fontSize(8).fillColor("#777777").text(LEGAL_FOOTER, { width: 500 });
  doc.fillColor("#000000");
}

/** Generates a production-format invoice PDF. Used for INTERNAL-mode
 * invoices and, when no ERP-provided PDF exists, as the read-only cached
 * render of a LEDGIX_ERP invoice (`erpDocumentNumber` set in that case -
 * never used to create a second accounting invoice, only to display one). */
export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  drawHeader(doc, "INVOICE", data.documentNumber, data.company);
  if (data.erpDocumentNumber) {
    doc
      .fontSize(9)
      .fillColor("#555555")
      .text(
        `LedGix ERP document: ${data.erpDocumentNumber} (cached copy - not a duplicate invoice)`,
      );
    doc.fillColor("#000000").moveDown(0.5);
  }

  drawCustomerAndDates(doc, data.customer, data.issuedAt, data.periodStart, data.periodEnd);

  // Line items table.
  const tableTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Description", 50, tableTop);
  doc.text("Qty", 320, tableTop, { width: 40, align: "right" });
  doc.text("Unit price", 370, tableTop, { width: 80, align: "right" });
  doc.text("Amount", 470, tableTop, { width: 90, align: "right" });
  doc
    .moveTo(50, tableTop + 14)
    .lineTo(560, tableTop + 14)
    .strokeColor("#cccccc")
    .stroke();

  let y = tableTop + 20;
  doc.font("Helvetica").fontSize(10);
  for (const item of data.lineItems) {
    doc.text(item.description, 50, y, { width: 260 });
    doc.text(String(item.quantity), 320, y, { width: 40, align: "right" });
    doc.text(formatMinorUnits(item.unitAmountMinor, data.currency), 370, y, {
      width: 80,
      align: "right",
    });
    doc.text(formatMinorUnits(item.amountMinor, data.currency), 470, y, {
      width: 90,
      align: "right",
    });
    y += 18;
  }
  doc.y = y;

  drawTotalsBlock(
    doc,
    data.subtotalMinor,
    data.discountMinor,
    data.taxMinor,
    data.totalMinor,
    data.currency,
  );
  drawFooter(doc, data.paymentStatus, data.paymentReference);

  return toBuffer(doc);
}

/** Generates a production-format receipt PDF - the same rules as invoices
 * regarding INTERNAL vs cached-LedGix-copy rendering apply. */
export function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  drawHeader(doc, "RECEIPT", data.documentNumber, data.company);
  if (data.erpDocumentNumber) {
    doc
      .fontSize(9)
      .fillColor("#555555")
      .text(
        `LedGix ERP document: ${data.erpDocumentNumber} (cached copy - not a duplicate receipt)`,
      );
    doc.fillColor("#000000").moveDown(0.5);
  }

  drawCustomerAndDates(doc, data.customer, data.issuedAt, null, null);

  doc.font("Helvetica-Bold").fontSize(11).text("Payment received for:");
  doc.font("Helvetica").fontSize(10).text(data.description);
  doc.moveDown(1);

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(`Amount paid: ${formatMinorUnits(data.amountMinor, data.currency)}`);

  drawFooter(doc, data.paymentStatus, data.paymentReference);

  return toBuffer(doc);
}
