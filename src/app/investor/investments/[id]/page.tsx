import { notFound } from "next/navigation";
import Link from "next/link";
import { requireInvestorProfile } from "@/lib/authz";
import { getInvestmentDetail } from "@/lib/queries/investor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvestmentStatusBadge } from "@/components/investor/status-badge";
import { InvestmentFunnel } from "@/components/investor/investment-funnel";
import { formatCurrency, formatDateTime, formatMultiple, formatPercent } from "@/lib/utils";

export default async function InvestmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireInvestorProfile();

  const result = await getInvestmentDetail(id);
  if (!result || result.investment.investorId !== profile.id) notFound();
  const { investment, funnel } = result;

  const principal = Number(investment.principalAmount);
  const deployed = Number(investment.capitalDeployed);
  const remaining = Math.max(0, principal - deployed);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
            {investment.opportunity.app.category}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            {investment.opportunity.app.name}
          </h1>
          <p className="mt-2 text-slate-600">{investment.opportunity.title}</p>
        </div>
        <InvestmentStatusBadge status={investment.status} />
      </div>

      {/* Funnel */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Provable money flow</h2>
        <p className="mt-1 text-sm text-slate-600">
          Exactly how your capital moved from investment to attributed revenue and back to you.
        </p>
        <div className="mt-4">
          <InvestmentFunnel investment={investment} funnel={funnel} />
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capital</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Capital committed" value={formatCurrency(principal)} />
            <Row label="Capital deployed" value={formatCurrency(deployed)} />
            <Row label="Remaining" value={formatCurrency(remaining)} />
            <p className="mt-1 text-xs text-slate-400">Invested {formatDateTime(investment.createdAt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Return</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Current return multiple" value={formatMultiple(investment.currentReturnMultiple)} />
            <Row label="Return cap" value={formatMultiple(investment.opportunity.returnCapMultiple)} />
            <Row label="Investor revenue share" value={formatPercent(investment.opportunity.investorRevenueSharePercent)} />
            <Row label="Paid out to date" value={formatCurrency(investment.amountPaidToInvestor)} />
            <p className="mt-1 text-xs text-slate-400">Last updated {formatDateTime(investment.updatedAt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marketing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Developer" value={investment.opportunity.app.developer.displayName} />
            <Row
              label="Channels"
              value={
                investment.opportunity.app.campaigns.length > 0
                  ? Array.from(new Set(investment.opportunity.app.campaigns.map((c) => c.provider))).join(", ")
                  : "None connected yet"
              }
            />
            <Row label="Campaigns" value={String(investment.opportunity.app.campaigns.length)} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-10">
        <Link href={`/investor/investments/${investment.id}/audit`}>
          <Button variant="outline">View full audit trail</Button>
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
