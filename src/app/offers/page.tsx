import { OfferCard } from "@/components/offer-card";
import { listPerformanceOffers } from "@/lib/queries/marketplace";

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
            <OfferCard key={offer.id} offer={offer} />
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
