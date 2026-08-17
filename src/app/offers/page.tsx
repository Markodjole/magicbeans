import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listPerformanceOffers } from "@/lib/queries/marketplace";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Performance offers — MagicBeans" };

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const offers = await listPerformanceOffers({ category: params.category });
  const categories = Array.from(new Set(offers.map((o) => o.app.category)));

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Performance offers</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Developers pay a flat rate per verified subscriber you deliver. Pick an approved creative and audience,
        launch a campaign, get paid per result — this is a paid-marketing gig, not an investment.
      </p>

      {categories.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <CategoryLink label="All" active={!params.category} />
          {categories.map((c) => (
            <CategoryLink key={c} label={c} active={params.category === c} category={c} />
          ))}
        </div>
      )}

      {offers.length === 0 ? (
        <p className="mt-16 text-center text-slate-500">No open performance offers right now.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <Link key={offer.id} href={`/offers/${offer.id}`}>
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
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryLink({ label, active, category }: { label: string; active: boolean; category?: string }) {
  return (
    <a
      href={category ? `/offers?category=${encodeURIComponent(category)}` : "/offers"}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"
      }`}
    >
      {label}
    </a>
  );
}
