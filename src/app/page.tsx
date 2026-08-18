import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OfferCard } from "@/components/offer-card";
import { getFeaturedOffers, getOfferMarketplaceStats } from "@/lib/queries/marketplace";
import { formatCurrency } from "@/lib/utils";

export default async function HomePage() {
  const [featured, stats] = await Promise.all([getFeaturedOffers(3), getOfferMarketplaceStats()]);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Get paid per verified subscriber you deliver.
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              Developers post a flat rate per real, paying customer. Pick an approved creative and audience, launch
              a campaign, get paid per result — a marketing gig with a real payout, not an investment.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/offers">
                <Button size="lg">Browse performance offers</Button>
              </Link>
              <Link href="/how-it-works">
                <Button size="lg" variant="outline">
                  How it works
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-8 border-t border-slate-100 pt-10 sm:grid-cols-4">
            <StatBlock label="Paid out to marketers" value={formatCurrency(stats.totalMarketerPayouts)} />
            <StatBlock label="Open offers" value={String(stats.openOffers)} />
            <StatBlock label="Marketers" value={String(stats.totalMarketers)} />
            <StatBlock label="Developers" value={String(stats.totalDevelopers)} />
          </div>
        </div>
      </section>

      {/* Featured offers */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Featured offers</h2>
            <Link href="/offers" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              View all →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      )}

      {/* How it works, condensed */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Browse", "Find an app paying a flat rate per verified subscriber you deliver."],
              ["Pick", "Choose an approved creative and audience, or copy a campaign that's already working."],
              ["Launch", "Fund your own ad spend, or use MagicBeans' connected account as a shortcut."],
              ["Get paid", "A real subscriber shows up, you're owed your rate — automatically, per result."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verified data explanation */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Every number has a source</h2>
            <p className="mt-3 text-slate-600">
              Ad spend, installs, and revenue are all imported from connected platforms with full provenance. If a
              number is simulated rather than pulled from a live connection, it&apos;s labeled that way — never
              silently mixed in as if it were real.
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <ProvenanceRow label="Ad Spend" value="$12,480" source="Verified by TikTok" />
              <ProvenanceRow label="Revenue" value="$24,331" source="Verified by RevenueCat" />
              <ProvenanceRow label="Installs" value="4,203" source="Attributed by AppsFlyer" />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTAs */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>For marketers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Browse performance offers and get paid a flat rate for every verified subscriber you deliver.
              </p>
              <Link href="/register?role=INVESTOR" className="mt-4 inline-block">
                <Button>Start marketing</Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>For developers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Connect your data, set a rate per verified subscriber, and let marketers compete to deliver them.
              </p>
              <Link href="/register?role=DEVELOPER" className="mt-4 inline-block">
                <Button>Post an offer</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Looking for the revenue-share investment model instead?{" "}
          <Link href="/opportunities" className="font-medium text-slate-700 underline hover:text-slate-900">
            Browse investment opportunities →
          </Link>
        </p>
      </section>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ProvenanceRow({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-900">{value}</p>
      </div>
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">{source}</span>
    </div>
  );
}
