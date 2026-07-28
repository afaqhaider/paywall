/**
 * Small dependency-free CSV serializer. No external CSV library is added
 * for this - the format is simple enough (header row + escaped rows) that
 * pulling in a package would be pure overhead for what this module needs.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const escapeCell = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const str =
      value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(","));
  }
  return lines.join("\n");
}
