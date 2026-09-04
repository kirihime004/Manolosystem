import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Upload, ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useDepartments } from "@/features/company/settings/useDepartments";
import { useRoles } from "@/features/company/settings/useRoles";
import { useCompanyUsersList, useBulkImportUsers, type BulkImportRow, type BulkImportRowResult } from "@/features/company/settings/useCompanyUsers";
import { usePositions, useEmploymentTypes, useEmploymentStatuses } from "@/features/hr/hooks";
import { buildImportTemplate, parseImportFile, buildCredentialsWorkbook, type ParsedRow, type ImportLookups } from "@/features/company/settings/bulkImportExcel";
import { generatePassword } from "@/lib/generatePassword";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Step = "upload" | "preview" | "results";

const STATUS_META: Record<ParsedRow["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ready: { label: "Ready", variant: "default" },
  warning: { label: "Warning", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

export default function BulkImportUsersPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: departments, isLoading: loadingDepts } = useDepartments(company?.id);
  const { data: positions, isLoading: loadingPositions } = usePositions(company?.id);
  const { data: employmentTypes, isLoading: loadingTypes } = useEmploymentTypes(company?.id);
  const { data: employmentStatuses, isLoading: loadingStatuses } = useEmploymentStatuses(company?.id);
  const { data: roles, isLoading: loadingRoles } = useRoles(company?.id);
  const { data: companyUsers, isLoading: loadingUsers } = useCompanyUsersList(company?.id);
  const bulkImport = useBulkImportUsers(company?.id);

  const lookupsLoading = loadingDepts || loadingPositions || loadingTypes || loadingStatuses || loadingRoles || loadingUsers;

  const lookups: ImportLookups | null = useMemo(() => {
    if (lookupsLoading) return null;
    return {
      departments: departments ?? [],
      positions: positions ?? [],
      employmentTypes: employmentTypes ?? [],
      employmentStatuses: employmentStatuses ?? [],
      roles: roles ?? [],
      existingEmails: new Set((companyUsers ?? []).map((u) => u.email?.toLowerCase()).filter((e): e is string => !!e)),
    };
  }, [lookupsLoading, departments, positions, employmentTypes, employmentStatuses, roles, companyUsers]);

  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<{ row: ParsedRow; password: string; result: BulkImportRowResult }[]>([]);

  const handleDownloadTemplate = async () => {
    if (!lookups || !company) return;
    try {
      await buildImportTemplate(lookups, company.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to build template");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lookups) return;
    setParsing(true);
    try {
      const rows = await parseImportFile(file, lookups);
      if (rows.length === 0) {
        toast.error("No rows found in that file");
        return;
      }
      setParsedRows(rows);
      setExcluded(new Set(rows.filter((r) => r.status === "error").map((r) => r.rowNumber)));
      setStep("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read that file");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleRow = (rowNumber: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const includedRows = parsedRows.filter((r) => !excluded.has(r.rowNumber));

  const handleImport = async () => {
    if (includedRows.length === 0 || !company) return;
    const withPasswords = includedRows.map((row) => ({ row, password: generatePassword() }));
    const payload: BulkImportRow[] = withPasswords.map(({ row, password }) => ({
      email: row.email, password, firstName: row.firstName, lastName: row.lastName,
      departmentId: row.departmentId, positionId: row.positionId,
      employmentTypeId: row.employmentTypeId, employmentStatusId: row.employmentStatusId,
      roleIds: row.roleIds, hireDate: row.hireDate, phone: row.phone,
      tin: row.tin, sssNumber: row.sssNumber, philhealthNumber: row.philhealthNumber, pagibigNumber: row.pagibigNumber,
    }));
    try {
      const rowResults = await bulkImport.mutateAsync(payload);
      setResults(withPasswords.map(({ row, password }, i) => ({ row, password, result: rowResults[i] })));
      setStep("results");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  };

  const handleDownloadCredentials = async () => {
    if (!company) return;
    const successful = results.filter((r) => r.result.success);
    await buildCredentialsWorkbook(
      successful.map((r) => ({ email: r.row.email, password: r.password, firstName: r.row.firstName, lastName: r.row.lastName })),
      company.name,
    );
  };

  const successCount = results.filter((r) => r.result.success).length;
  const failCount = results.length - successCount;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={`/c/${companySlug}/settings/users`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import users from Excel</h1>
          <p className="text-sm text-muted-foreground">
            Creates a login account and an HR employee record for every row -- no more adding people one at a time.
          </p>
        </div>
      </div>

      {step === "upload" && (
        <Card>
          <CardContent className="space-y-5 pt-6">
            {lookupsLoading ? (
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <FileSpreadsheet className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="space-y-2 text-sm">
                    <p className="text-foreground">
                      Download the template, fill in one row per person (First Name, Last Name, and Email are required),
                      then upload it back here. A second sheet in the template lists your company's real department,
                      position, employment type/status, and role names to copy from.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                      <Download className="h-3.5 w-3.5" />Download template
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="bulk-import-file" className="text-sm font-medium text-foreground">Upload filled-in spreadsheet</label>
                  <input
                    id="bulk-import-file"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    disabled={parsing}
                    onChange={handleFileChange}
                    className="block w-full cursor-pointer rounded-md border border-border bg-background text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
                  />
                  {parsing && <p className="text-xs text-muted-foreground">Reading file…</p>}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} found — {includedRows.length} selected to import.
              Rows with an error are excluded by default; uncheck any row to skip it.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setStep("upload")}>
              <Upload className="h-3.5 w-3.5" />Upload a different file
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((row) => {
                  const meta = STATUS_META[row.status];
                  const dept = lookups?.departments.find((d) => d.id === row.departmentId)?.name;
                  return (
                    <TableRow key={row.rowNumber}>
                      <TableCell>
                        <Checkbox
                          checked={!excluded.has(row.rowNumber)}
                          onCheckedChange={() => toggleRow(row.rowNumber)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.firstName} {row.lastName}</TableCell>
                      <TableCell className="text-muted-foreground">{row.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{dept ?? "—"}</TableCell>
                      <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {row.messages.length > 0 ? row.messages.join("; ") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={handleImport} disabled={includedRows.length === 0 || bulkImport.isPending}>
              {bulkImport.isPending ? "Importing…" : `Import ${includedRows.length} user${includedRows.length === 1 ? "" : "s"}`}
            </Button>
            <Button type="button" variant="outline" onClick={() => setStep("upload")}>Cancel</Button>
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <span className="flex items-center gap-1.5 text-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{successCount} created</span>
            {failCount > 0 && (
              <span className="flex items-center gap-1.5 text-foreground"><XCircle className="h-4 w-4 text-destructive" />{failCount} failed</span>
            )}
          </div>

          {successCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">New accounts</h2>
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadCredentials}>
                  <Download className="h-3.5 w-3.5" />Download credentials
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                These passwords won't be shown again — download the file above and share credentials with each person yourself.
              </p>
              <div className="rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Temporary password</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {results.filter((r) => r.result.success).map((r) => (
                      <TableRow key={r.row.rowNumber}>
                        <TableCell className="font-medium">{r.row.firstName} {r.row.lastName}</TableCell>
                        <TableCell className="text-muted-foreground">{r.row.email}</TableCell>
                        <TableCell className="font-mono text-xs">{r.password}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {failCount > 0 && (
            <div className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4" />Failed rows</h2>
              <div className="rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {results.filter((r) => !r.result.success).map((r) => (
                      <TableRow key={r.row.rowNumber}>
                        <TableCell className="font-medium">{r.row.firstName} {r.row.lastName}</TableCell>
                        <TableCell className="text-muted-foreground">{r.row.email}</TableCell>
                        <TableCell className="text-destructive">{r.result.error ?? "Unknown error"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <Button type="button" onClick={() => navigate(`/c/${companySlug}/settings/users`)}>Done</Button>
        </div>
      )}
    </div>
  );
}
