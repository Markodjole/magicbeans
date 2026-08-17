import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "How it works — MagicBeans" };

const INVESTOR_STEPS = [
  { title: "Discover", body: "Browse apps with verified historical marketing performance — real spend, real ROAS, real retention." },
  { title: "Fund", body: "Allocate campaign funding to a specific growth campaign, with an agreed revenue share and return cap." },
  { title: "Track", body: "See exactly where marketing dollars are spent, day by day, verified by the connected ad platform." },
  { title: "Earn", body: "Receive your agreed share of attributable revenue as it's generated and confirmed by the revenue provider." },
];

const DEVELOPER_STEPS = [
  { title: "Connect your data", body: "Link RevenueCat (or Apple/Google Play), an attribution provider, and your ad accounts." },
  { title: "Prove your economics", body: "Your last 30-90 days of spend, revenue, CAC, and ROAS become your track record." },
  { title: "Create a campaign", body: "Set a funding target, revenue share, and return cap for a specific growth campaign." },
  { title: "Receive growth capital", body: "Investors fund your campaign; capital deploys into ad spend as it runs." },
  { title: "Share resulting revenue", body: "Investors receive their agreed share of attributable revenue; you keep the rest." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">How MagicBeans works</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Investors fund a specific marketing campaign, not a company. The platform verifies advertising spend, tracks
        the users that campaign brought in, and tracks the revenue those users generate — so every dollar of
        return is tied back to a dollar of provable performance.
      </p>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">For investors</h2>
          <ol className="mt-4 flex flex-col gap-4">
            {INVESTOR_STEPS.map((step, i) => (
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
          <CardTitle>Example investment funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 divide-y divide-slate-100 text-sm sm:grid-cols-6 sm:divide-x sm:divide-y-0">
            {[
              ["Your investment", "$1,000"],
              ["TikTok spend", "$823"],
              ["Attributed installs", "347"],
              ["Paying customers", "29"],
              ["Attributed revenue", "$1,482"],
              ["Your 70% share", "$1,037"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 px-4 py-3 first:pl-0">
                <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
                <span className="text-lg font-semibold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Illustrative example. Every number in a real investment traces back to a specific ledger entry — see any
            investment&apos;s audit timeline for the real chain.
          </p>
        </CardContent>
      </Card>

      <div className="mt-14 flex flex-wrap gap-4">
        <Link href="/opportunities">
          <Button size="lg">Explore opportunities</Button>
        </Link>
        <Link href="/register?role=DEVELOPER">
          <Button size="lg" variant="outline">
            Raise campaign funding
          </Button>
        </Link>
      </div>
    </div>
  );
}
