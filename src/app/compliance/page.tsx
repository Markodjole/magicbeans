import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Compliance — GrowthFund" };

export default function CompliancePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Compliance notes</h1>
      <p className="mt-3 text-slate-600">
        GrowthFund is a working prototype. This page is deliberately blunt about what has, and has not, been
        resolved before any version of this product could handle real money.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>This is not an equity marketplace</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Investors do not purchase ownership in any app or company. What&apos;s being offered is campaign
            funding in exchange for a revenue share tied to a specific, verifiable marketing campaign&apos;s
            attributable revenue, for a bounded duration, up to a contractual return cap. Nothing on this platform
            should be described, sold, or understood as equity, a security guaranteeing appreciation, or a loan
            with a fixed interest rate.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Real-money capability is disabled</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Every investment, payout, and balance shown in this prototype is simulated. The <code>ENABLE_REAL_MONEY</code> flag
            defaults to <code>false</code> and gates the only code path that could ever move real funds (a
            production Stripe Connect integration in test mode today). No production real-money activation happens
            automatically — see ARCHITECTURE.md.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What a real-money launch would require</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            <p>Before any real-money version of this product could launch, it needs jurisdiction-specific legal review covering, at minimum:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Securities law — whether a revenue-share investment contract of this shape is a security in the relevant jurisdiction(s), and what registration or exemption applies.</li>
              <li>Lending / consumer credit law — whether the structure could be construed as a loan and what disclosure or licensing that triggers.</li>
              <li>Revenue-sharing / marketplace regulation — rules specific to platforms that intermediate revenue-sharing agreements between two commercial parties.</li>
              <li>Payments regulation — money transmission licensing for any entity that custodies or moves investor/developer funds.</li>
              <li>KYC/AML — identity verification and anti-money-laundering obligations for both investors and developers.</li>
              <li>Investor eligibility — accreditation, suitability, or investment-limit rules that may apply depending on structure and jurisdiction.</li>
            </ul>
            <p className="mt-3">
              None of this is something application code can resolve on its own. This prototype does not attempt
              to, and nothing in its UI copy should ever imply otherwise.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>No guaranteed returns</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Historical performance, risk scores, and bear/base/bull projections shown anywhere on this platform are
            informational and may be based on simulated data. They are not, and must never be presented as,
            guarantees of future performance, guaranteed income, or risk-free returns.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
