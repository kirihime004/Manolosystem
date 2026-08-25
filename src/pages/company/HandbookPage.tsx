import {
  BookOpen,
  LogIn,
  LayoutDashboard,
  Ticket as TicketIcon,
  Headset,
  Boxes,
  ShoppingCart,
  UserSquare2,
  CalendarClock,
  Wallet,
  DollarSign,
  BookOpenCheck,
  Receipt,
  ReceiptText,
  Landmark,
  PiggyBank,
  Building2,
  ClipboardList,
  MapPin,
  Package,
  Armchair,
  Car,
  Plane,
  UserCheck,
  PartyPopper,
  FileSignature,
  Megaphone,
  Clapperboard,
  FolderKanban,
  Film,
  Shapes,
  ListChecks,
  GitBranch,
  SendToBack,
  Gauge,
  Users,
  ShieldCheck,
  Coins,
  Palette,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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

const CHAPTERS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "it", label: "IT" },
  { id: "hr", label: "HR" },
  { id: "finance", label: "Finance" },
  { id: "admin", label: "Administration" },
  { id: "production", label: "Production" },
  { id: "company", label: "Company Settings" },
  { id: "roles", label: "Roles & Permissions" },
];

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
          A complete guide to every module of the platform — IT, HR, Finance, Administration, Production, and
          Company settings.
        </p>
      </div>

      <Callout>
        What a person actually sees depends on their role. Every screen and button described below is gated by
        a permission — if something isn't in someone's sidebar, their role doesn't include it. Adjust roles from{" "}
        <span className="font-medium text-foreground">Settings → Roles</span>.
      </Callout>

      <nav className="flex flex-wrap gap-1.5">
        {CHAPTERS.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {c.label}
          </a>
        ))}
      </nav>

      {/* ================================================================ */}
      {/* GETTING STARTED */}
      {/* ================================================================ */}
      <div id="getting-started" className="scroll-mt-6 space-y-6">
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

        <Card>
          <CardHeader>
            <SectionHeader icon={LayoutDashboard} kicker="Start here" title="Your dashboard" />
            <CardDescription>Every module has its own dashboard, and the top-level one adapts to what each person actually does.</CardDescription>
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
              <p className="text-sm font-medium text-foreground">Module staff</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Live counters for whichever modules they work in — open tickets, pending approvals, tasks at risk,
                and so on — with a shortcut into that module's own dashboard.
              </p>
            </div>
            <div className="rounded-md border border-border p-3.5">
              <p className="text-sm font-medium text-foreground">Everyone else</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Counts and recent activity for things they personally submitted, across whichever modules are
                enabled for the company.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* IT */}
      {/* ================================================================ */}
      <div id="it" className="scroll-mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">IT</h2>
          <p className="text-sm text-muted-foreground">Ticketing, Inventory, and Budget & Procurement — each independently switchable.</p>
        </div>

        <Card>
          <CardHeader>
            <SectionHeader icon={TicketIcon} kicker="IT — Ticketing" title="Submitting & tracking tickets" />
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

        <Card>
          <CardHeader>
            <SectionHeader icon={Headset} kicker="IT — Ticketing" title="Working the queue (IT staff)" />
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

        <Card>
          <CardHeader>
            <SectionHeader icon={Boxes} kicker="IT — Inventory" title="Hardware, software & assets" />
            <CardDescription>Tracks every asset the company owns, from purchase to disposal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              <Item title="All Items / Hardware / Software">
                Browse the asset register — each item has its own auto-generated asset code, assignment, and status.
              </Item>
              <Item title="Subscriptions">
                Recurring software licenses and their renewal dates — the dashboard flags anything nearing expiry.
              </Item>
              <Item title="Credentials & IP Addresses">
                Login credentials tied to an asset (reveal is its own permission), and the company's IP allocation,
                with automatic conflict detection.
              </Item>
              <Item title="Repairs & Disposal">
                Repair history and formal retirement of assets at end of life — both captured in Asset History.
              </Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={ShoppingCart} kicker="IT — Budget & Procurement" title="Purchasing pipeline" />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A full purchase pipeline: Purchase Requests move through review and approval, become Quotations,
              then Purchase Orders, tracked through Deliveries against named Suppliers, with a History log and
              Reports for the whole pipeline.
            </p>
            <Callout>
              Reports → IT Reports gives a company-wide export/print view across tickets, inventory, and
              procurement for anyone holding the Reports permission.
            </Callout>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* HR */}
      {/* ================================================================ */}
      <div id="hr" className="scroll-mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Human Resources</h2>
          <p className="text-sm text-muted-foreground">Employees, Attendance & Leave, and Payroll & Benefits — each independently switchable.</p>
        </div>

        <Card>
          <CardHeader>
            <SectionHeader icon={UserSquare2} kicker="HR — Employees" title="The employee master record" />
            <CardDescription>The single identity every other module — IT, Finance, Admin, Production — references.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              <Item title="Employee profile">
                Personal details, department, position, manager/supervisor, employment type and status, hire date,
                and documents. An employee can exist purely as an HR record with no system login at all.
              </Item>
              <Item title="Org Chart">A visual reporting-line view built from each employee's manager assignment.</Item>
              <Item title="Employee Requests">
                A self-service inbox for things like ID reissues or record corrections, routed to HR for action.
              </Item>
              <Item title="Documents & Contracts">Signed documents and employment contracts, including renewals.</Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={CalendarClock} kicker="HR — Attendance & Leave" title="Attendance, leave, overtime & timesheets" />
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              <Item title="Attendance">Clock-in/out records, with statuses like Present, Late, Remote, On Leave, and Holiday.</Item>
              <Item title="Leave">
                Leave requests move through a submit → approve workflow; only an <span className="font-medium text-foreground">Approved</span> request
                counts as confirmed time off.
              </Item>
              <Item title="Overtime">Requested and approved the same way, feeding into payroll calculations.</Item>
              <Item title="Timesheets">A per-period summary of worked hours for approval.</Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Wallet} kicker="HR — Payroll & Benefits" title="Benefits, deductions & payroll" />
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              <Item title="Benefits & Deductions">Configure the recurring benefit and deduction line items available to payroll.</Item>
              <Item title="Payroll">
                Runs are generated per pay period, calculated from attendance, overtime, benefits, and deductions,
                then approved before disbursement.
              </Item>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* FINANCE */}
      {/* ================================================================ */}
      <div id="finance" className="scroll-mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Finance</h2>
          <p className="text-sm text-muted-foreground">The full accounting cycle, split into six independently switchable areas.</p>
        </div>

        <Card>
          <CardHeader>
            <SectionHeader icon={DollarSign} kicker="Finance" title="Where each area covers" />
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 rounded-md border border-border p-3.5">
              <div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-primary" /><p className="text-sm font-medium text-foreground">Accounting</p></div>
              <p className="text-xs text-muted-foreground">Chart of Accounts, Journal Entries, General Ledger, Trial Balance, fiscal periods & years.</p>
            </div>
            <div className="space-y-1.5 rounded-md border border-border p-3.5">
              <div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /><p className="text-sm font-medium text-foreground">Accounts Payable</p></div>
              <p className="text-xs text-muted-foreground">Supplier bills and AP aging.</p>
            </div>
            <div className="space-y-1.5 rounded-md border border-border p-3.5">
              <div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-primary" /><p className="text-sm font-medium text-foreground">Accounts Receivable</p></div>
              <p className="text-xs text-muted-foreground">Customers, invoices, and AR aging.</p>
            </div>
            <div className="space-y-1.5 rounded-md border border-border p-3.5">
              <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><p className="text-sm font-medium text-foreground">Expenses</p></div>
              <p className="text-xs text-muted-foreground">Employee expense claims and approvals.</p>
            </div>
            <div className="space-y-1.5 rounded-md border border-border p-3.5">
              <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /><p className="text-sm font-medium text-foreground">Cash & Bank</p></div>
              <p className="text-xs text-muted-foreground">Cash accounts, bank transactions, reconciliation.</p>
            </div>
            <div className="space-y-1.5 rounded-md border border-border p-3.5">
              <div className="flex items-center gap-2"><PiggyBank className="h-4 w-4 text-primary" /><p className="text-sm font-medium text-foreground">Payroll</p></div>
              <p className="text-xs text-muted-foreground">Payroll runs and payslips (mirrors HR Payroll).</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium text-foreground">How money moves through the system</p>
            <p className="text-sm text-muted-foreground">
              Every transactional record — an invoice, a bill, an expense, a payroll run — carries its own
              currency, the exchange rate resolved at the moment it was finalized, and the equivalent amount in
              the company's base currency. That snapshot is never recalculated later, even if exchange rates or
              currency settings change afterward — it reflects exactly what was true when the record was created.
            </p>
            <Callout>
              Finance → Reports gives company-wide financial reporting, exportable and printable, for anyone
              holding the Reports permission.
            </Callout>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* ADMINISTRATION */}
      {/* ================================================================ */}
      <div id="admin" className="scroll-mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Administration</h2>
          <p className="text-sm text-muted-foreground">Day-to-day office operations, split into ten independently switchable areas.</p>
        </div>

        <Card>
          <CardHeader>
            <SectionHeader icon={ClipboardList} kicker="Admin — Requests" title="General service requests" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A general-purpose administrative request queue — a 12-step workflow from submission through review,
              approval, assignment, work, and closure — for anything that doesn't fit a more specific module.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={MapPin} kicker="Admin — Facilities" title="Locations, rooms & workspaces" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <Item title="Locations, Buildings, Floors">The physical hierarchy of company sites.</Item>
              <Item title="Rooms & Room Bookings">
                Meeting rooms with server-enforced overlap prevention — two people can never double-book the same
                room and time.
              </Item>
              <Item title="Workspaces">Desk/seat assignment and release, tracked with full history.</Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Package} kicker="Admin — Office Supplies" title="Consumables & supply requests" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Consumables inventory with a movement ledger — every stock change is logged, never just a raw
              quantity edit — and a request-and-issue workflow for staff to draw supplies.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Armchair} kicker="Admin — Administrative Assets" title="Furniture, appliances & maintenance" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Furniture, appliances, and other non-IT company property — tracked separately from IT's hardware
              register — with assignment, reassignment, and disposal history, plus scheduled and on-demand
              Maintenance.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Car} kicker="Admin" title="Vehicles, Travel, Visitors & Events" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <Item title="Vehicles">Company fleet assignment and maintenance.</Item>
              <Item title="Travel">Travel requests through a fixed approval-and-booking pipeline.</Item>
              <Item title="Visitors & Meetings">
                Front-desk check-in/out, and internal meeting scheduling (reusing the same room-booking overlap
                protection).
              </Item>
              <Item title="Events">Company events with their own task checklists.</Item>
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline"><Plane className="h-3 w-3" /> Travel</Badge>
              <Badge variant="outline"><UserCheck className="h-3 w-3" /> Visitors</Badge>
              <Badge variant="outline"><PartyPopper className="h-3 w-3" /> Events</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={FileSignature} kicker="Admin — Contracts" title="Contracts, compliance & documents" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Administrative contracts (distinct from HR employment contracts) with renewal history, plus
              compliance records and a private document library.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Megaphone} kicker="Admin — Comms" title="Announcements & courier" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Company-wide announcements, and a log for tracking incoming/outgoing courier and mail.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* PRODUCTION */}
      {/* ================================================================ */}
      <div id="production" className="scroll-mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Production</h2>
          <p className="text-sm text-muted-foreground">
            The animation/creative-production pipeline, split into eight independently switchable areas. It reuses
            the company's existing Customers, Employees, Departments, and Budget records rather than duplicating
            them.
          </p>
        </div>

        <Card>
          <CardHeader>
            <SectionHeader icon={FolderKanban} kicker="Production — Projects" title="Projects, shows, episodes & sequences" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <Item title="Shows, Episodes, Sequences">
                The optional hierarchy above individual shots, each with its own auto-generated code (e.g. EP01,
                SQ010).
              </Item>
              <Item title="Members">
                Who's staffed on the project and in what role — Director, Producer, Supervisor, Artist,
                Coordinator, or Client Liaison.
              </Item>
              <Item title="Milestones, Deliverables & Budget">
                Each shown as its own tab on the project, with the Budget tab pulling live totals from the
                company's Budget module.
              </Item>
              <Item title="Client portal access">
                A per-project toggle that lets a linked client see shots and versions explicitly marked
                client-visible — nothing is shared by default.
              </Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Film} kicker="Production — Shots" title="The shot grid" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A shot's full code is computed from a per-company configurable naming format (default{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{"{episode}_{sequence}_{shot}"}</code>,
              e.g. EP01_SQ010_SH010) — not hard-coded to one studio's convention.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Shapes} kicker="Production — Assets" title="Characters, props, environments & rigs" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Production Assets are tracked separately from IT and Administrative assets, since they follow a
              creative build pipeline instead of a physical inventory one.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={ListChecks} kicker="Production — Tasks" title="Task board & dependencies" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <Item title="Task Board">
                A Kanban board — drag a card between Not Started, In Progress, Pending Review, Changes Requested,
                Approved, and Completed.
              </Item>
              <Item title="Dependencies">
                A Finish-to-Start dependency actually blocks the dependent task from starting until its
                predecessor is completed or approved — not just a visual hint.
              </Item>
              <Item title="Task Types">
                A per-company configurable pipeline step list (Modeling, Rigging, Layout, Animation, FX, Lighting,
                Compositing by default).
              </Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={GitBranch} kicker="Production — Reviews" title="Frame-by-frame video review" />
            <CardDescription>Submitting a version accepts an actual video or image file. The review player then works like a dedicated frame-accurate media tool.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <Step n={1} title="Scrub frame-by-frame.">
                Play/pause, step one frame at a time, or drag the scrubber — the frame counter reflects the shot's
                own frame numbering (e.g. 1001 / 1051), not just the raw file.
              </Step>
              <Step n={2} title="Draw directly on the current frame.">
                A pen tool with color choices lets a reviewer mark up exactly what needs to change, right on top
                of the paused frame.
              </Step>
              <Step n={3} title="Save it as a frame note.">
                The drawing and a written comment are saved together, pinned to that exact frame number.
              </Step>
              <Step n={4} title="Jump back to any annotated frame.">
                The Frame Notes list jumps playback to that frame and redraws the saved markup on top of it.
              </Step>
            </div>
            <p className="text-sm text-muted-foreground">
              Reviews themselves are a request-and-decide flow: request a review from a specific person, who then
              approves or requests changes — a decision that automatically updates the version's and the shot's
              own status.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={SendToBack} kicker="Production" title="Schedule, Deliverables & Resources" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <Item title="Schedule">Milestones across every active project in one place.</Item>
              <Item title="Deliverables">
                What's owed to the client, with due dates and delivery status, optionally linked to a specific
                approved version.
              </Item>
              <Item title="Resources">
                <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /></span> Team
                workload — open task counts and estimated hours per person — cross-referenced against real HR
                leave and attendance to show who's actually available on a given day.
              </Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Clapperboard} kicker="Production" title="The Client Portal" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A client contact signs in at a separate portal address with their own account — this is never the
              same login path or permission model staff use, so a client can never see HR, Finance, IT, or Admin
              data, or any internal note. They see only the projects, shots, versions, and deliverables a producer
              has explicitly marked visible, and can approve or request changes on their own review.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* COMPANY SETTINGS */}
      {/* ================================================================ */}
      <div id="company" className="scroll-mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Company Settings</h2>
        </div>

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

        <Card>
          <CardHeader>
            <SectionHeader icon={Coins} kicker="Company Administration" title="Currency" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Company-wide currency settings and exchange rates. Changing a rate only affects new records going
              forward — every past transaction keeps the rate that was true when it was recorded.
            </p>
          </CardContent>
        </Card>

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
      </div>

      {/* ================================================================ */}
      {/* ROLES & PERMISSIONS */}
      {/* ================================================================ */}
      <div id="roles" className="scroll-mt-6 space-y-6">
        <Card>
          <CardHeader>
            <SectionHeader icon={ShieldCheck} kicker="Reference" title="Roles & permissions" />
            <CardDescription>
              Every screen, button, and action is gated by a named permission (e.g.{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">PRODUCTION.TASKS.UPDATE</code>). A
              role is a bundle of permissions, and a person can hold more than one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Create a role</p>
              <p className="mt-1 text-sm text-muted-foreground">Name it, describe it, then build its permission set in the editor.</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Assign it</p>
              <p className="mt-1 text-sm text-muted-foreground">Attach roles to people from the Users page — someone can hold more than one.</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Retire a role</p>
              <p className="mt-1 text-sm text-muted-foreground">Delete roles no longer needed — double-check nobody still depends on it.</p>
            </div>

            <Separator />

            <div>
              <p className="mb-2.5 text-sm font-medium text-foreground">Pre-built system roles</p>
              <ul className="space-y-3">
                <Item title="Admin">Every permission that exists — full access to every module.</Item>
                <Item title="IT">The full ticket lifecycle and day-to-day inventory operations.</Item>
                <Item title="HR">The whole HR surface except deleting employees or approving payroll.</Item>
                <Item title="Accountant">The whole Finance surface.</Item>
                <Item title="Administrative Officer">The whole Administration business surface.</Item>
                <Item title="Director / Producer">The full Production surface — project, schedule, and budget authority.</Item>
                <Item title="Supervisor">Departmental oversight in Production — task assignment and review decisions, without project or budget management.</Item>
                <Item title="Artist">Self-service in Production — view assigned work, submit versions, respond to reviews and notes.</Item>
                <Item title="Employee">Baseline access — file IT tickets, submit HR requests, and whatever else every role is granted by default.</Item>
              </ul>
            </div>

            <Callout>
              These system roles are starting points, not fixed limits. Company Admins can create custom roles
              combining any permissions needed, or adjust what a system role grants under Settings → Roles.
            </Callout>
          </CardContent>
        </Card>
      </div>

      <p className="pb-4 text-xs text-muted-foreground">
        Screens and permission names may vary slightly if roles have been customized.
      </p>
    </div>
  );
}
