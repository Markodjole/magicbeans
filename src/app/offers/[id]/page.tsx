import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPerformanceOfferDetail, getOfferCampaignHistory, getOfferPerformanceBreakdown } from "@/lib/queries/marketplace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketerCampaignForm } from "@/components/marketer-campaign-form";
import { OfferPerformanceHistory } from "@/components/offer-performance-history";
import { formatCurrency, formatDate } from "@/lib/utils";

const CHANNEL_LABELS: Record<string, string> = { TIKTOK: "TikTok", META: "Meta", GOOGLE_ADS: "Google Ads" };

export default async function PerformanceOfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creative?: string; targeting?: string; budget?: string; duration?: string }>;
}) {
  const { id } = await params;
  const copyParams = await searchParams;
  const [offer, campaignHistory, comboBreakdown] = await Promise.all([
    getPerformanceOfferDetail(id),
    getOfferCampaignHistory(id),
    getOfferPerformanceBreakdown(id),
  ]);
  if (!offer) notFound();
  const session = await auth();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{offer.app.category}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{offer.title}</h1>
        <p className="mt-2 text-slate-600">
          {offer.app.name} · by {offer.app.developer.displayName}
        </p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="flex flex-col gap-10 lg:col-span-2">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
            <p className="mt-3 text-slate-600">{offer.description}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">How this works</h2>
            <p className="mt-3 text-slate-600">
              {offer.app.developer.displayName} pays {formatCurrency(offer.payoutPerConversion)} for every new
              paying subscriber you deliver — a flat rate per result, not a share of their revenue. You pick an
              approved creative and audience below, fund your own ad budget directly with the ad platform, and get
              paid once a real subscriber shows up. Renewals from the same customer don&apos;t pay again — this is a
              one-time bounty per customer acquired, not an ongoing revenue share.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Campaign performance</h2>
            <div className="mt-3">
              <OfferPerformanceHistory offerId={offer.id} combos={comboBreakdown} campaigns={campaignHistory} />
            </div>
          </section>

          {session?.user?.role === "INVESTOR" ? (
            <section id="launch">
              <h2 className="text-lg font-semibold text-slate-900">Launch a campaign</h2>
              <Card className="mt-3">
                <CardContent className="pt-6">
                  <MarketerCampaignForm
                    offerId={offer.id}
                    minBudget={Number(offer.minBudget)}
                    payoutPerConversion={Number(offer.payoutPerConversion)}
                    historicalCPA={offer.historicalCPA ? Number(offer.historicalCPA) : null}
                    creatives={offer.creatives.map((c) => ({
                      id: c.id,
                      name: c.name,
                      channel: CHANNEL_LABELS[c.channel] ?? c.channel,
                      description: c.description,
                    }))}
                    targetingTemplates={offer.targetingTemplates.map((t) => ({
                      id: t.id,
                      name: t.name,
                      channel: CHANNEL_LABELS[t.channel] ?? t.channel,
                      description: t.description,
                    }))}
                    initialCreativeId={copyParams.creative}
                    initialTargetingTemplateId={copyParams.targeting}
                    initialBudget={copyParams.budget ? Number(copyParams.budget) : undefined}
                    initialDurationDays={copyParams.duration ? Number(copyParams.duration) : undefined}
                  />
                </CardContent>
              </Card>
            </section>
          ) : (
            <Link href={session?.user ? "#" : "/login?callbackUrl=/offers/" + offer.id}>
              <button className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                {session?.user ? "Marketer accounts only" : "Log in to launch a campaign"}
              </button>
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <Term label="Payout per subscriber" value={formatCurrency(offer.payoutPerConversion)} />
                <Term label="MagicBeans fee" value={`${offer.marketplaceFeePercent}%`} />
                <Term label="Minimum budget" value={formatCurrency(offer.minBudget)} />
                <Term
                  label="Historical CPA"
                  value={offer.historicalCPA ? formatCurrency(offer.historicalCPA) : "—"}
                />
                <Term label="Offer open since" value={formatDate(offer.createdAt)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Developer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              <p className="font-medium text-slate-900">{offer.app.developer.displayName}</p>
              {offer.app.developer.bio && <p className="mt-1">{offer.app.developer.bio}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
