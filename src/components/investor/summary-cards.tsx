import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function SummaryCards({
  totals,
}: {
  totals: {
    totalInvested: number;
    capitalDeployed: number;
    attributableRevenue: number;
    investorRevenueEarned: number;
    amountPaidToInvestor: number;
    active: number;
    completed: number;
  };
}) {
  const tiles: { label: string; value: string }[] = [
    { label: "Total invested", value: formatCurrency(totals.totalInvested) },
    { label: "Capital deployed", value: formatCurrency(totals.capitalDeployed) },
    { label: "Current attributable revenue", value: formatCurrency(totals.attributableRevenue) },
    { label: "Revenue share earned", value: formatCurrency(totals.investorRevenueEarned) },
    { label: "Paid out", value: formatCurrency(totals.amountPaidToInvestor) },
    { label: "Active investments", value: String(totals.active) },
    { label: "Completed investments", value: String(totals.completed) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{tile.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{tile.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
