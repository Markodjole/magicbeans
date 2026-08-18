import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "How it works — MagicBeans" };

const MARKETER_STEPS = [
  { title: "Browse", body: "Find an app paying a flat rate per verified subscriber you deliver, plus real performance data from every past campaign." },
  { title: "Pick", body: "Choose an approved creative and audience — or copy the exact setup of whichever past campaign performed best." },
  { title: "Launch", body: "Fund your own ad spend directly with the ad platform, or use MagicBeans' connected account as a shortcut." },
  { title: "Get paid", body: "A real subscriber shows up, verified through the developer's revenue provider — you're owed your rate automatically." },
];

const DEVELOPER_STEPS = [
  { title: "Connect your data", body: "Link RevenueCat (or Apple/Google Play), an attribution provider, and your ad accounts." },
  { title: "Post an offer", body: "Set a flat payout per verified subscriber, plus a small set of approved creatives and targeting templates." },
  { title: "Marketers compete", body: "Anyone can pick up your offer, fund a campaign against it, and try to deliver real subscribers." },
  { title: "Pay per result", body: "You only ever owe money for subscribers who actually show up and pay — MagicBeans takes a marketplace fee on top." },
];

const INVESTOR_STEPS = [
  { title: "Discover", body: "Browse apps with verified historical marketing performance — real spend, real ROAS, real retention." },
  { title: "Fund", body: "Contribute under a developer's standing revenue-share terms, with an agreed split and return cap." },
  { title: "Track", body: "See exactly where marketing dollars are spent, day by day, verified by the connected ad platform." },
  { title: "Earn", body: "Receive your agreed share of attributable revenue, after your principal is recouped first." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">How MagicBeans works</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        A developer posts a flat rate they&apos;ll pay per verified subscriber. A marketer picks up that offer, runs
        a real campaign against it, and gets paid per result — a marketing gig with a provable, per-customer payout,
        not an investment.
      </p>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">For marketers</h2>
          <ol className="mt-4 flex flex-col gap-4">
            {MARKETER_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-900">{step.title}</p>
                  <p className="text-sm text-slate-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">For developers</h2>
          <ol className="mt-4 flex flex-col gap-4">
            {DEVELOPER_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-900">{step.title}</p>
                  <p className="text-sm text-slate-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Card className="mt-14">
        <CardHeader>
          <CardTitle>Example campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 divide-y divide-slate-100 text-sm sm:grid-cols-6 sm:divide-x sm:divide-y-0">
            {[
              ["Your ad budget", "$500"],
              ["TikTok spend", "$486"],
              ["Attributed installs", "142"],
              ["Verified subscribers", "16"],
              ["Payout per subscriber", "$32"],
              ["You're owed", "$460.80"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 px-4 py-3 first:pl-0">
                <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
                <span className="text-lg font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Illustrative example (16 × $32 gross, minus a 10% marketplace fee). Every number in a real campaign
            traces back to a specific ledger entry — see any campaign&apos;s audit trail for the real chain.
          </p>
        </CardContent>
      </Card>

      <div className="mt-14 flex flex-wrap gap-4">
        <Link href="/offers">
          <Button size="lg">Browse performance offers</Button>
        </Link>
        <Link href="/register?role=DEVELOPER">
          <Button size="lg" variant="outline">
            Post an offer
          </Button>
        </Link>
      </div>

      <div className="mt-20 border-t border-slate-200 pt-10">
        <h2 className="text-lg font-semibold text-slate-900">Prefer revenue-share investing instead?</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          MagicBeans also runs an older model: fund a developer&apos;s standing revenue-share terms and earn a
          percentage of attributable revenue, capped at a return multiple, instead of a flat rate per subscriber.
        </p>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {INVESTOR_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-600">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                <p className="text-xs text-slate-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/opportunities" className="mt-4 inline-block text-sm font-medium text-slate-700 underline hover:text-slate-900">
          Browse investment opportunities →
        </Link>
      </div>
    </div>
  );
}
