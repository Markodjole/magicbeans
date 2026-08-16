import { DataSourceBadge } from "@/components/data-source-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { getInvestmentDetail } from "@/lib/queries/investor";

type InvestmentDetail = NonNullable<Awaited<ReturnType<typeof getInvestmentDetail>>>["investment"];
type Funnel = NonNullable<Awaited<ReturnType<typeof getInvestmentDetail>>>["funnel"];

const CHANNEL_LABELS: Record<string, string> = { TIKTOK: "TikTok", META: "Meta", GOOGLE_ADS: "Google Ads" };

export function InvestmentFunnel({ investment, funnel }: { investment: InvestmentDetail; funnel: Funnel }) {
  const campaigns = investment.opportunity.app.campaigns;
  const channels = Array.from(new Set(campaigns.map((c) => CHANNEL_LABELS[c.provider] ?? c.provider)));
  const channel = channels.length > 0 ? channels.join(" + ") : "Ad";
  const campaignIsMock = campaigns.length === 0 || campaigns.some((c) => c.isMock);

  const steps = [
    {
      label: "Your investment",
      value: formatCurrency(investment.principalAmount),
      provider: "GrowthFund",
      isMock: false,
    },
    {
      label: `${channel} spend`,
      value: formatCurrency(investment.capitalDeployed),
      provider: channel,
      isMock: campaignIsMock,
    },
    {
      label: "Attributed installs",
      value: funnel.installsCount.toLocaleString(),
      provider: "AppsFlyer",
      isMock: campaignIsMock,
    },
    {
      label: "Paying customers",
      value: funnel.payingCustomersCount.toLocaleString(),
      provider: "RevenueCat",
      isMock: campaignIsMock,
    },
    {
      label: "Attributed revenue",
      value: formatCurrency(investment.attributableRevenue),
      provider: "RevenueCat",
      isMock: campaignIsMock,
    },
    {
      label: `Your ${formatPercent(investment.opportunity.investorRevenueSharePercent)} share`,
      value: formatCurrency(investment.investorRevenueEarned),
      provider: "GrowthFund",
      isMock: false,
    },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
      {steps.map((step, i) => (
        <div key={step.label} className="flex flex-1 items-center gap-3">
          <div className="flex min-w-[9.5rem] flex-1 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{step.label}</p>
            <p className="text-lg font-semibold text-slate-900">{step.value}</p>
            <DataSourceBadge provider={step.provider} isMock={step.isMock} />
          </div>
          {i < steps.length - 1 && (
            <span className="hidden shrink-0 text-slate-300 sm:block" aria-hidden>
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
