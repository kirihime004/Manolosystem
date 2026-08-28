// All spreadsheet (read + write) handling for bulk user import lives here.
// Uses exceljs rather than the more commonly-seen `xlsx` (SheetJS) package
// because the npm-registry build of `xlsx` carries an unpatched high
// severity CVE (SheetJS only ships fixes via their own CDN, not npm) --
// exceljs does the same job with no such tradeoff.
import { Workbook, type Worksheet } from "exceljs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ImportLookups {
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  employmentTypes: { id: string; label: string }[];
  employmentStatuses: { id: string; label: string }[];
  roles: { id: string; name: string }[];
  /** Lower-cased emails already belonging to this company -- for dup detection. */
  existingEmails: Set<string>;
}

export interface ParsedRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string | null;
  positionId: string | null;
  employmentTypeId: string | null;
  employmentStatusId: string | null;
  roleIds: string[];
  hireDate: string | null;
  phone: string | null;
  status: "ready" | "warning" | "error";
  messages: string[];
}

const HEADERS = [
  "First Name*", "Last Name*", "Email*", "Department", "Position",
  "Employment Type", "Employment Status", "Roles (comma-separated)", "Hire Date (YYYY-MM-DD)", "Phone",
];

const EXAMPLE_ROW = [
  "Jane", "Dela Cruz", "jane.delacruz@example.com", "Animation", "Junior Animator",
  "Full-Time", "Active", "Animator", "2026-09-01", "09171234567",
];

async function downloadWorkbook(wb: Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function buildImportTemplate(lookups: ImportLookups, companyName: string): Promise<void> {
  const wb = new Workbook();

  const data = wb.addWorksheet("Users to import");
  data.columns = HEADERS.map((header) => ({ header, key: header, width: Math.max(16, header.length) }));
  data.addRow(EXAMPLE_ROW);
  data.getRow(1).font = { bold: true };
  data.getRow(2).font = { italic: true, color: { argb: "FF888888" } };

  const ref = wb.addWorksheet("Valid values (reference)");
  ref.columns = [
    { header: "Department", key: "d", width: 22 },
    { header: "Position", key: "p", width: 22 },
    { header: "Employment Type", key: "t", width: 20 },
    { header: "Employment Status", key: "s", width: 20 },
    { header: "Role", key: "r", width: 22 },
  ];
  ref.getRow(1).font = { bold: true };
  const maxLen = Math.max(
    lookups.departments.length, lookups.positions.length,
    lookups.employmentTypes.length, lookups.employmentStatuses.length, lookups.roles.length,
  );
  for (let i = 0; i < maxLen; i++) {
    ref.addRow([
      lookups.departments[i]?.name ?? "",
      lookups.positions[i]?.title ?? "",
      lookups.employmentTypes[i]?.label ?? "",
      lookups.employmentStatuses[i]?.label ?? "",
      lookups.roles[i]?.name ?? "",
    ]);
  }

  await downloadWorkbook(wb, `${companyName.replace(/[^a-z0-9]+/gi, "-")}-user-import-template.xlsx`);
}

function cellText(row: import("exceljs").Row, col: number): string {
  const raw = row.getCell(col).value as unknown;
  if (raw == null) return "";
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "object" && "text" in (raw as Record<string, unknown>)) {
    return String((raw as { text: unknown }).text ?? "").trim();
  }
  if (typeof raw === "object" && "result" in (raw as Record<string, unknown>)) {
    return String((raw as { result: unknown }).result ?? "").trim();
  }
  return String(raw).trim();
}

function matchByName<T extends { id: string }>(
  list: T[], nameOf: (item: T) => string, value: string,
): T | undefined {
  const needle = value.trim().toLowerCase();
  return list.find((item) => nameOf(item).trim().toLowerCase() === needle);
}

function parseHireDate(value: string): { date: string | null; warning?: string } {
  if (!value) return { date: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value };
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return { date: parsed.toISOString().slice(0, 10) };
  return { date: null, warning: `Hire date "${value}" not understood -- left blank` };
}

export async function parseImportFile(file: File, lookups: ImportLookups): Promise<ParsedRow[]> {
  const wb = new Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer as unknown as import("exceljs").Buffer);

  const sheet: Worksheet | undefined = wb.worksheets.find((s) => s.rowCount > 1) ?? wb.worksheets[0];
  if (!sheet) return [];

  // Resolve columns by header text (case-insensitive, ignoring a trailing
  // "*" or parenthetical hint) so a reordered/renamed-with-hint template
  // still parses correctly.
  const headerRow = sheet.getRow(1);
  const colOf = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const norm = String(cell.value ?? "").replace(/\*/g, "").replace(/\(.*\)/g, "").trim().toLowerCase();
    if (norm) colOf.set(norm, colNumber);
  });
  const col = (name: string) => colOf.get(name) ?? -1;

  const cFirst = col("first name"), cLast = col("last name"), cEmail = col("email");
  const cDept = col("department"), cPos = col("position"), cType = col("employment type");
  const cStatus = col("employment status"), cRoles = col("roles"), cHire = col("hire date"), cPhone = col("phone");

  const seenEmails = new Set<string>();
  const rows: ParsedRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const firstName = cFirst > 0 ? cellText(row, cFirst) : "";
    const lastName = cLast > 0 ? cellText(row, cLast) : "";
    const email = (cEmail > 0 ? cellText(row, cEmail) : "").toLowerCase();
    if (!firstName && !lastName && !email) return; // fully blank row -- skip silently

    const messages: string[] = [];
    let status: ParsedRow["status"] = "ready";
    const escalate = (level: ParsedRow["status"]) => {
      if (level === "error" || status === "ready") status = level;
    };

    if (!firstName || !lastName) {
      messages.push("Missing first or last name");
      escalate("error");
    }
    if (!email) {
      messages.push("Missing email");
      escalate("error");
    } else if (!EMAIL_RE.test(email)) {
      messages.push(`"${email}" is not a valid email address`);
      escalate("error");
    } else if (lookups.existingEmails.has(email)) {
      messages.push(`${email} already has an account in this company`);
      escalate("error");
    } else if (seenEmails.has(email)) {
      messages.push(`${email} is duplicated in this file`);
      escalate("error");
    } else {
      seenEmails.add(email);
    }

    const deptText = cDept > 0 ? cellText(row, cDept) : "";
    const dept = deptText ? matchByName(lookups.departments, (d) => d.name, deptText) : undefined;
    if (deptText && !dept) { messages.push(`Department "${deptText}" not found -- left blank`); escalate("warning"); }

    const posText = cPos > 0 ? cellText(row, cPos) : "";
    const pos = posText ? matchByName(lookups.positions, (p) => p.title, posText) : undefined;
    if (posText && !pos) { messages.push(`Position "${posText}" not found -- left blank`); escalate("warning"); }

    const typeText = cType > 0 ? cellText(row, cType) : "";
    const empType = typeText ? matchByName(lookups.employmentTypes, (t) => t.label, typeText) : undefined;
    if (typeText && !empType) { messages.push(`Employment type "${typeText}" not found -- left blank`); escalate("warning"); }

    const statusText = cStatus > 0 ? cellText(row, cStatus) : "";
    const empStatus = statusText ? matchByName(lookups.employmentStatuses, (s) => s.label, statusText) : undefined;
    if (statusText && !empStatus) { messages.push(`Employment status "${statusText}" not found -- left blank`); escalate("warning"); }

    const rolesText = cRoles > 0 ? cellText(row, cRoles) : "";
    const roleNames = rolesText.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const roleIds: string[] = [];
    for (const name of roleNames) {
      const role = matchByName(lookups.roles, (r) => r.name, name);
      if (role) roleIds.push(role.id);
      else { messages.push(`Role "${name}" not found -- skipped`); escalate("warning"); }
    }

    const hireText = cHire > 0 ? cellText(row, cHire) : "";
    const { date: hireDate, warning: hireWarning } = parseHireDate(hireText);
    if (hireWarning) { messages.push(hireWarning); escalate("warning"); }

    const phone = cPhone > 0 ? cellText(row, cPhone) : "";

    rows.push({
      rowNumber, firstName, lastName, email,
      departmentId: dept?.id ?? null, positionId: pos?.id ?? null,
      employmentTypeId: empType?.id ?? null, employmentStatusId: empStatus?.id ?? null,
      roleIds, hireDate, phone: phone || null,
      status, messages,
    });
  });

  return rows;
}

export async function buildCredentialsWorkbook(
  rows: { email: string; password: string; firstName: string; lastName: string }[],
  companyName: string,
): Promise<void> {
  const wb = new Workbook();
  const sheet = wb.addWorksheet("Credentials");
  sheet.columns = [
    { header: "First Name", key: "firstName", width: 18 },
    { header: "Last Name", key: "lastName", width: 18 },
    { header: "Email", key: "email", width: 30 },
    { header: "Temporary Password", key: "password", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) sheet.addRow(r);

  await downloadWorkbook(wb, `${companyName.replace(/[^a-z0-9]+/gi, "-")}-import-credentials.xlsx`);
}
