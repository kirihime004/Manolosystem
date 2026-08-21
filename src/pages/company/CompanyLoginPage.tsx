import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { AuthCard } from "@/components/shared/AuthCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { ErrorScreen } from "@/components/shared/ErrorScreen";

interface CompanyLookup {
  name: string;
  logo_url: string | null;
  login_background_url: string | null;
  status: string;
}

const inputDarkOverride =
  "dark:border-white/20 dark:bg-white/95 dark:text-slate-900 dark:placeholder:text-slate-500";

export default function CompanyLoginPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();

  const [lookup, setLookup] = useState<CompanyLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!companySlug) return;
    let isMounted = true;

    supabase
      .rpc("lookup_company_by_slug", { p_slug: companySlug })
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return;
        setLookup((data as CompanyLookup) ?? null);
        setLookupLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [companySlug]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companySlug) return;

    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setSubmitting(false);
      toast.error(signInError.message);
      return;
    }

    // Never trust the slug/company from the browser alone: re-derive the
    // company through RLS (has_company_access) and confirm this specific
    // user actually has an ACTIVE membership in it before letting them in.
    const { data: companyRow } = await supabase
      .from("companies")
      .select("id, status")
      .eq("slug", companySlug)
      .maybeSingle();

    if (!companyRow) {
      await supabase.auth.signOut();
      setSubmitting(false);
      toast.error("You do not have access to this company.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: membership } = await supabase
      .from("company_users")
      .select("status")
      .eq("company_id", companyRow.id)
      .eq("user_id", user?.id ?? "")
      .maybeSingle();

    if (!membership || membership.status !== "ACTIVE") {
      await supabase.auth.signOut();
      setSubmitting(false);
      toast.error("Your account for this company is not active.");
      return;
    }

    setSubmitting(false);
    navigate(`/c/${companySlug}`, { replace: true });
  };

  if (lookupLoading) return <LoadingScreen />;

  if (!lookup || lookup.status !== "ACTIVE") {
    return (
      <ErrorScreen
        title="Company not found"
        description="This company code is invalid or the account is not active."
      />
    );
  }

  return (
    <AuthCard
      backgroundImage={lookup.login_background_url ?? undefined}
      logo={
        <Avatar className="h-14 w-14 rounded-xl">
          <AvatarImage src={lookup.logo_url ?? undefined} />
          <AvatarFallback className="rounded-xl bg-primary text-lg text-primary-foreground">
            {lookup.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      }
      title={lookup.name}
      subtitle="Welcome back"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="dark:text-white">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputDarkOverride}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="dark:text-white">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputDarkOverride}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link
          to={`/c/${companySlug}/forgot-password`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <div className="mt-2 text-center">
        <Link to="/company" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Not your company?
        </Link>
      </div>
    </AuthCard>
  );
}
