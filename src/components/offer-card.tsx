import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { App, DeveloperProfile, PerformanceOffer } from "@/generated/prisma/client";

type OfferCardData = PerformanceOffer & {
  app: App & { developer: DeveloperProfile };
};

export function OfferCard({ offer }: { offer: OfferCardData }) {
  return (
    <Link href={`/offers/${offer.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{offer.app.category}</p>
          <h3 className="text-lg font-semibold text-slate-900">{offer.app.name}</h3>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="line-clamp-2 text-sm text-slate-600">{offer.title}</p>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Payout per subscriber</p>
              <p className="font-medium text-slate-900">{formatCurrency(offer.payoutPerConversion)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Minimum budget</p>
              <p className="font-medium text-slate-900">{formatCurrency(offer.minBudget)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
