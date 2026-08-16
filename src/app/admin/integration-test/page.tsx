import { requireRole } from "@/lib/authz";
import { listAppsForIntegrationTest, getIntegrationTestChain } from "@/lib/queries/admin";
import { createTestAppsFlyerInstall, runRevenueCatReconciliation } from "@/lib/actions/admin-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/admin/action-button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Integration test — GrowthFund Admin" };

export default async function IntegrationTestPage({
  searchParams,
}: {
  searchParams: Promise<{ appId?: string; externalUserId?: string }>;
}) {
  await requireRole("ADMIN");
  const { appId, externalUserId } = await searchParams;

  const apps = await listAppsForIntegrationTest();
  const chain = appId && externalUserId ? await getIntegrationTestChain(appId, externalUserId) : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Integration test</h1>
      <p className="mt-2 text-slate-600">
        Trace one user through the real chain: AppsFlyer install → RevenueCat purchase → attributed
        revenue → ledger. Pick an app and a test user id below — use the exact same id you configure
        as the <code>app_user_id</code> in a RevenueCat Test Store purchase.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>1. Choose app + test user</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500" htmlFor="appId">
                App
              </label>
              <select
                id="appId"
                name="appId"
                defaultValue={appId ?? ""}
                className="h-9 min-w-[220px] rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="" disabled>
                  Select an app…
                </option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.category})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500" htmlFor="externalUserId">
                Test externalUserId
              </label>
              <input
                id="externalUserId"
                name="externalUserId"
                defaultValue={externalUserId ?? ""}
                placeholder="e.g. test-user-0001"
                className="h-9 min-w-[220px] rounded-md border border-slate-300 bg-white px-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
            >
              Load chain
            </button>
          </form>
        </CardContent>
      </Card>

      {appId && externalUserId && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>2. Bridge + sync actions</CardTitle>
            <CardDescription>
              Step A creates the AppsFlyer side (a real device SDK session can&apos;t be synthesized
              server-side, so this is one clearly-labeled test install, not fabricated AppsFlyer
              traffic). Step B pulls RevenueCat via REST — use this if you made a Test Store purchase
              and don&apos;t want to wait for/re-send the webhook.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <ActionButton
              action={createTestAppsFlyerInstall.bind(null, appId, externalUserId)}
              pendingLabel="Creating…"
            >
              A. Create test AppsFlyer install
            </ActionButton>
            <ActionButton
              action={runRevenueCatReconciliation.bind(null, appId)}
              pendingLabel="Syncing…"
              variant="outline"
            >
              B. Run RevenueCat reconciliation now
            </ActionButton>
          </CardContent>
        </Card>
      )}

      {chain && (
        <div className="mt-6 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>3. AppsFlyer — attribution</CardTitle>
              <CardDescription>{chain.installs.length} install record(s) for this user</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {chain.installs.length === 0 && <EmptyStep label="No install yet — run step A above." />}
              {chain.installs.map((i) => (
                <div key={i.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={i.isMock ? "mock" : "live"}>{i.isMock ? "TEST" : "LIVE"}</Badge>
                    <span className="font-medium text-slate-900">{i.mediaSource}</span>
                    <span className="text-slate-500">→ campaign: {i.campaign?.name ?? "—"}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Installed {formatDateTime(i.installedAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. RevenueCat — customer + purchases</CardTitle>
              <CardDescription>
                {chain.appCustomer ? `AppCustomer found (appUserId: ${chain.appCustomer.appUserId})` : "No AppCustomer yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!chain.appCustomer && (
                <EmptyStep label="No RevenueCat customer/transaction yet — make a Test Store purchase with this app_user_id, then run step B." />
              )}
              {chain.appCustomer?.transactions.length === 0 && (
                <EmptyStep label="Customer exists but has no transactions yet." />
              )}
              {chain.appCustomer?.transactions.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={t.isMock ? "mock" : "live"}>{t.isMock ? "MOCK" : "LIVE"}</Badge>
                    <span className="font-medium text-slate-900">{formatCurrency(t.amount, t.currency)}</span>
                    <span className="text-slate-500">{t.productId}</span>
                    <span className="text-slate-400 text-xs">txn {t.transactionId}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Purchased {formatDateTime(t.purchasedAt)}</p>

                  {t.revenueAttributions.length === 0 ? (
                    <p className="mt-2 text-xs text-amber-600">Not attributed yet — run step B, or wait for the next sync.</p>
                  ) : (
                    t.revenueAttributions.map((a) => (
                      <div key={a.id} className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
                        <Badge variant={a.confidence === "HIGH" ? "success" : a.confidence === "UNATTRIBUTED" ? "destructive" : "warning"}>
                          {a.confidence}
                        </Badge>
                        <span className="text-slate-600">{formatCurrency(a.attributedAmount)} attributed</span>
                        <span className="text-xs text-slate-400">via {a.attributionMethod}</span>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Ledger entries from this chain</CardTitle>
              <CardDescription>{chain.ledgerEntries.length} entr{chain.ledgerEntries.length === 1 ? "y" : "ies"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {chain.ledgerEntries.length === 0 && <EmptyStep label="No ledger entries yet." />}
              {chain.ledgerEntries.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{l.type.replaceAll("_", " ")}</Badge>
                    <span className="text-slate-600">{l.description}</span>
                  </div>
                  <span className="font-medium text-slate-900">{formatCurrency(l.amount, l.currency)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function EmptyStep({ label }: { label: string }) {
  return <p className="text-sm text-slate-400">{label}</p>;
}
