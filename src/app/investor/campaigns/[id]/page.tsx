import { notFound } from "next/navigation";
import { requireInvestorProfile } from "@/lib/authz";
import { getMarketerCampaignDetail } from "@/lib/queries/investor";
import { requestCampaignPayout } from "@/lib/actions/marketer-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/admin/action-button";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function MarketerCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireInvestorProfile();
  const result = await getMarketerCampaignDetail(id, profile.id);
  if (!result) notFound();
  const { campaign, realSpend, conversionsDelivered, grossEarned, owed } = result;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{campaign.app.category}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{campaign.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-600">
        <span>
          {campaign.creative?.name} · {campaign.targetingTemplate?.name} · launched{" "}
          {formatDate(campaign.launchedAt ?? campaign.createdAt)}
        </span>
        <Badge variant={campaign.advertisingAccount?.marketerId ? "secondary" : "outline"}>
          {campaign.advertisingAccount?.marketerId ? "Running on your ad account" : "MagicBeans-managed account"}
        </Badge>
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Declared budget" value={formatCurrency(campaign.declaredBudget ?? 0)} />
        <Stat label="Real ad spend" value={formatCurrency(realSpend)} />
        <Stat label="Subscribers delivered" value={String(conversionsDelivered)} />
        <Stat label="Gross earned" value={formatCurrency(grossEarned)} />
        <Stat label="Owed to you now" value={formatCurrency(owed)} emphasize />
      </div>

      {owed > 0 && (
        <div className="mt-6">
          <ActionButton action={() => requestCampaignPayout(campaign.id)}>Request payout of {formatCurrency(owed)}</ActionButton>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verified subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.conversions.length === 0 ? (
              <p className="text-sm text-slate-500">No verified subscribers yet.</p>
            ) : (
              <>
                <div className="flex flex-col divide-y divide-slate-100">
                  {campaign.conversions.slice(-20).reverse().map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">{formatDate(c.verifiedAt)}</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(c.grossPayout)} gross · {formatCurrency(c.netPayout)} net
                      </span>
                    </div>
                  ))}
                </div>
                {campaign.conversions.length > 20 && (
                  <p className="mt-3 text-xs text-slate-400">
                    Showing the most recent 20 of {campaign.conversions.length} verified subscribers.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.ledgerEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No ledger entries yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100">
                {campaign.ledgerEntries.slice(-20).reverse().map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <Badge variant="outline" className="text-[10px]">{entry.type}</Badge>
                      <p className="mt-1 text-xs text-slate-500">{entry.description}</p>
                    </div>
                    <span className="shrink-0 font-medium text-slate-900">{formatCurrency(entry.amount)}</span>
                  </div>
                ))}
                {campaign.ledgerEntries.length > 20 && (
                  <p className="pt-2 text-xs text-slate-400">
                    Showing the most recent 20 of {campaign.ledgerEntries.length} ledger entries.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${emphasize ? "text-emerald-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
