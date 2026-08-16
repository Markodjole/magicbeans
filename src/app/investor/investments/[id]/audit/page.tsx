import { notFound } from "next/navigation";
import Link from "next/link";
import { requireInvestorProfile } from "@/lib/authz";
import { getInvestmentDetail, getInvestmentAuditTimeline } from "@/lib/queries/investor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditTimeline } from "@/components/investor/audit-timeline";

export default async function InvestmentAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireInvestorProfile();

  const result = await getInvestmentDetail(id);
  if (!result || result.investment.investorId !== profile.id) notFound();
  const { investment } = result;

  const entries = await getInvestmentAuditTimeline(id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm">
        <Link href={`/investor/investments/${id}`} className="text-slate-500 hover:text-slate-900">
          ← Back to investment
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Campaign audit trail</h1>
      <p className="mt-2 text-slate-600">
        Every ledger entry tied to your {investment.opportunity.app.name} investment, in the order it happened.
        Expand any entry to see the raw provider metadata behind it.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Ledger history</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
