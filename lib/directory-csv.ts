/** Shared columns for the directory template, export, and import. */
export const DIRECTORY_CSV_COLUMNS = [
  "name",
  "business_name",
  "branch_name",
  "short_description",
  "description",
  "phone",
  "email",
  "website_url",
  "booking_url",
  "street_address_1",
  "street_address_2",
  "suburb",
  "city",
  "province",
  "postal_code",
  "interest",
] as const;

export const DIRECTORY_EXPORT_COLUMNS = ["id", "status", ...DIRECTORY_CSV_COLUMNS] as const;

export const DIRECTORY_IMPORT_LIMIT = 400;

export type DirectoryCsvColumn = (typeof DIRECTORY_CSV_COLUMNS)[number];
export type DirectoryCsvRow = Record<DirectoryCsvColumn, string>;

export type DirectoryPreviewOutcome = "new" | "existing" | "duplicate" | "nameless";

export type DirectoryPreviewLine = {
  line: number;
  name: string;
  place: string;
  outcome: DirectoryPreviewOutcome;
  detail: string;
};

const COLUMN_SET = new Set<string>(DIRECTORY_CSV_COLUMNS);

export function directoryCsvTemplate() {
  return `\uFEFF${DIRECTORY_CSV_COLUMNS.join(",")}\r\n`;
}

export function directoryCsvDocument(rows: Record<string, string>[]) {
  const lines = [
    DIRECTORY_EXPORT_COLUMNS.join(","),
    ...rows.map((row) => DIRECTORY_EXPORT_COLUMNS.map((column) => csvCell(row[column] ?? "")).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function foldDirectoryText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Same name, suburb, and city. Case and extra spaces do not count. */
export function directoryMatchKey(name: string, suburb: string, city: string) {
  return `${foldDirectoryText(name)}\u0000${foldDirectoryText(suburb)}\u0000${foldDirectoryText(city)}`;
}

export function parseDirectoryCsv(text: string): { rows: { line: number; row: DirectoryCsvRow }[] } | { error: string } {
  const table = parseCsvTable(text.replace(/^\uFEFF/, ""));
  if (table.length === 0) return { error: "The file is empty." };

  const header = table[0].cells.map((cell) => foldDirectoryText(cell).replace(/ /g, "_"));
  if (!header.includes("name")) {
    return { error: "The file needs a name column. Download the template and use those headings." };
  }

  const rows: { line: number; row: DirectoryCsvRow }[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const source = table[index];
    const row = emptyDirectoryRow();
    header.forEach((column, columnIndex) => {
      if (!COLUMN_SET.has(column)) return;
      row[column as DirectoryCsvColumn] = (source.cells[columnIndex] ?? "").trim();
    });
    if (DIRECTORY_CSV_COLUMNS.every((column) => row[column] === "")) continue;
    rows.push({ line: source.line, row });
  }

  if (rows.length === 0) return { error: "The file has no activity businesses." };
  if (rows.length > DIRECTORY_IMPORT_LIMIT) {
    return {
      error: `This file has ${rows.length} rows. Import up to ${DIRECTORY_IMPORT_LIMIT} at a time.`,
    };
  }
  return { rows };
}

export function classifyDirectoryRows(
  rows: { line: number; row: DirectoryCsvRow; note?: string }[],
  taken: Map<string, string>,
) {
  const seen = new Set<string>();
  const lines: DirectoryPreviewLine[] = [];
  const fresh: DirectoryCsvRow[] = [];

  for (const entry of rows) {
    const name = entry.row.name.trim();
    const place = [entry.row.suburb, entry.row.city].map((part) => part.trim()).filter(Boolean).join(", ");
    if (!name) {
      lines.push({
        line: entry.line,
        name: "—",
        place: place || "—",
        outcome: "nameless",
        detail: "Needs a name",
      });
      continue;
    }

    const key = directoryMatchKey(name, entry.row.suburb, entry.row.city);
    const existing = taken.get(key);
    if (existing) {
      lines.push({
        line: entry.line,
        name,
        place: place || "—",
        outcome: "existing",
        detail: existing,
      });
      continue;
    }
    if (seen.has(key)) {
      lines.push({
        line: entry.line,
        name,
        place: place || "—",
        outcome: "duplicate",
        detail: "Repeated in this file",
      });
      continue;
    }

    seen.add(key);
    fresh.push(entry.row);
    lines.push({
      line: entry.line,
      name,
      place: place || "—",
      outcome: "new",
      detail: entry.note?.trim() || "New",
    });
  }

  return { lines, fresh };
}

export function emptyDirectoryRow(): DirectoryCsvRow {
  return {
    name: "",
    business_name: "",
    branch_name: "",
    short_description: "",
    description: "",
    phone: "",
    email: "",
    website_url: "",
    booking_url: "",
    street_address_1: "",
    street_address_2: "",
    suburb: "",
    city: "",
    province: "",
    postal_code: "",
    interest: "",
  };
}

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseCsvTable(text: string) {
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;

  const pushRow = () => {
    cells.push(cell);
    cell = "";
    if (cells.some((value) => value.trim() !== "")) rows.push({ line: rowStart, cells });
    cells = [];
    rowStart = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else if (char === "\n") {
      pushRow();
      line += 1;
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || cells.length > 0) pushRow();
  return rows;
}
