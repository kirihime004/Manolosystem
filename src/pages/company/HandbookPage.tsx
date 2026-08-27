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
  Calculator,
  Banknote,
  MessageCircle,
  TrendingUp,
  Settings2,
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
  { id: "budget", label: "Budget & Procurement" },
  { id: "hr", label: "HR" },
  { id: "finance", label: "Finance" },
  { id: "admin", label: "Administration" },
  { id: "production", label: "Production" },
  { id: "ai", label: "AI" },
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
              <p className="text-sm font-medium text-foreground">Company health banner</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                When the AI module is on, a bar at the very top shows one overall status — All clear, Needs
                attention, or Action needed — plus a small colored dot per department (IT, HR, Finance,
                Administration, Production). Click it to open the full AI dashboard.
              </p>
            </div>
            <div className="rounded-md border border-border p-3.5">
              <p className="text-sm font-medium text-foreground">Company Admins</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                A Team panel shows Total users, Active, Invited, and Disabled counts, with a shortcut to manage
                users.
              </p>
            </div>
            <div className="rounded-md border border-border p-3.5">
              <p className="text-sm font-medium text-foreground">Departments</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                One card per module the viewer can see — Inventory, Procurement, HR, Finance, Administration,
                Production — each with a handful of headline numbers (open items, pending approvals, cash
                balance, and so on). Clicking a card opens that department's own full dashboard.
              </p>
            </div>
            <div className="rounded-md border border-border p-3.5">
              <p className="text-sm font-medium text-foreground">Ticketing</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Staff who can see every ticket get live counts (Open, Critical, In Progress, Resolved); everyone
                else sees their own ticket counts plus a personal activity feed of comments and status changes on
                tickets they filed.
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
            <SectionHeader icon={Boxes} kicker="IT — Inventory" title="Adding a hardware or software asset" />
            <CardDescription>Tracks every asset the company owns, from purchase to disposal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Step n={1} title="Go to Inventory → All Items, Hardware, or Software, then click New asset.">
                Opens a full page for the new asset, not a popup.
              </Step>
              <Step n={2} title="Choose the Hardware or Software tab.">
                Each shows a different set of fields below it.
              </Step>
              <Step n={3} title="Hardware: fill in Name, Category, Lifecycle, Brand, Model, Serial number, Asset tag, Hostname, IP address, MAC address, and Warranty end.">
                Software: fill in Name, Vendor, Version, License key, and Number of licenses — then, if it's a
                Subscription rather than a one-time purchase, also Renewal date, Billing cycle, Subscription cost,
                and Seats.
              </Step>
              <Step n={4} title="Fill in Purchase date, Purchase price, Currency, Supplier, Assigned to, Location, and Notes.">
                All optional, but assigning it to a location or employee is what makes it show up on their asset
                list.
              </Step>
              <Step n={5} title="Click Create asset.">
                It gets its own asset code automatically and appears in the register immediately.
              </Step>
            </div>
            <ul className="space-y-3">
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
            <SectionHeader icon={ShoppingCart} kicker="IT — Budget & Procurement" title="Creating a purchase request" />
            <CardDescription>Purchase Requests move through review and approval, become Quotations, then Purchase Orders, tracked through Deliveries against named Suppliers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <Step n={1} title="Go to Procurement → Purchase Requests, then click New request.">
                Opens a full page, not a popup.
              </Step>
              <Step n={2} title="Fill in Budget, Budget category, Department, Priority, Required date, Reason, Description, and Currency.">
                The budget and category determine which spending pool this request draws from.
              </Step>
              <Step n={3} title="Click Add item for each line item.">
                Each line needs its own Description, Type (Hardware / Software / Other), Qty, and Unit Price.
              </Step>
              <Step n={4} title="Click Save as draft, or Create & submit to send it straight into the approval workflow.">
                A draft can still be edited; once submitted, it moves through the review/approval chain toward
                becoming a Quotation and then a Purchase Order.
              </Step>
            </div>
            <Callout>
              Reports → IT Reports gives a company-wide export/print view across tickets, inventory, and
              procurement for anyone holding the Reports permission. The Budget a purchase request draws from
              isn't an IT-only thing anymore — see the <a href="#budget" className="font-medium underline underline-offset-2">Budget & Procurement</a> chapter
              below for how the whole shared system works.
            </Callout>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* BUDGET & PROCUREMENT (shared engine) */}
      {/* ================================================================ */}
      <div id="budget" className="scroll-mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Budget & Procurement</h2>
          <p className="text-sm text-muted-foreground">
            One shared, Finance-approved budgeting engine used by every department — IT, HR, Finance,
            Administration, and Production each prepare their own budgets in it, and Finance reviews and approves
            all of them from one place. It's reached from each department's own{" "}
            <span className="font-medium text-foreground">Budget</span> sidebar item, not a separate module.
          </p>
        </div>

        <Callout>
          A budget always belongs to exactly one department (its <span className="font-medium">module</span>), but
          the underlying tables, statuses, and workflow are identical everywhere — learn it once here and it works
          the same in IT → Budget, HR → Budget, Finance → Budget, Admin → Budget, and Production → Budget.
        </Callout>

        <Card>
          <CardHeader>
            <SectionHeader icon={Wallet} kicker="Budget" title="Preparing a department budget" />
            <CardDescription>Every department's Budget dashboard, budgets list, and budget detail page work identically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Step n={1} title="Go to <Department> → Budget → Budgets, then click + New budget.">
                Fill in Budget name, Fiscal year, Start date, End date, Currency, and optionally a Department,
                Cost center, or linked Project, then click <span className="font-medium text-foreground">Create</span>.
                It starts as a <span className="font-medium text-foreground">Draft</span> with no lines and no
                money committed yet.
              </Step>
              <Step n={2} title="Add lines and allocate by category.">
                On the budget's own page: <span className="font-medium text-foreground">Add line</span> for each
                planned expense (Description, Category, Quantity, Unit cost, and the Requested amount it works
                out to), and <span className="font-medium text-foreground">Allocate category</span> to set a cap
                per spending category. Categories themselves come from{" "}
                <span className="font-medium text-foreground">Budget → Categories</span> — a small shared list
                (Hardware, Software, Travel, and so on) each department can extend.
              </Step>
              <Step n={3} title="Click Submit to Finance.">
                Requires at least one line. This locks the budget from further line edits and sends it into
                Finance's review queue.
              </Step>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">What happens next</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A Finance reviewer clicks <span className="font-medium text-foreground">Start review</span> (moving
                it to <span className="font-medium text-foreground">Finance Review</span>), then either:
              </p>
              <ul className="mt-2 space-y-2">
                <Item title="Approve"><span className="font-medium text-foreground">Approved</span> — Finance can approve each line at a different amount than requested (a partial approval); both the requested and approved figures stay on record side by side, permanently.</Item>
                <Item title="Return for revision">Sends it back to <span className="font-medium text-foreground">Returned for Revision</span> with a required reason — the requesting department edits and resubmits.</Item>
                <Item title="Reject">Sends it to <span className="font-medium text-foreground">Rejected</span> with a required reason — final, no resubmission.</Item>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Activating and spending against it</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Once <span className="font-medium text-foreground">Approved</span>, the department clicks{" "}
                <span className="font-medium text-foreground">Activate</span> to make it{" "}
                <span className="font-medium text-foreground">Active</span> and actually spendable — this is the
                status a purchase request, expense, or payroll run checks against for available budget. From
                there: <span className="font-medium text-foreground">Record adjustment</span> logs a manual
                correction (with a signed amount and a reason), and{" "}
                <span className="font-medium text-foreground">Request increase</span> starts a{" "}
                <span className="font-medium text-foreground">Revision</span> — its own small approve/reject
                decision on Finance's side that, once approved, raises the budget's total without touching the
                original approved lines. A budget can be <span className="font-medium text-foreground">Cancel</span>ed
                while still a draft, or closed out entirely once its period ends.
              </p>
            </div>
            <Callout>
              Every transaction — a commitment when a purchase order is raised, an expense when it's actually
              spent, a release if a commitment falls through — posts automatically to the budget's{" "}
              <span className="font-medium text-foreground">Transactions</span> ledger. Nobody edits that ledger by
              hand; it's what Allocated / Committed / Spent / Available on the budget's own summary are computed
              from.
            </Callout>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={ShoppingCart} kicker="Procurement" title="Purchase Requests → Quotations → Purchase Orders → Deliveries" />
            <CardDescription>IT's own procurement pipeline draws its money from an IT-department budget through this same shared engine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              <Item title="Purchase Requests">Created against a specific Budget + Category (see the IT chapter above); submitting checks that budget actually has enough Available before it's allowed through.</Item>
              <Item title="Quotations">One or more supplier quotes attached to an approved request; selecting one records why it was chosen over the others.</Item>
              <Item title="Purchase Orders">Generated from a selected quotation; approving a PO is what actually posts a Commitment against the budget.</Item>
              <Item title="Deliveries">Receiving items against a PO — partial receipts are tracked line by line, and a full receipt converts the commitment into real Spent.</Item>
              <Item title="Suppliers">The vendor directory quotations and purchase orders are raised against, each with its own order history.</Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={ShieldCheck} kicker="Finance-only" title="Budget Approvals & Company Budget Overview" />
            <CardDescription>Two screens that only Finance sees, reached from Finance → Budget Approvals and Finance → Company Budget Overview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              <Item title="Budget Approvals">One queue of every department's budgets currently sitting in Submitted or Finance Review — Finance never has to go department by department to find what's waiting on them.</Item>
              <Item title="Company Budget Overview">A read-only, company-wide roll-up of every department's budgets side by side — total requested, approved, committed, spent, and available, for a full picture of company spending at a glance.</Item>
            </ul>
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
            <SectionHeader icon={UserSquare2} kicker="HR — Employees" title="Adding an employee" />
            <CardDescription>The single identity every other module — IT, Finance, Admin, Production — references.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Step n={1} title="Go to Employees, then click + New employee.">
                Opens a full page, not a popup.
              </Step>
              <Step n={2} title="Optionally link a User account, then fill in First name, Last name, Company email, Personal email, and Phone.">
                Linking a user account is what lets this person actually sign in — an employee can exist purely as
                an HR record with no system login at all.
              </Step>
              <Step n={3} title="Fill in Hire date, Department, Position, Employment type, and Employment status.">
                These drive the org chart and everywhere else the employee shows up (assignee lists, task board,
                and so on).
              </Step>
              <Step n={4} title="Click Create employee.">
                They get an employee number automatically.
              </Step>
            </div>
            <ul className="space-y-3">
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
            <SectionHeader icon={CalendarClock} kicker="HR — Attendance & Leave" title="Requesting leave" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Step n={1} title="Go to Leave, then click + Request leave.">
                Opens a dialog.
              </Step>
              <Step n={2} title="Fill in Leave type, Start date, End date, and Reason.">
                The date range determines how many days are deducted once approved.
              </Step>
              <Step n={3} title="Click Submit.">
                The request appears in your own list, and in your manager's approvals queue with{" "}
                <span className="font-medium text-foreground">Approve</span>/<span className="font-medium text-foreground">Reject</span> buttons.
                Only an <span className="font-medium text-foreground">Approved</span> request counts as confirmed
                time off. A <span className="font-medium text-foreground">Cancel</span> button is available on your
                own request while it's still Draft or Submitted.
              </Step>
            </div>
            <ul className="space-y-3">
              <Item title="Attendance">Clock-in/out records, with statuses like Present, Late, Remote, On Leave, and Holiday.</Item>
              <Item title="Overtime">Requested and approved the same way as leave, feeding into payroll calculations.</Item>
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
              <p className="text-xs text-muted-foreground">Payroll runs and payslips (mirrors HR Payroll). Also where approved Production earnings get pulled in and paid — see Production → Rate Cards & Approved Work.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">Finance also owns two shared, company-wide screens</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Budget</span>,{" "}
              <span className="font-medium text-foreground">Budget Approvals</span>, and{" "}
              <span className="font-medium text-foreground">Company Budget Overview</span> — Finance's own budgets
              plus the review queue and roll-up for every OTHER department's budgets too — are covered fully in the{" "}
              <a href="#budget" className="font-medium underline underline-offset-2">Budget & Procurement</a> chapter.
              <span className="font-medium text-foreground"> Production Earnings</span> — approved Production work
              waiting to be sent to Finance and pulled into a payroll run — is covered in{" "}
              <a href="#production" className="font-medium underline underline-offset-2">Production</a>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Wallet} kicker="Finance — Expenses" title="Submitting an expense claim" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Go to Expenses, then click New claim.">
              Opens a dialog.
            </Step>
            <Step n={2} title="Fill in Category, Date, Description, and Amount.">
              Amount is entered in whichever currency the claim was actually incurred in.
            </Step>
            <Step n={3} title="Click Create claim.">
              It enters the approval queue; approving it is a separate action from the claim itself.
            </Step>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={BookOpenCheck} kicker="Finance — Accounting" title="Creating a journal entry" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Go to Accounting → Journal Entries, then click New journal entry.">
              Opens a dialog.
            </Step>
            <Step n={2} title="Fill in Date and Description, then click Create draft.">
              This creates the entry as a draft — open it afterward to add its debit/credit lines against the
              Chart of Accounts before posting it to the General Ledger.
            </Step>
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
            <SectionHeader icon={ClipboardList} kicker="Admin — Requests" title="Submitting a general request" />
            <CardDescription>For anything that doesn't fit a more specific module — a 12-step workflow from submission through review, approval, assignment, work, and closure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Go to Requests, then click + New request.">
              Opens a dialog.
            </Step>
            <Step n={2} title="Fill in Category, Subject, Description, and Priority.">
              The category determines who it's routed to.
            </Step>
            <Step n={3} title="Click Submit.">
              It enters the review queue; staff with the right permissions can then review, approve, assign, work,
              and close it.
            </Step>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={MapPin} kicker="Admin — Facilities" title="Booking a room" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Go to Facilities → Room Bookings, then click + Book a room.">
              Opens a dialog.
            </Step>
            <Step n={2} title="Fill in Room, Date, Start time, End time, and Purpose.">
              Purpose shows up on the room's calendar for anyone else browsing bookings.
            </Step>
            <Step n={3} title="Click Book room.">
              If the room is already booked for an overlapping time, the server rejects it outright — two people
              can never double-book the same room and time.
            </Step>
            <ul className="space-y-3 pt-2">
              <Item title="Locations, Buildings, Floors">The physical hierarchy of company sites, managed separately.</Item>
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

        <Callout>
          Almost every list in Production — Projects, Shots, Assets, Sequences, Episodes, Shows, Milestones,
          Deliverables — shows a small <span className="font-medium text-foreground">⋯</span> menu button at the
          right edge of each row. That's always where Edit and Delete live, and Delete always asks you to confirm
          before anything is actually removed.
        </Callout>

        <Card>
          <CardHeader>
            <SectionHeader icon={FolderKanban} kicker="Production — Projects" title="Creating a project" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Step n={1} title="Go to Production → Projects, then click + New project.">
                Opens a dialog.
              </Step>
              <Step n={2} title="Fill in Name and Type (Feature Film, Series, Short, Commercial, Game Cinematic, or Other).">
                Then optionally Description, Client (pulled from Finance's existing Customers), Director, and
                Producer.
              </Step>
              <Step n={3} title="Click Create.">
                The project gets its own project code (e.g. PRJ-000006) automatically and opens to its Overview
                tab.
              </Step>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Editing or deleting a project</p>
              <p className="mt-1 text-sm text-muted-foreground">
                From the Projects list, click a project's own <span className="font-medium text-foreground">⋯</span> menu
                and choose <span className="font-medium text-foreground">Delete</span>. To edit its name or
                description, open the project and click the <span className="font-medium text-foreground">⋯</span> menu
                next to its status badge, then <span className="font-medium text-foreground">Edit</span>. Deleting a
                project also deletes everything under it — shows, episodes, sequences, shots, assets, tasks,
                versions, milestones, and deliverables — so it always asks for confirmation first.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Overview tab</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Change <span className="font-medium text-foreground">Status</span> (Planning, In Progress, On
                Hold, Completed, Cancelled, Archived) from a dropdown right on the page — no dialog needed. The{" "}
                <span className="font-medium text-foreground">Client portal access</span> toggle only turns on once
                a client is assigned; switching it on lets that client see whatever shots and versions get marked
                client-visible.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={FolderKanban} kicker="Production — Projects" title="Adding shows, episodes & sequences" />
            <CardDescription>All three live on a project's own Episodes & Sequences tab, each in its own table.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Show (optional — only needed if the project spans multiple shows): click + Show, fill in Name and Description, click Create.">
              Edit or delete it later from its row's <span className="font-medium text-foreground">⋯</span> menu.
            </Step>
            <Step n={2} title="Episode: click + Episode, fill in the Episode number, click Create.">
              It's given a code automatically (e.g. EP01). Open its <span className="font-medium text-foreground">⋯</span> menu
              → Edit to set a Name or change its Status (Planning, In Progress, Completed, Delivered, On Hold)
              afterward.
            </Step>
            <Step n={3} title="Sequence: click + Sequence, optionally pick an Episode, fill in the Sequence number, click Create.">
              It's given a code automatically (e.g. SQ010). Open its{" "}
              <span className="font-medium text-foreground">⋯</span> menu → Edit to set a Name or change its Status
              afterward, or → Delete to remove it — this is exactly where you'd fix an accidentally-created
              sequence.
            </Step>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Users} kicker="Production — Projects" title="Members, Milestones & Deliverables tabs" />
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              <Item title="Members">
                Click <span className="font-medium text-foreground">+ Add member</span>, choose an Employee and a
                Role (Director, Producer, Supervisor, Artist, Coordinator, or Client Liaison), then{" "}
                <span className="font-medium text-foreground">Add</span>. Each row has its own{" "}
                <span className="font-medium text-foreground">Remove</span> button.
              </Item>
              <Item title="Milestones">
                Click <span className="font-medium text-foreground">+ Milestone</span>, fill in Name and Due date,
                then <span className="font-medium text-foreground">Create</span>. Edit or delete from the row's{" "}
                <span className="font-medium text-foreground">⋯</span> menu.
              </Item>
              <Item title="Deliverables">
                Click <span className="font-medium text-foreground">+ Deliverable</span>, fill in Name and an
                optional Due date, then <span className="font-medium text-foreground">Create</span>. Status
                (Pending, In Progress, Ready, Delivered, Rejected) is a dropdown right on the row; edit or delete
                from its <span className="font-medium text-foreground">⋯</span> menu.
              </Item>
              <Item title="Budget">
                Read-only here — shows Total, Allocated, Spent, and Remaining once a budget from Finance is linked
                to the project.
              </Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Film} kicker="Production — Shots" title="Adding a shot" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Go to Production → Shots, pick a Project and optionally a sequence filter, then click + New shot.">
              Opens a dialog.
            </Step>
            <Step n={2} title="Pick the Sequence it belongs to and its Shot number, then click Create.">
              Its code (e.g. SH010) and full display code — computed from a per-company configurable naming
              format, default <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{"{episode}_{sequence}_{shot}"}</code>,
              e.g. EP01_SQ010_SH010 — are both generated automatically.
            </Step>
            <p className="text-sm text-muted-foreground">
              Click a shot's code to open it. From there, its own{" "}
              <span className="font-medium text-foreground">⋯</span> menu (next to the status/risk badges) has{" "}
              <span className="font-medium text-foreground">Edit</span> (description, frame end) and{" "}
              <span className="font-medium text-foreground">Delete</span>. The{" "}
              <span className="font-medium text-foreground">Visible to client portal</span> toggle controls
              whether a linked client can see this specific shot.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Shapes} kicker="Production — Assets" title="Adding an asset" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Go to Production → Assets, pick a Project, then click + New asset.">
              Opens a dialog.
            </Step>
            <Step n={2} title="Fill in Name and Category (Character, Prop, Environment, Vehicle, Rig, Effect, or Other), then click Create.">
              Production Assets are tracked separately from IT and Administrative assets, since they follow a
              creative build pipeline instead of a physical inventory one. Its own detail page works the same way
              as a shot's — Tasks, Versions, and an <span className="font-medium text-foreground">⋯</span> menu for
              Edit/Delete.
            </Step>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={ListChecks} kicker="Production — Tasks" title="Tasks, the board, and dependencies" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="From a shot or asset's own page, click + Task.">
              Fill in Name, a Task type (Modeling, Rigging, Layout, Animation, FX, Lighting, Compositing — the list
              is configurable per company), and an optional Assignee, then click{" "}
              <span className="font-medium text-foreground">Create</span>.
            </Step>
            <Step n={2} title="Change its status from the dropdown right on the row, or open its ⋯ menu to Edit the name/assignee or Delete it.">
              Statuses run Not Started → Ready → In Progress → Pending Review → Changes Requested/Approved →
              Completed, plus On Hold.
            </Step>
            <Step n={3} title="On the Task Board (Production → Tasks), drag a card between columns to change its status.">
              A small trash icon on each card deletes it directly, with a confirmation. A Finish-to-Start
              dependency actually blocks a card from moving into an active status until its predecessor task is
              Completed or Approved — dragging it too early shows an error toast instead of moving it.
            </Step>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Calculator} kicker="Production — Rate Cards" title="Setting up how work gets priced" />
            <CardDescription>Production → Settings → Rate Cards and → Production Units — configure these before anyone can price or submit work.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium text-foreground">Production Units</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The thing work actually gets counted in — Second, Frame, Shot, Background, Rig, Character, and
                about fifteen others come pre-loaded; add a custom one (e.g. "Per Facial Shot") from{" "}
                <span className="font-medium text-foreground">+ Unit</span> anytime.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Rate Cards</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A rate card says "this Task type, priced per this Unit, costs this much" — scoped as narrowly or as
                broadly as needed. Click <span className="font-medium text-foreground">+ Rate card</span>, pick a
                Task type and Unit, optionally narrow it to a Department, Project, or Position, set a Currency and
                Rate, and Create. When several cards could apply to the same task, the most specific one wins, in
                this order:
              </p>
              <ol className="mt-2 space-y-1 pl-4 text-sm text-muted-foreground" style={{ listStyleType: "decimal" }}>
                <li>A rate set for that one specific employee</li>
                <li>A rate set for that specific project</li>
                <li>A rate set for that position (e.g. Senior Animator)</li>
                <li>A rate set for that department</li>
                <li>The company-wide default for that task type + unit</li>
              </ol>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">A rate is never overwritten</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Rates change over time, but past work always keeps the price it was actually approved at.{" "}
                <span className="font-medium text-foreground">Deactivate</span> retires a card without deleting its
                history; <span className="font-medium text-foreground">New version</span> is how a rate actually
                changes — it closes out the old card's effective date and starts a new one, so anything already
                priced or paid under the old rate is completely unaffected.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Banknote} kicker="Production — Approved Work" title="Pricing a task and submitting it for payment" />
            <CardDescription>Lives right inside a task's own Edit dialog, on a shot or asset's page — there's no separate pricing screen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Step n={1} title="Open a task's Edit dialog and scroll to the Pricing section.">
                Pick its Unit. For Second or Frame, Quantity fills in automatically from the shot's own frame range
                (e.g. frames 1001–1240 at 24fps becomes 10 seconds) — every other unit needs the quantity typed in.
              </Step>
              <Step n={2} title="Click Save & calculate.">
                This resolves the applicable rate card and shows the resulting Amount right there. Changing a
                quantity that was already saved requires typing a short reason — that override is kept on record
                even after the number changes again later.
              </Step>
              <Step n={3} title="Click Submit for approval.">
                Available to the artist assigned to the task (or anyone who can manage tasks) once a quantity and
                amount exist. This snapshots the rate, unit, currency, and amount exactly as they are right now —
                nothing about this specific submission changes again even if the rate card it used gets a new
                version later.
              </Step>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Deciding submitted work</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Production → Approved Work lists everything waiting on a decision from the signed-in person (this
                only shows items configured to route through them — approval levels are configurable per company,
                not fixed to one specific role). <span className="font-medium text-foreground">Approve</span> can
                approve less than what was requested — a partial approval — with both the requested and approved
                amounts kept on record. <span className="font-medium text-foreground">Reject</span> and{" "}
                <span className="font-medium text-foreground">Changes</span> both send it back to the artist with
                comments, and neither creates anything payable. Nobody can approve their own submitted work.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Getting paid</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A fully approved item becomes <span className="font-medium text-foreground">Payable</span>, visible
                to the artist under <span className="font-medium text-foreground">Production → My Earnings</span> —
                a running total of what's pending decision, approved but not yet paid, and already paid.
                Approval never pays anyone automatically: Finance explicitly selects Payable items on{" "}
                <span className="font-medium text-foreground">Finance → Production Earnings</span> and sends them
                to Finance, then pulls them into a specific employee's line on a payroll run from that run's own{" "}
                <span className="font-medium text-foreground">+ Production earnings</span> action — only then does
                it move to Paid once that run is actually paid out.
              </p>
            </div>
            <Callout>
              Artists never see other artists' rate cards — only their own resulting earnings. Payment details on
              an earning stay visible to Finance and whoever's allowed to approve that level, not to the whole
              company.
            </Callout>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={GitBranch} kicker="Production — Reviews" title="Submitting a version and reviewing it frame-by-frame" />
            <CardDescription>Works like a dedicated frame-accurate media review tool, right inside the shot or asset page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <Step n={1} title="On a shot or asset's page, click + Submit version.">
                Fill in an optional Name and Notes, then attach the actual video or image file under Media, and
                click <span className="font-medium text-foreground">Submit</span>.
              </Step>
              <Step n={2} title="Click the version to expand it, then scrub frame-by-frame.">
                Play/pause, step one frame at a time, or drag the scrubber — the frame counter reflects the shot's
                own frame numbering (e.g. 1001 / 1051), not just the raw file.
              </Step>
              <Step n={3} title="Click Draw to mark up the current frame.">
                Pick a pen color, draw directly on the paused frame, write a comment below it, then click{" "}
                <span className="font-medium text-foreground">Save</span>. The drawing and comment are saved
                together, pinned to that exact frame number, and listed under Frame Notes — click any note there
                to jump playback back to that frame and redraw the markup on top of it.
              </Step>
              <Step n={4} title="Request a review: pick a person from Request review from…, then click Request.">
                They'll see <span className="font-medium text-foreground">Approve</span> and{" "}
                <span className="font-medium text-foreground">Request changes</span> buttons on that review —
                deciding it automatically updates the version's and the shot's own status.
              </Step>
            </div>
            <p className="text-sm text-muted-foreground">
              A trash icon next to each version's status removes it (with confirmation) — useful for a version
              submitted by mistake.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={SendToBack} kicker="Production" title="Schedule, Reviews queue, Deliverables & Resources" />
            <CardDescription>Company-wide views across every project, reached from the sidebar rather than one project's own tabs.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <Item title="Schedule">
                Every milestone across every active project in one table, with its Status editable inline and a{" "}
                <span className="font-medium text-foreground">⋯</span> menu to delete it (editing details stays on
                the project's own Milestones tab).
              </Item>
              <Item title="Reviews">
                Every version still awaiting a decision, company-wide — click{" "}
                <span className="font-medium text-foreground">Open shot</span>/<span className="font-medium text-foreground">Open asset</span> to
                jump straight to it and decide.
              </Item>
              <Item title="Deliverables">
                Every deliverable across every project, with Status editable inline and a{" "}
                <span className="font-medium text-foreground">⋯</span> menu for Edit/Delete right there.
              </Item>
              <Item title="Resources">
                <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /></span> Read-only
                team workload — open task counts and estimated hours per person — cross-referenced against real HR
                leave and attendance to show who's actually available today.
              </Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Clapperboard} kicker="Production" title="The Client Portal" />
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A client contact signs in at a separate portal address with their own account — this is never the
              same login path or permission model staff use, so a client can never see HR, Finance, IT, or Admin
              data, or any internal note. They see only the projects, shots, versions, and deliverables a producer
              has explicitly marked visible, and can approve or request changes on their own review.
            </p>
            <Step n={1} title="Go to Production → Settings → Client Access, then click + Link client account.">
              The client must already have a Mindburst account of their own (they sign up the normal way first).
            </Step>
            <Step n={2} title="Fill in the Customer ID it belongs to, plus the contact's Name and Email, then click Link.">
              Toggle a linked contact's access on or off anytime from the switch on their row.
            </Step>
            <p className="text-sm text-muted-foreground">
              Then turn on <span className="font-medium text-foreground">Client portal access</span> on the
              project itself, and mark specific shots/versions{" "}
              <span className="font-medium text-foreground">Visible to client portal</span> — nothing reaches the
              client until both are done.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* AI */}
      {/* ================================================================ */}
      <div id="ai" className="scroll-mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI</h2>
          <p className="text-sm text-muted-foreground">
            A company-wide assistant and analytics layer that reads across every other module — never the other
            way around; nothing else in the app depends on AI being on.
          </p>
        </div>

        <Card>
          <CardHeader>
            <SectionHeader icon={MessageCircle} kicker="AI — Assistant" title="Asking the assistant a question" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Step n={1} title="Go to AI → Assistant, then click + New chat (or continue an existing one from the sidebar list).">
              Conversations are private to the person having them and can be renamed or deleted from their own{" "}
              <span className="font-medium text-foreground">⋯</span> menu.
            </Step>
            <Step n={2} title="Type a question in plain language and send it.">
              Things like "how many open critical tickets do we have" or "what's our AP aging look like" — the
              assistant only ever answers using the same live company data and the same permissions the person
              asking already has; it can't see or say anything they couldn't already look up themselves.
            </Step>
            <Step n={3} title="Click Sources under a reply to see exactly what it looked up.">
              Every answer that pulled real data shows precisely which internal query ran and what it returned —
              nothing is left unverifiable.
            </Step>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={TrendingUp} kicker="AI — Company Analytics" title="Health, alerts & forecasts" />
            <CardDescription>AI → Dashboard — the same overall status and per-department health shown on the company dashboard's banner, with more depth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              <Item title="Module health">A colored status (green/yellow/red) computed for IT, HR, Finance, Admin, and Production from real thresholds — e.g. Finance turns red when monthly expenses exceed revenue, IT turns red at 20+ open tickets.</Item>
              <Item title="Alerts">
                <span className="font-medium text-foreground">Scan now</span> checks every module against its rules
                and opens an alert for anything that crosses a threshold. Each alert can be{" "}
                <span className="font-medium text-foreground">Acknowledged</span> (seen, being worked) or{" "}
                <span className="font-medium text-foreground">Resolved</span> (done).
              </Item>
              <Item title="Forecasts">A simple statistical trend line (not a language model) for one key metric per module, built from up to 30 days of captured snapshots — confidence is labeled honestly (None/Low/Medium/High) based on how much history actually exists yet.</Item>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader icon={Settings2} kicker="AI — Settings" title="Turning AI on & controlling its limits" />
            <CardDescription>Settings → AI — restricted to whoever holds AI admin settings, separate from using the assistant itself.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              <Item title="Enable / disable">A single switch for the whole company. Off means the Assistant and Company Analytics pages simply don't appear for anyone.</Item>
              <Item title="Data retention">How long conversation history is kept before automatic deletion — 30 days, 90 days, 1 year, or never.</Item>
              <Item title="Usage limits">A monthly token limit and request limit, with a usage table showing consumption per day for the last 30 days.</Item>
            </ul>
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
