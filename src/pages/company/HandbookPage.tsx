import {
  BookOpen,
  LogIn,
  LayoutDashboard,
  Ticket as TicketIcon,
  Headset,
  Users,
  Building2,
  ShieldCheck,
  Palette,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/shared/TicketBadges";
import type { TicketPriority, TicketStatus } from "@/types/database";

const STATUSES: TicketStatus[] = [
  "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_VENDOR", "RESOLVED", "CLOSED", "CANCELLED",
];
const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-primary/20 bg-primary/5 px-3.5 py-3 text-sm text-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
    </li>
  );
}

function SectionHeader({ icon: Icon, kicker, title }: { icon: LucideIcon; kicker: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{kicker}</p>
        <CardTitle className="text-base leading-tight">{title}</CardTitle>
      </div>
    </div>
  );
}

export default function HandbookPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="h-5 w-5" />
          <p className="text-xs font-semibold uppercase tracking-wider">Company Handbook</p>
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Mindburst Handbook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How to use your company workspace and the IT Ticketing module — signing in, filing and tracking
          tickets, and the administration tools available to Company Admins.
        </p>
      </div>

      <Callout>
        What a person actually sees depends on their role. Every screen and button described below is gated by
        a permission — if something isn't in someone's sidebar, their role doesn't include it. Adjust roles from{" "}
        <span className="font-medium text-foreground">Settings → Roles</span>.
      </Callout>

      {/* Getting started */}
      <Card>
        <CardHeader>
          <SectionHeader icon={LogIn} kicker="Start here" title="Getting started" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Step n={1} title="Open Mindburst and enter the company code.">
              Every company has a short code (e.g. <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">TC</code>).
              Entering it goes to that company's own sign-in page.
            </Step>
            <Step n={2} title="Enter email and password, then Sign In.">
              Some companies customize this page with their own background and logo — the form itself works the
              same everywhere.
            </Step>
            <Step n={3} title="Forgot password?">
              Use the "Forgot password?" link under the sign-in form to reset it by email.
            </Step>
          </div>
          <p className="text-sm text-muted-foreground">
            Anyone invited by email should follow the link in their invitation first to set their own password —
            after that, they sign in normally with the company code.
          </p>
          <Separator />
          <div>
            <p className="text-sm font-medium text-foreground">Account settings</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the menu at the bottom of the sidebar (the person's name), then choose{" "}
              <span className="font-medium text-foreground">Account settings</span> to update your name, change
              your profile picture, or change your password.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard */}
      <Card>
        <CardHeader>
          <SectionHeader icon={LayoutDashboard} kicker="Start here" title="Your dashboard" />
          <CardDescription>The dashboard adapts to what each person actually does in the company.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border p-3.5">
            <p className="text-sm font-medium text-foreground">Company Admins</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A Team panel shows Total users, Active, Invited, and Disabled counts, with a shortcut to manage
              users.
            </p>
          </div>
          <div className="rounded-md border border-border p-3.5">
            <p className="text-sm font-medium text-foreground">Full ticket visibility (IT staff)</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A Ticketing panel shows company-wide Open, Critical, In Progress, and Resolved counts, with a
              shortcut into the full Ticketing dashboard.
            </p>
          </div>
          <div className="rounded-md border border-border p-3.5">
            <p className="text-sm font-medium text-foreground">Everyone else with Ticketing enabled</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Open, Resolved, and Closed counts for tickets they personally submitted, plus recent activity —
              comments and status changes — on those tickets.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ticketing - everyone */}
      <Card>
        <CardHeader>
          <SectionHeader icon={TicketIcon} kicker="IT Ticketing" title="Submitting & tracking tickets" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Step n={1} title="Go to Ticketing → New ticket.">
              Available from the sidebar, the Ticketing dashboard, or the Tickets list.
            </Step>
            <Step n={2} title="Fill in the details.">
              Subject, category and subcategory, priority, a description, and any file attachments.
            </Step>
            <Step n={3} title="Create ticket.">
              The new ticket gets its own ticket number (e.g. <span className="font-mono">TC-000142</span>) for
              reference.
            </Step>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Tracking a ticket</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open any ticket to see its subject, status, priority, description, and attachments. Two tabs sit
              below: <span className="font-medium text-foreground">Comments</span> (the conversation with IT) and{" "}
              <span className="font-medium text-foreground">Activity</span> (a timeline of status changes).
            </p>
          </div>

          <div>
            <p className="mb-2.5 text-sm font-medium text-foreground">Statuses &amp; priorities</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-md border border-border p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => <TicketStatusBadge key={s} status={s} />)}
                </div>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((p) => <TicketPriorityBadge key={p} priority={p} />)}
                </div>
              </div>
            </div>
          </div>

          <Callout>
            Filing tickets needs the <span className="font-medium">Create</span> permission; commenting needs{" "}
            <span className="font-medium">Comment</span>. Most employee roles include both by default.
          </Callout>
        </CardContent>
      </Card>

      {/* Ticketing - staff */}
      <Card>
        <CardHeader>
          <SectionHeader icon={Headset} kicker="IT Ticketing" title="Working the queue (IT staff)" />
          <CardDescription>
            If a role can view every ticket in the company, Ticketing becomes a full support queue instead of a
            personal list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            <Item title="The Ticketing dashboard">
              Eight live counters — Open, Assigned to me, In Progress, Waiting for User, Critical, Overdue,
              Resolved Today, Closed Today — plus status/priority distribution and three quick lists. A search
              box jumps straight to a ticket by subject or number.
            </Item>
            <Item title="The full ticket list">
              Ticketing → Tickets is the searchable, filterable table of everything — built for well past a
              hundred open tickets. Filter by status, priority, category, or assignee; results page at 15 per
              screen.
            </Item>
            <Item title="Working a single ticket">
              The Actions panel on a ticket lets staff assign it to a technician, change its priority, and move
              it through the status lifecycle — with one-click "Mark Resolved" / "Close Ticket" buttons.
            </Item>
            <Item title="Managing categories">
              A "Manage categories" button on the Ticketing dashboard (permission-gated) keeps the category and
              subcategory list — the ones people pick from when filing a ticket — organized.
            </Item>
          </ul>
          <Callout>
            Each control here is its own permission — View, Assign, Update, Resolve, Close, and category
            management. A role can hold any combination.
          </Callout>
        </CardContent>
      </Card>

      {/* Admin: Users */}
      <Card>
        <CardHeader>
          <SectionHeader icon={Users} kicker="Company Administration" title="Users" />
          <CardDescription>
            Settings → Users lists everyone with access to the company — name, email, department, roles, and
            status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Adding someone</p>
            <p className="mt-1 text-sm text-muted-foreground">
              "Invite employee" offers two modes: <span className="font-medium text-foreground">Email invite</span>{" "}
              sends a link so they set their own password; <span className="font-medium text-foreground">Create
              directly</span> creates the account immediately with a temporary password shown on screen — no
              email sent, share it yourself.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Managing an existing user</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click anyone in the list to change their roles, reset their password, or disable/re-enable their
              access. Disabling blocks sign-in immediately without deleting their history or account.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Admin: Departments */}
      <Card>
        <CardHeader>
          <SectionHeader icon={Building2} kicker="Company Administration" title="Departments" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Settings → Departments is where departments get created and organized — Design, Production, Finance,
            and so on. Assign someone to a department from their profile in Users, or right when they're
            invited.
          </p>
        </CardContent>
      </Card>

      {/* Admin: Roles */}
      <Card>
        <CardHeader>
          <SectionHeader icon={ShieldCheck} kicker="Company Administration" title="Roles & permissions" />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Settings → Roles is where access control actually lives. A role is a named bundle of permissions —
            create one, name and describe it, then check off exactly which actions it grants.
          </p>
          <ul className="space-y-3">
            <Item title="Create a role">Name it, describe it, then build its permission set in the editor.</Item>
            <Item title="Assign it">Attach roles to people from the Users page — someone can hold more than one.</Item>
            <Item title="Retire a role">Delete roles no longer needed — double-check nobody still depends on it.</Item>
          </ul>
        </CardContent>
      </Card>

      {/* Admin: Appearance */}
      <Card>
        <CardHeader>
          <SectionHeader icon={Palette} kicker="Company Administration" title="Appearance" />
          <CardDescription>Settings → Appearance is where the company's own visual identity lives.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <Item title="Company icon">Shown at the top of the sidebar and anywhere the company is listed.</Item>
            <Item title="Login page background">
              Displayed behind the sign-in form at the company's own login page — the card automatically stays
              readable over whatever's uploaded.
            </Item>
            <Item title="Sidebar background">
              A solid color or an uploaded image behind the navigation sidebar. Text switches to light or dark
              automatically to stay readable.
            </Item>
          </ul>
        </CardContent>
      </Card>

      <p className="pb-4 text-xs text-muted-foreground">
        Screens and permission names may vary slightly if roles have been customized.
      </p>
    </div>
  );
}
