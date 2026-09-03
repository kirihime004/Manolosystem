// Shared CSV-export helper -- extracted from the pattern AssetListPage.tsx
// had inline (blob + object URL + a hidden <a download>), so Reports pages
// don't each re-implement the same few lines.
export function exportCsv<T>(filename: string, columns: { label: string; render: (row: T) => string }[], rows: T[]) {
  const header = columns.map((c) => c.label).join(",");
  const lines = rows.map((r) => columns.map((c) => `"${c.render(r).replace(/"/g, '""')}"`).join(","));
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
