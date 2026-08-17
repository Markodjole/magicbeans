import Link from "next/link";
import { requireInvestorProfile } from "@/lib/authz";
import { getInvestorPortfolio, getInvestorPayoutHistory, getMarketerCampaigns } from "@/lib/queries/investor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCards } from "@/components/investor/summary-cards";
import { PortfolioTable } from "@/components/investor/portfolio-table";
import { CumulativePayoutChart } from "@/components/investor/cumulative-payout-chart";
import { MarketerCampaignsTable } from "@/components/investor/marketer-campaigns-table";

export const metadata = { title: "Dashboard — MagicBeans" };

export default async function InvestorDashboardPage() {
  const profile = await requireInvestorProfile();
  const [{ investments, totals }, payoutHistory, marketerCampaigns] = await Promise.all([
    getInvestorPortfolio(profile.id),
    getInvestorPayoutHistory(profile.id),
    getMarketerCampaigns(profile.id),
  ]);

  if (investments.length === 0 && marketerCampaigns.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nothing here yet</h1>
        <p className="mt-3 text-slate-600">
          Fund a standing revenue-share opportunity, or launch a paid-per-result campaign against a performance
          offer — either way, your portfolio, funnels, and audit trail will show up here.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/opportunities">
            <Button size="lg">Browse opportunities</Button>
          </Link>
          <Link href="/offers">
            <Button size="lg" variant="outline">Browse performance offers</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your dashboard</h1>
      <p className="mt-2 text-slate-600">
        Every number below traces back to a ledger entry — open an investment or campaign for the full audit trail.
      </p>

      {investments.length > 0 && (
        <>
          <div className="mt-8">
            <SummaryCards totals={totals} />
          </div>

          {payoutHistory.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-base">Cumulative payouts over time</CardTitle>
              </CardHeader>
              <CardContent>
                <CumulativePayoutChart data={payoutHistory} />
              </CardContent>
            </Card>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Investments</h2>
            <div className="mt-4">
              <PortfolioTable investments={investments} />
            </div>
          </div>
        </>
      )}

      {marketerCampaigns.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Your marketing campaigns</h2>
          <p className="mt-1 text-sm text-slate-500">
            Paid-per-result campaigns against a developer&apos;s performance offer — you fund the ad spend directly
            with the ad platform; MagicBeans only ever pays you the flat rate per verified subscriber delivered.
          </p>
          <div className="mt-4">
            <MarketerCampaignsTable campaigns={marketerCampaigns} />
          </div>
        </div>
      )}
    </div>
  );
}
