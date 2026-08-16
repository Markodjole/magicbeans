import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatMultiple, formatPercent } from "@/lib/utils";
import type { App, InvestmentOpportunity, RiskAssessment } from "@/generated/prisma/client";

type OpportunityCardData = InvestmentOpportunity & {
  app: App;
  riskAssessment: RiskAssessment | null;
};

export function OpportunityCard({ opportunity }: { opportunity: OpportunityCardData }) {
  return (
    <Link href={`/opportunities/${opportunity.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{opportunity.app.category}</p>
              <h3 className="text-lg font-semibold text-slate-900">{opportunity.app.name}</h3>
            </div>
            {opportunity.riskAssessment && (
              <Badge variant="outline" className="shrink-0">
                Risk {opportunity.riskAssessment.grade}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="line-clamp-2 text-sm text-slate-600">{opportunity.title}</p>

          <p className="text-xs text-slate-500">
            {formatCurrency(opportunity.amountFunded)} invested so far · min. {formatCurrency(opportunity.minimumInvestment)}
          </p>

          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm">
            <Stat label="Historical ROAS" value={opportunity.historicalROAS ? formatMultiple(opportunity.historicalROAS) : "—"} />
            <Stat label="Investor share" value={formatPercent(opportunity.investorRevenueSharePercent)} />
            <Stat label="Return cap" value={formatMultiple(opportunity.returnCapMultiple)} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-900">{value}</p>
    </div>
  );
}
