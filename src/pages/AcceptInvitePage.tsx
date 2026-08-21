import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { AuthCard } from "@/components/shared/AuthCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { ErrorScreen } from "@/components/shared/ErrorScreen";

// Landing point for the invite email's link. By the time this component
// mounts, the Supabase client has already parsed the access/refresh tokens
// out of the URL fragment (detectSessionInUrl: true) and established a
// session -- we just need to let the user set a real password, then flip
// their membership from INVITED to ACTIVE via accept_company_invite().
export default function AcceptInvitePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Give detectSessionInUrl a brief moment to finish parsing the fragment
  // before we decide there's genuinely no session.
  const [settleTimedOut, setSettleTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettleTimedOut(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      toast.error(updateError.message);
      return;
    }

    const { data, error: acceptError } = await supabase
      .rpc("accept_company_invite")
      .maybeSingle();

    if (acceptError) {
      setSubmitting(false);
      toast.error(acceptError.message);
      return;
    }

    let slug = (data as { company_id: string; company_slug: string } | null)?.company_slug;

    // No pending invite to accept -- this was a plain password reset for an
    // already-active member (or the accept happened previously). Fall back
    // to whichever company they're already active in, if any.
    if (!slug) {
      const { data: membership } = await supabase
        .from("company_users")
        .select("companies(slug)")
        .eq("user_id", user!.id)
        .eq("status", "ACTIVE")
        .limit(1)
        .maybeSingle();
      const companies = membership?.companies as { slug: string } | { slug: string }[] | null | undefined;
      slug = Array.isArray(companies) ? companies[0]?.slug : companies?.slug;
    }

    setSubmitting(false);
    toast.success("Password set. Welcome aboard!");
    navigate(slug ? `/c/${slug}` : "/company", { replace: true });
  };

  if (loading || (!user && !settleTimedOut)) return <LoadingScreen />;

  if (!user) {
    return (
      <ErrorScreen
        title="Invite link invalid or expired"
        description="Ask your company administrator to send a new invitation."
      />
    );
  }

  return (
    <AuthCard
      logo={
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      }
      title="Set your password"
      subtitle={user.email}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Saving…" : "Set password & continue"}
        </Button>
      </form>
    </AuthCard>
  );
}
