import { requireRole } from "@/lib/authz";
import {
  getPlatformTotals,
  getIntegrationHealth,
  listAllUsers,
  listPendingApprovals,
  getLedgerEntries,
  getRecentSyncJobs,
  listActiveCampaignsForAdmin,
} from "@/lib/queries/admin";
import { approveDeveloper, approveApp, approveOpportunity, pauseCampaign } from "@/lib/actions/admin-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ActionButton } from "@/components/admin/action-button";
import { IntegrationModeControl } from "@/components/admin/integration-mode-control";
import { LedgerFilter } from "@/components/admin/ledger-filter";
import { FlagSuspiciousForm } from "@/components/admin/flag-suspicious-form";
import { formatCurrency, formatDate, formatDateTime, formatMultiple, formatPercent } from "@/lib/utils";
import type { IntegrationMode, SyncJobStatus } from "@/generated/prisma/client";

export const metadata = { title: "Admin — MagicBeans" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireRole("ADMIN");
  const { type } = await searchParams;

  const [totals, integrations, users, pending, ledger, syncJobs, campaigns] = await Promise.all([
    getPlatformTotals(),
    getIntegrationHealth(),
    listAllUsers(),
    listPendingApprovals(),
    getLedgerEntries({ type, limit: 100 }),
    getRecentSyncJobs(),
    listActiveCampaignsForAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Admin</h1>
      <p className="mt-2 text-slate-600">Platform health, approvals, integrations, and the ledger — in one place.</p>

      {/* Platform totals */}
      <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total funding" value={formatCurrency(totals.totalFunding)} />
        <StatCard label="Capital deployed" value={formatCurrency(totals.capitalDeployed)} />
        <StatCard label="Attributed revenue" value={formatCurrency(totals.attributedRevenue)} />
        <StatCard label="Investor payouts" value={formatCurrency(totals.investorPayouts)} />
        <StatCard label="Active opportunities" value={String(totals.activeOpportunities)} />
        <StatCard label="Active campaigns" value={String(totals.activeCampaigns)} />
        <StatCard label="Developers" value={String(totals.developers)} />
        <StatCard label="Investors" value={String(totals.investors)} />
      </section>

      {/* Integration health */}
      <section className="mt-12">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 sm:flex">
            <div>
              <CardTitle>Integration health</CardTitle>
              <CardDescription>Provider connections per app, current mode, and last sync result.</CardDescription>
            </div>
            <a href="/admin/integration-test" className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
              Integration test →
            </a>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">App</th>
                  <th className="py-2 pr-4 font-medium">Provider</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Mode</th>
                  <th className="py-2 pr-4 font-medium">Last sync</th>
                  <th className="py-2 pr-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-900">{c.appName}</td>
                    <td className="py-3 pr-4 text-slate-600">{c.provider}</td>
                    <td className="py-3 pr-4 text-slate-600">{c.category}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={modeBadgeVariant(c.mode)}>{c.mode}</Badge>
                      {c.lastError && <p className="mt-1 max-w-xs text-xs text-red-600">{c.lastError}</p>}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {c.lastSync ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant={syncStatusBadgeVariant(c.lastSync.status)}>{c.lastSync.status}</Badge>
                          <span className="text-xs">{formatDateTime(c.lastSync.createdAt)}</span>
                          <span className="text-xs">{c.lastSync.recordsImported} records</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">never</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <IntegrationModeControl connectionId={c.id} appId={c.appId} currentMode={c.mode} />
                    </td>
                  </tr>
                ))}
                {integrations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No integration connections yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Pending approvals */}
      <section className="mt-12 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Unapproved developers</CardTitle>
            <CardDescription>{pending.developers.length} awaiting review</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pending.developers.length === 0 && <p className="text-sm text-slate-400">None pending.</p>}
            {pending.developers.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{d.displayName}</p>
                  <p className="text-xs text-slate-500">{d.user.email}</p>
                </div>
                <ActionButton action={approveDeveloper.bind(null, d.id)} pendingLabel="Approving…" size="sm">
                  Approve
                </ActionButton>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unapproved apps</CardTitle>
            <CardDescription>{pending.apps.length} awaiting review</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pending.apps.length === 0 && <p className="text-sm text-slate-400">None pending.</p>}
            {pending.apps.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-500">by {a.developer.displayName}</p>
                </div>
                <ActionButton action={approveApp.bind(null, a.id)} pendingLabel="Approving…" size="sm">
                  Approve
                </ActionButton>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunities awaiting approval</CardTitle>
            <CardDescription>{pending.opportunities.length} awaiting review</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pending.opportunities.length === 0 && <p className="text-sm text-slate-400">None pending.</p>}
            {pending.opportunities.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{o.title}</p>
                  <p className="text-xs text-slate-500">
                    {o.app.name} · {formatPercent(o.investorRevenueSharePercent)} investor share · {formatMultiple(o.returnCapMultiple)} cap
                  </p>
                </div>
                <ActionButton action={approveOpportunity.bind(null, o.id)} pendingLabel="Approving…" size="sm">
                  Approve
                </ActionButton>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Active campaigns / pause control */}
      <section className="mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Active campaigns</CardTitle>
            <CardDescription>Pause a campaign to stop further ad spend and capital deployment.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">App</th>
                  <th className="py-2 pr-4 font-medium">Campaign</th>
                  <th className="py-2 pr-4 font-medium">Provider</th>
                  <th className="py-2 pr-4 font-medium">Daily budget</th>
                  <th className="py-2 pr-4 font-medium">Started</th>
                  <th className="py-2 pr-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-900">{c.app.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{c.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{c.provider}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatCurrency(c.dailyBudget)}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatDate(c.startDate)}</td>
                    <td className="py-3 pr-4">
                      <ActionButton
                        action={pauseCampaign.bind(null, c.id)}
                        pendingLabel="Pausing…"
                        size="sm"
                        variant="destructive"
                        confirmMessage={`Pause campaign "${c.name}"? This stops further spend and capital deployment.`}
                      >
                        Pause
                      </ActionButton>
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No active campaigns.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Users */}
      <section className="mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>{users.length} accounts</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Profile status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-900">{u.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{u.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{u.role}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {u.developerProfile && (
                        <Badge variant={u.developerProfile.approved ? "success" : "warning"}>
                          Developer · {u.developerProfile.approved ? "approved" : "pending"}
                        </Badge>
                      )}
                      {u.investorProfile && (
                        <Badge variant={u.investorProfile.approved ? "success" : "warning"}>
                          Investor · {u.investorProfile.approved ? "approved" : "pending"}
                        </Badge>
                      )}
                      {!u.developerProfile && !u.investorProfile && <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Ledger */}
      <section id="ledger" className="mt-12 scroll-mt-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 sm:flex">
            <div>
              <CardTitle>Ledger</CardTitle>
              <CardDescription>Most recent 100 entries{type ? ` · filtered to ${type.replaceAll("_", " ")}` : ""}</CardDescription>
            </div>
            <LedgerFilter current={type} />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => {
                  const amountNum = Number(l.amount);
                  return (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4 text-slate-600">{formatDateTime(l.createdAt)}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">{l.type.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className={`py-3 pr-4 font-medium ${amountNum < 0 ? "text-red-600" : "text-slate-900"}`}>
                        {formatCurrency(l.amount, l.currency)}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{l.description}</td>
                    </tr>
                  );
                })}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No ledger entries for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Recent sync jobs */}
      <section className="mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Recent sync jobs</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">App</th>
                  <th className="py-2 pr-4 font-medium">Job type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Records</th>
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {syncJobs.map((j) => (
                  <tr key={j.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-900">{j.integrationConnection.app.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{j.jobType}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={syncStatusBadgeVariant(j.status)}>{j.status}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{j.recordsImported}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatDateTime(j.createdAt)}</td>
                    <td className="py-3 pr-4 max-w-xs truncate text-xs text-red-600">{j.error ?? ""}</td>
                  </tr>
                ))}
                {syncJobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No sync jobs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* Flag suspicious activity */}
      <section className="mt-12 mb-16">
        <Card>
          <CardHeader>
            <CardTitle>Flag suspicious activity</CardTitle>
            <CardDescription>Logs a review flag to the audit trail against any entity.</CardDescription>
          </CardHeader>
          <CardContent>
            <FlagSuspiciousForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function modeBadgeVariant(mode: IntegrationMode): BadgeProps["variant"] {
  switch (mode) {
    case "LIVE":
      return "live";
    case "MOCK":
      return "mock";
    case "ERROR":
      return "destructive";
    case "DISCONNECTED":
      return "outline";
  }
}

function syncStatusBadgeVariant(status: SyncJobStatus): BadgeProps["variant"] {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "destructive";
    case "RUNNING":
      return "warning";
    case "PENDING":
      return "outline";
  }
}
