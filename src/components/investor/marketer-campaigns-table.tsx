import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { getMarketerCampaigns } from "@/lib/queries/investor";

type MarketerCampaignRow = Awaited<ReturnType<typeof getMarketerCampaigns>>[number];

export function MarketerCampaignsTable({ campaigns }: { campaigns: MarketerCampaignRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">App / campaign</th>
            <th className="px-4 py-3 font-medium">Declared budget</th>
            <th className="px-4 py-3 font-medium">Real ad spend</th>
            <th className="px-4 py-3 font-medium">Subscribers delivered</th>
            <th className="px-4 py-3 font-medium">Owed to you</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campaigns.map(({ campaign, realSpend, conversionsDelivered, owed }) => (
            <tr key={campaign.id} className="transition-colors hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/investor/campaigns/${campaign.id}`} className="font-medium text-slate-900 hover:underline">
                  {campaign.app.name}
                </Link>
                <p className="text-xs text-slate-500">{campaign.creative?.name} · {campaign.targetingTemplate?.name}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{formatCurrency(campaign.declaredBudget ?? 0)}</td>
              <td className="px-4 py-3 text-slate-700">{formatCurrency(realSpend)}</td>
              <td className="px-4 py-3 text-slate-700">{conversionsDelivered}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(owed)}</td>
              <td className="px-4 py-3">
                <Badge variant="outline">{campaign.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
