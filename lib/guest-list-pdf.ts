const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;
const ROW_H = 18;
const COLS = [
  { key: "name" as const, label: "Name", width: 150 },
  { key: "phone" as const, label: "Cellphone Number", width: 120 },
  { key: "email" as const, label: "Email", width: 220 },
  { key: "ticket" as const, label: "Ticket", width: 140 },
  { key: "door" as const, label: "Door", width: 110 },
];

export type GuestListPdfRow = {
  name: string;
  phone: string;
  email: string;
  ticket: string;
  door: string;
};

function latin(text: string) {
  return text
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/·/g, " - ")
    .replace(/[–—]/g, "-")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfString(text: string) {
  return `(${latin(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

function fit(text: string, width: number, fontSize: number) {
  const max = Math.max(1, Math.floor(width / (fontSize * 0.5)));
  const clean = latin(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 3))}...`;
}

function text(x: number, y: number, value: string, size: number, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ${pdfString(value)} Tj ET`;
}

function line(x1: number, y: number, x2: number) {
  return `${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`;
}

export function buildGuestListPdf({
  title,
  when,
  place,
  filter,
  rows,
}: {
  title: string;
  when: string;
  place: string;
  filter: string;
  rows: GuestListPdfRow[];
}) {
  const tableTop = PAGE_H - 108;
  const tableWidth = COLS.reduce((sum, col) => sum + col.width, 0);
  const lines: string[][] = [];
  let page: string[] = [];

  function startPage(pageNo: number) {
    page = [
      "0.16 0.18 0.21 RG",
      "0.16 0.18 0.21 rg",
      "1 w",
      text(MARGIN, PAGE_H - 42, "Who's On The List", 18, true),
      text(MARGIN, PAGE_H - 62, title, 12, true),
      text(MARGIN, PAGE_H - 78, [when, place].filter(Boolean).join(" · "), 10),
      text(MARGIN, PAGE_H - 94, `Filtered Tickets: ${filter}`, 9),
      text(PAGE_W - MARGIN - 80, PAGE_H - 42, `Page ${pageNo}`, 9),
    ];
    let x = MARGIN;
    for (const col of COLS) {
      page.push(text(x, tableTop, col.label, 9, true));
      x += col.width;
    }
    page.push(line(MARGIN, tableTop - 4, MARGIN + tableWidth));
  }

  function finishPage() {
    lines.push(page);
  }

  let pageNo = 1;
  startPage(pageNo);
  let y = tableTop - ROW_H;
  const body = rows.length
    ? rows
    : [{ name: "Nobody on this list yet.", phone: "", email: "", ticket: "", door: "" }];

  for (const row of body) {
    if (y < MARGIN + 24) {
      finishPage();
      pageNo += 1;
      startPage(pageNo);
      y = tableTop - ROW_H;
    }
    let x = MARGIN;
    for (const col of COLS) {
      page.push(text(x, y, fit(row[col.key] || "—", col.width - 8, 9), 9));
      x += col.width;
    }
    y -= ROW_H;
  }
  finishPage();

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjectIds: number[] = [];
  const fontHelv = 3;
  const fontBold = 4;
  objects.push(""); // pages placeholder at index 1
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (const content of lines) {
    const stream = content.join("\n");
    const contentId = objects.length + 1;
    const pageId = objects.length + 2;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontHelv} 0 R /F2 ${fontBold} 0 R >> >> >>`,
    );
    pageObjectIds.push(pageId);
  }

  objects[1] =
    `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(chunks.join("").length);
    chunks.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xrefAt = chunks.join("").length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((off) => `${String(off).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`,
    `startxref\n${xrefAt}\n%%EOF`,
  ];
  chunks.push(xref.join(""));
  return new TextEncoder().encode(chunks.join(""));
}

export function downloadGuestListPdf(filename: string, bytes: Uint8Array) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
