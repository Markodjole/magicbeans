import { OpportunityCard } from "@/components/opportunity-card";
import { listOpportunities } from "@/lib/queries/marketplace";

export const metadata = { title: "Opportunities — GrowthFund" };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const opportunities = await listOpportunities({ category: params.category });
  const categories = Array.from(new Set(opportunities.map((o) => o.app.category)));

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Opportunities</h1>
      <p className="mt-2 text-slate-600">Verified marketing campaigns currently open for campaign funding.</p>

      {categories.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <CategoryLink label="All" active={!params.category} />
          {categories.map((c) => (
            <CategoryLink key={c} label={c} active={params.category === c} category={c} />
          ))}
        </div>
      )}

      {opportunities.length === 0 ? (
        <p className="mt-16 text-center text-slate-500">No open opportunities right now.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryLink({ label, active, category }: { label: string; active: boolean; category?: string }) {
  return (
    <a
      href={category ? `/opportunities?category=${encodeURIComponent(category)}` : "/opportunities"}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"
      }`}
    >
      {label}
    </a>
  );
}
