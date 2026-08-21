import { type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Ticket,
  Users,
  DollarSign,
  Building2,
  Clapperboard,
  LogOut,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/types/database";

const MODULE_NAV: { key: ModuleKey; label: string; icon: LucideIcon; path: string }[] = [
  { key: "IT", label: "IT", icon: Ticket, path: "it" },
  { key: "HR", label: "HR", icon: Users, path: "hr" },
  { key: "FINANCE", label: "Finance", icon: DollarSign, path: "finance" },
  { key: "ADMIN", label: "Administration", icon: Building2, path: "admin" },
  { key: "PRODUCTION", label: "Production", icon: Clapperboard, path: "production" },
];

export function CompanyShell({ children }: { children: ReactNode }) {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company, enabledModules } = useCompany();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const base = `/c/${companySlug}`;
  const initials =
    (user?.user_metadata?.first_name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="flex w-64 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <Avatar className="h-8 w-8 rounded-md">
            <AvatarImage src={company?.logo_url ?? undefined} />
            <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs">
              {company?.name?.slice(0, 2).toUpperCase() ?? "CO"}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-semibold text-foreground">
            {company?.name ?? "ManoloSystem"}
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavLink to={base} icon={LayoutDashboard} label="Dashboard" active={location.pathname === base} />
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Modules
          </p>
          {MODULE_NAV.filter((m) => enabledModules.has(m.key)).map((m) => (
            <NavLink
              key={m.key}
              to={`${base}/${m.path}`}
              icon={m.icon}
              label={m.label}
              active={location.pathname.startsWith(`${base}/${m.path}`)}
            />
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user?.user_metadata?.first_name ?? user?.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => navigate("/company")}>
                Switch company
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate(`${base}/login`);
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
