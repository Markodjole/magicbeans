import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireDeveloperProfile } from "@/lib/authz";
import { getAppPerformanceSummary, getAppObligations } from "@/lib/queries/developer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataSourceBadge } from "@/components/data-source-badge";
import { ConnectionStatusBadge } from "@/components/developer/connection-status-badge";
import { DemoDataButton } from "@/components/developer/demo-data-button";
import { FundingTermsForm } from "@/components/developer/funding-terms-form";
import { PROVIDER_LABELS } from "@/components/developer/provider-labels";
import { formatCurrency, formatMultiple, formatPercent } from "@/lib/utils";
import type { IntegrationConnection } from "@/generated/prisma/client";

const ADVERTISING_CHANNELS = ["TIKTOK", "META", "GOOGLE_ADS"] as const;

export default async function DeveloperAppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireDeveloperProfile();

  // Ownership check: this app must belong to the signed-in developer, or 404.
  const app = await prisma.app.findFirst({
    where: { id, developerId: profile.id },
    include: { integrationConnections: true },
  });
  if (!app) notFound();

  const hasOpenTerms = await prisma.investmentOpportunity.findFirst({ where: { appId: id, status: "OPEN" } });

  const [performance, obligations] = await Promise.all([getAppPerformanceSummary(id, 30), getAppObligations(id)]);

  const revenueConnection = app.integrationConnections.find((c) => c.category === "REVENUE");
  const attributionConnection = app.integrationConnections.find((c) => c.category === "ATTRIBUTION");
  const advertisingConnections = app.integrationConnections.filter((c) => c.category === "ADVERTISING");

  const advertisingIsMock = advertisingConnections.length === 0 || !advertisingConnections.every((c) => c.mode === "LIVE");
  const revenueIsMock = !revenueConnection || revenueConnection.mode !== "LIVE";

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/developer" className="text-sm font-medium text-slate-600 hover:text-slate-900">
        ← Back to your apps
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{app.category}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{app.name}</h1>
          {app.description && <p className="mt-2 max-w-2xl text-slate-600">{app.description}</p>}
        </div>
        <Badge variant={app.approved ? "success" : "warning"}>{app.approved ? "Approved" : "Pending approval"}</Badge>
      </div>

      <div className="mt-10 flex flex-col gap-10">
        {/* Connect revenue source */}
        <Section title="Connect revenue source" connection={revenueConnection}>
          <div className="flex flex-wrap gap-3">
            <DisabledConnect label="Connect RevenueCat" />
            <DisabledConnect label="Connect Apple" />
            <DisabledConnect label="Connect Google Play" />
            <DemoDataButton appId={app.id} category="REVENUE" provider="REVENUECAT" />
          </div>
        </Section>

        {/* Connect attribution */}
        <Section title="Connect attribution" connection={attributionConnection}>
          <div className="flex flex-wrap gap-3">
            <DisabledConnect label="Connect AppsFlyer" />
            <DisabledConnect label="Connect Adjust" />
            <DemoDataButton appId={app.id} category="ATTRIBUTION" provider="APPSFLYER" />
          </div>
        </Section>

        {/* Connect advertising */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Connect advertising</h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect one or more ad channels. Each channel gets its own demo campaign — your standing funding terms
            below automatically cover all of them.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {ADVERTISING_CHANNELS.map((provider) => {
              const connection = advertisingConnections.find((c) => c.provider === provider);
              return (
                <div key={provider} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-4">
                  <span className="w-32 text-sm font-medium text-slate-900">{PROVIDER_LABELS[provider]}</span>
                  <DisabledConnect label={`Connect ${PROVIDER_LABELS[provider]}`} />
                  <DemoDataButton appId={app.id} category="ADVERTISING" provider={provider} />
                  {connection && <ConnectionStatusBadge mode={connection.mode} />}
                </div>
              );
            })}
          </div>
        </section>

        {/* Historical performance */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Historical performance (last 30 days)</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <MetricTile
              label="Ad spend"
              value={formatCurrency(performance.spend)}
              source={advertisingConnections[0] ? PROVIDER_LABELS[advertisingConnections[0].provider] : "Advertising"}
              isMock={advertisingIsMock}
            />
            <MetricTile
              label="Revenue"
              value={formatCurrency(performance.revenue)}
              source={revenueConnection ? PROVIDER_LABELS[revenueConnection.provider] : "RevenueCat"}
              isMock={revenueIsMock}
            />
            <MetricTile
              label="Installs"
              value={performance.installs.toLocaleString()}
              source={advertisingConnections[0] ? PROVIDER_LABELS[advertisingConnections[0].provider] : "Advertising"}
              isMock={advertisingIsMock}
            />
            <MetricTile
              label="Paying users"
              value={performance.payingUsers.toLocaleString()}
              source={revenueConnection ? PROVIDER_LABELS[revenueConnection.provider] : "RevenueCat"}
              isMock={revenueIsMock}
            />
            <MetricTile label="CAC" value={formatCurrency(performance.cac)} source="Advertising" isMock={advertisingIsMock} />
            <MetricTile label="ROAS" value={formatMultiple(performance.roas)} source="Combined" isMock={advertisingIsMock || revenueIsMock} />
          </div>
        </section>

        {/* Funding terms */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">
            {hasOpenTerms ? "Change your funding terms" : "Set your funding terms"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            One standing revenue-share offer for this app — it covers whatever marketing campaigns you run, on any
            channel, starting the moment an investor contributes. No funding target, no threshold.
          </p>
          <Card className="mt-3">
            <CardContent className="pt-6">
              <FundingTermsForm appId={app.id} hasOpenTerms={Boolean(hasOpenTerms)} />
            </CardContent>
          </Card>
        </section>

        {/* Terms history */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Funding terms history</h2>
          {obligations.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No funding terms set yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {obligations.map(({ opportunity, developerShareEarned, investorShareOwed }) => (
                <Card key={opportunity.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle>{opportunity.title}</CardTitle>
                      <Badge variant="outline">{opportunity.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <p className="text-xs text-slate-500">{formatCurrency(opportunity.amountFunded)} invested under these terms</p>
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <Term label="Investor share" value={formatPercent(opportunity.investorRevenueSharePercent)} />
                      <Term label="Return cap" value={formatMultiple(opportunity.returnCapMultiple)} />
                      <Term label="Developer earned" value={formatCurrency(developerShareEarned)} />
                      <Term label="Investor owed" value={formatCurrency(investorShareOwed)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Section({
  title,
  connection,
  children,
}: {
  title: string;
  connection: IntegrationConnection | undefined;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {connection ? (
          <ConnectionStatusBadge mode={connection.mode} />
        ) : (
          <Badge variant="outline">Not connected</Badge>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DisabledConnect({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" disabled title="Requires API credentials — see INTEGRATIONS.md">
        {label}
      </Button>
      <p className="text-xs text-slate-400">Requires API credentials — see INTEGRATIONS.md</p>
    </div>
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
