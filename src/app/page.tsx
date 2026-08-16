import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpportunityCard } from "@/components/opportunity-card";
import { getFeaturedOpportunities, getMarketplaceStats } from "@/lib/queries/marketplace";
import { formatCurrency } from "@/lib/utils";

export default async function HomePage() {
  const [featured, stats] = await Promise.all([getFeaturedOpportunities(3), getMarketplaceStats()]);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Fund app growth. <br /> Share in attributable revenue.
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              Back verified marketing campaigns instead of buying equity. Advertising spend and revenue are tracked
              through connected platforms, end to end.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/opportunities">
                <Button size="lg">Explore opportunities</Button>
              </Link>
              <Link href="/how-it-works">
                <Button size="lg" variant="outline">
                  How it works
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-8 border-t border-slate-100 pt-10 sm:grid-cols-4">
            <StatBlock label="Campaign funding to date" value={formatCurrency(stats.totalFunded)} />
            <StatBlock label="Open opportunities" value={String(stats.activeOpportunities)} />
            <StatBlock label="Investors" value={String(stats.totalInvestors)} />
            <StatBlock label="Developers" value={String(stats.totalDevelopers)} />
          </div>
        </div>
      </section>

      {/* Featured opportunities */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Featured opportunities</h2>
            <Link href="/opportunities" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              View all →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
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
              ["Discover", "Browse apps with verified historical marketing performance."],
              ["Fund", "Allocate money to a specific growth campaign."],
              ["Track", "See exactly where marketing dollars are spent."],
              ["Earn", "Receive the agreed share of attributable revenue."],
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

      {/* Risk explanation */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Transparent risk scoring</h2>
              <p className="mt-3 text-slate-600">
                Every opportunity carries a deterministic 0–100 risk score with a plain-language breakdown of what
                drove it — historical ROAS, revenue history, retention, refund rate, and more. No black box.
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Risk Score 78 / 100</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="font-medium text-emerald-700">Positive</p>
                  <ul className="mt-2 space-y-1 text-slate-600">
                    <li>+ 12 months revenue history</li>
                    <li>+ 2.2x historical ROAS</li>
                    <li>+ Strong subscription retention</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-red-700">Negative</p>
                  <ul className="mt-2 space-y-1 text-slate-600">
                    <li>- Small advertising history</li>
                    <li>- High month-to-month CAC variation</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTAs */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>For investors</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Browse verified campaigns and back the ones with the economics you trust.
              </p>
              <Link href="/register?role=INVESTOR" className="mt-4 inline-block">
                <Button>Start investing</Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>For developers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Connect your data, prove your economics, and raise campaign funding.
              </p>
              <Link href="/register?role=DEVELOPER" className="mt-4 inline-block">
                <Button>Raise funding</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
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
