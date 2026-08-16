import Link from "next/link";
import { requireInvestorProfile } from "@/lib/authz";
import { getInvestorPortfolio, getInvestorPayoutHistory } from "@/lib/queries/investor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCards } from "@/components/investor/summary-cards";
import { PortfolioTable } from "@/components/investor/portfolio-table";
import { CumulativePayoutChart } from "@/components/investor/cumulative-payout-chart";

export const metadata = { title: "Dashboard — GrowthFund" };

export default async function InvestorDashboardPage() {
  const profile = await requireInvestorProfile();
  const [{ investments, totals }, payoutHistory] = await Promise.all([
    getInvestorPortfolio(profile.id),
    getInvestorPayoutHistory(profile.id),
  ]);

  if (investments.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">No investments yet</h1>
        <p className="mt-3 text-slate-600">
          Once you fund a campaign, your portfolio, funnels, and audit trail will show up here.
        </p>
        <Link href="/opportunities" className="mt-6 inline-block">
          <Button size="lg">Browse opportunities</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your portfolio</h1>
      <p className="mt-2 text-slate-600">
        Every number below traces back to a ledger entry — open an investment for the full audit trail.
      </p>

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
    </div>
  );
}
