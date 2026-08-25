import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import {
  useMyClientProfile, useMyClientProjects, useMyClientProjectShots, useMyClientShotVersions, useMyClientDeliverables,
} from "@/features/production/hooks";
import { decideReview } from "@/features/production/productionVersionsApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";

// This page is reached only via /client/:companySlug and shows exactly
// what production_client_users + the client-scoped RLS policies from
// migration 142 let this account see -- there is no company_id/staff
// permission model here at all, unlike every other page in the app.
export default function ClientPortalPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { data: clientProfile, isLoading: profileLoading } = useMyClientProfile();
  const { data: projects, isLoading: projectsLoading } = useMyClientProjects();

  const [projectId, setProjectId] = useState<string>("");
  const activeProjectId = projectId || projects?.[0]?.id;
  const { data: shots } = useMyClientProjectShots(activeProjectId);
  const { data: deliverables } = useMyClientDeliverables(activeProjectId);

  const [expandedShotId, setExpandedShotId] = useState<string | null>(null);
  const { data: versions } = useMyClientShotVersions(expandedShotId ?? undefined);

  if (authLoading || profileLoading) return <LoadingScreen />;
  if (!user) return <Navigate to={`/client/${companySlug}/login`} replace />;
  if (!clientProfile || !clientProfile.is_active) return <Navigate to={`/client/${companySlug}/login`} replace />;

  const handleDecide = async (reviewId: string, decision: "APPROVED" | "CHANGES_REQUESTED") => {
    try {
      await decideReview(reviewId, decision);
      toast.success(decision === "APPROVED" ? "Approved" : "Changes requested");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit decision");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Client Portal</h1>
          <p className="text-sm text-muted-foreground">Welcome, {clientProfile.name}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
          <LogOut className="mr-1.5 h-4 w-4" /> Sign out
        </Button>
      </div>

      {projectsLoading ? (
        <Skeleton className="h-10 w-56" />
      ) : !projects || projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects have been shared with you yet.</p>
      ) : (
        <>
          <Select value={activeProjectId ?? ""} onValueChange={(v) => { setProjectId(v); setExpandedShotId(null); }}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select a project…" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>

          <Tabs defaultValue="shots">
            <TabsList>
              <TabsTrigger value="shots">Shots</TabsTrigger>
              <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            </TabsList>

            <TabsContent value="shots" className="space-y-2 pt-4">
              {(shots ?? []).map((s) => (
                <Card key={s.id}>
                  <CardContent className="pt-4 space-y-2">
                    <button className="flex w-full items-center justify-between text-left" onClick={() => setExpandedShotId(expandedShotId === s.id ? null : s.id)}>
                      <span className="text-sm font-medium text-foreground">{s.shot_code} {s.description ?? ""}</span>
                      <ProductionStatusBadge status={s.status} />
                    </button>
                    {expandedShotId === s.id && (
                      <div className="space-y-2 border-t border-border pt-3">
                        {(versions ?? []).map((v) => (
                          <div key={v.id} className="flex items-center justify-between text-sm">
                            <span>v{v.version_number} {v.name ?? ""}</span>
                            <div className="flex items-center gap-2">
                              <ProductionStatusBadge status={v.status} />
                              {v.status === "PENDING_REVIEW" && (
                                <ClientReviewActions versionId={v.id} onDecide={handleDecide} />
                              )}
                            </div>
                          </div>
                        ))}
                        {(!versions || versions.length === 0) && <p className="text-xs text-muted-foreground">No versions shared for this shot yet.</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {(!shots || shots.length === 0) && <p className="text-sm text-muted-foreground">No shots have been shared for this project yet.</p>}
            </TabsContent>

            <TabsContent value="deliverables" className="space-y-2 pt-4">
              {(deliverables ?? []).map((d) => (
                <Card key={d.id}>
                  <CardContent className="flex items-center justify-between pt-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.due_date ? `Due ${d.due_date}` : ""}</p>
                    </div>
                    <ProductionStatusBadge status={d.status} />
                  </CardContent>
                </Card>
              ))}
              {(!deliverables || deliverables.length === 0) && <p className="text-sm text-muted-foreground">No deliverables yet.</p>}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function ClientReviewActions({ versionId, onDecide }: { versionId: string; onDecide: (reviewId: string, decision: "APPROVED" | "CHANGES_REQUESTED") => void }) {
  // The client's own review row is found via a filtered supabase query
  // (client-scoped RLS already limits this to their own PENDING row), not
  // shown as a full ledger the way staff see it -- the client only ever
  // has one decision to make per version.
  const [reviewId, setReviewId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from("production_reviews")
      .select("id")
      .eq("version_id", versionId)
      .eq("decision", "PENDING")
      .maybeSingle()
      .then(({ data }) => { if (isMounted) setReviewId(data?.id ?? null); });
    return () => { isMounted = false; };
  }, [versionId]);

  if (!reviewId) return null;

  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="outline" onClick={() => onDecide(reviewId, "APPROVED")}>Approve</Button>
      <Button size="sm" variant="ghost" onClick={() => onDecide(reviewId, "CHANGES_REQUESTED")}>Request changes</Button>
    </div>
  );
}
