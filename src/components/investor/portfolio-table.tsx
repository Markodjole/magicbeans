import Link from "next/link";
import { InvestmentStatusBadge } from "@/components/investor/status-badge";
import { formatCurrency, formatMultiple } from "@/lib/utils";
import type { getInvestorPortfolio } from "@/lib/queries/investor";

type PortfolioInvestment = Awaited<ReturnType<typeof getInvestorPortfolio>>["investments"][number];

export function PortfolioTable({ investments }: { investments: PortfolioInvestment[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">App</th>
            <th className="px-4 py-3 font-medium">Principal</th>
            <th className="px-4 py-3 font-medium">Capital deployed</th>
            <th className="px-4 py-3 font-medium">Revenue generated</th>
            <th className="px-4 py-3 font-medium">Your share</th>
            <th className="px-4 py-3 font-medium">Return multiple</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {investments.map((investment) => (
            <tr key={investment.id} className="transition-colors hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/investor/investments/${investment.id}`} className="font-medium text-slate-900 hover:underline">
                  {investment.opportunity.app.name}
                </Link>
                <p className="text-xs text-slate-500">{investment.opportunity.title}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{formatCurrency(investment.principalAmount)}</td>
              <td className="px-4 py-3 text-slate-700">{formatCurrency(investment.capitalDeployed)}</td>
              <td className="px-4 py-3 text-slate-700">{formatCurrency(investment.attributableRevenue)}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(investment.investorRevenueEarned)}</td>
              <td className="px-4 py-3 text-slate-700">{formatMultiple(investment.currentReturnMultiple)}</td>
              <td className="px-4 py-3">
                <InvestmentStatusBadge status={investment.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
