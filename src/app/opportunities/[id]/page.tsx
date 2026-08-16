import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOpportunityDetail } from "@/lib/queries/marketplace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataSourceBadge } from "@/components/data-source-badge";
import { InvestForm } from "@/components/invest-form";
import { SpendRevenueChart } from "@/components/charts/spend-revenue-chart";
import { formatCurrency, formatDate, formatMultiple, formatPercent } from "@/lib/utils";

const CHANNEL_LABELS: Record<string, string> = { TIKTOK: "TikTok", META: "Meta", GOOGLE_ADS: "Google Ads" };

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getOpportunityDetail(id);
  if (!result) notFound();
  const { opportunity, campaigns, stats, dailySeries } = result;
  const session = await auth();

  const isMock = campaigns.length === 0 || campaigns.some((c) => c.isMock);
  const channels = Array.from(new Set(campaigns.map((c) => CHANNEL_LABELS[c.provider] ?? c.provider)));
  const channelsLabel = channels.length > 0 ? channels.join(", ") : "no connected channels yet";

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{opportunity.app.category}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{opportunity.title}</h1>
          <p className="mt-2 text-slate-600">
            {opportunity.app.name} · by {opportunity.app.developer.displayName}
          </p>
        </div>
        {opportunity.riskAssessment && (
          <Badge variant="outline" className="text-base">
            Risk {opportunity.riskAssessment.grade} ({opportunity.riskAssessment.score}/100)
          </Badge>
        )}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="flex flex-col gap-10 lg:col-span-2">
          {/* Overview */}
          <Section title="Overview">
            <p className="text-slate-600">{opportunity.description}</p>
          </Section>

          {/* Historical performance */}
          <Section title="Historical performance">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricTile label="Ad spend" value={formatCurrency(stats.totalSpend)} source={channelsLabel} isMock={isMock} />
              <MetricTile label="Attributed revenue" value={formatCurrency(stats.totalAttributedRevenue)} source="RevenueCat" isMock={isMock} />
              <MetricTile label="Installs" value={stats.totalInstalls.toLocaleString()} source="AppsFlyer" isMock={isMock} />
              <MetricTile label="Paying customers" value={stats.payingCustomers.toLocaleString()} source="RevenueCat" isMock={isMock} />
            </div>
            {dailySeries.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base">Revenue vs. ad spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <SpendRevenueChart data={dailySeries} />
                </CardContent>
              </Card>
            )}
          </Section>

          {/* Marketing strategy */}
          <Section title="Marketing strategy">
            <p className="text-slate-600">
              These terms back all of {opportunity.app.name}&apos;s marketing campaigns — currently {channelsLabel}.
              Spend, impressions, clicks, and conversions for every connected campaign are imported daily and rolled
              up above; a new channel the developer connects later is automatically covered by the same terms.
            </p>
          </Section>

          {/* Revenue model */}
          <Section title="Revenue model">
            <p className="text-slate-600">
              {opportunity.app.name} monetizes via {opportunity.app.pricingModel ?? "subscription"}
              {opportunity.app.subscriptionPrice ? ` at ${formatCurrency(opportunity.app.subscriptionPrice)}/mo` : ""}.
              Revenue from users attributed to any of its campaigns is split {formatPercent(opportunity.investorRevenueSharePercent)}{" "}
              to investors / {formatPercent(opportunity.developerRevenueSharePercent)} to the developer, up to the
              return cap below.
            </p>
          </Section>

          {/* Live campaign data */}
          {campaigns.length > 0 && (
            <Section title="Live campaign data">
              <div className="flex flex-col gap-2">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium text-slate-900">{c.name}</span>
                      <span className="ml-2 text-slate-500">{CHANNEL_LABELS[c.provider] ?? c.provider}</span>
                    </div>
                    <span className="text-slate-500">
                      Daily budget {formatCurrency(c.dailyBudget)} · {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Risk */}
          {opportunity.riskAssessment && (
            <Section title="Risk">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-emerald-700">Positive</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {(opportunity.riskAssessment.positives as string[]).map((p) => (
                      <li key={p}>+ {p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-red-700">Negative</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {(opportunity.riskAssessment.negatives as string[]).map((n) => (
                      <li key={n}>- {n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          )}

          {/* Data sources */}
          <Section title="Data sources">
            <div className="flex flex-wrap gap-2">
              {channels.map((channel) => (
                <DataSourceBadge key={channel} provider={channel} isMock={isMock} />
              ))}
              <DataSourceBadge provider="AppsFlyer" isMock={isMock} />
              <DataSourceBadge provider="RevenueCat" isMock={isMock} />
            </div>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <p className="text-sm text-slate-500">
                {formatCurrency(opportunity.amountFunded)} invested under these terms so far. Funding is ongoing —
                your investment starts earning as soon as it&apos;s made, not once any threshold is reached.
              </p>

              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <Term label="Investor revenue share" value={formatPercent(opportunity.investorRevenueSharePercent)} />
                <Term label="Return cap" value={formatMultiple(opportunity.returnCapMultiple)} />
                <Term label="Minimum investment" value={formatCurrency(opportunity.minimumInvestment)} />
                <Term label="Terms open since" value={opportunity.startDate ? formatDate(opportunity.startDate) : formatDate(opportunity.createdAt)} />
                <Term label="Historical ROAS" value={opportunity.historicalROAS ? formatMultiple(opportunity.historicalROAS) : "—"} />
                <Term label="Historical CAC" value={opportunity.historicalCAC ? formatCurrency(opportunity.historicalCAC) : "—"} />
              </dl>

              {session?.user?.role === "INVESTOR" ? (
                <InvestForm
                  opportunityId={opportunity.id}
                  minimumInvestment={Number(opportunity.minimumInvestment)}
                  historicalROAS={opportunity.historicalROAS ? Number(opportunity.historicalROAS) : null}
                  investorRevenueSharePercent={Number(opportunity.investorRevenueSharePercent)}
                  returnCapMultiple={Number(opportunity.returnCapMultiple)}
                />
              ) : (
                <Link href={session?.user ? "#" : "/login?callbackUrl=/opportunities/" + opportunity.id}>
                  <button className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                    {session?.user ? "Investor accounts only" : "Log in to invest"}
                  </button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Developer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              <p className="font-medium text-slate-900">{opportunity.app.developer.displayName}</p>
              {opportunity.app.developer.bio && <p className="mt-1">{opportunity.app.developer.bio}</p>}
              <p className="mt-2 text-xs text-slate-400">
                Developer since {formatDate(opportunity.app.developer.createdAt)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MetricTile({ label, value, source, isMock }: { label: string; value: string; source: string; isMock: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      <div className="mt-2">
        <DataSourceBadge provider={source} isMock={isMock} />
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
