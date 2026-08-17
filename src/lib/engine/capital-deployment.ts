import { prisma } from "@/lib/prisma";
import { recordLedgerEntry } from "@/lib/ledger/ledger";
import { round2 } from "./revenue-share";

/**
 * Tracks how much of investors' committed capital has actually been
 * "deployed" into real ad spend — the `$1,000 committed / $643 deployed /
 * $357 remaining` numbers on the investor dashboard. Pooled across ALL of
 * an app's active investments (any standing-terms vintage) and ALL of the
 * app's campaigns (any channel) — an investment isn't scoped to one
 * campaign anymore, so neither is deployment. Deployed capital never
 * exceeds what investors actually put in, even if campaigns spend more
 * (the developer/platform funds any spend beyond investor capital
 * itself). COMPLETED investments (hit their revenue return cap) still
 * keep accruing capital-deployed — that tracks where the money physically
 * went, independent of whether revenue share has capped out.
 *
 * Known simplification: unlike the revenue engine, this pools every
 * active investment by a single global weight (principal / totalPrincipal)
 * for the whole run rather than only crediting each investment for spend
 * that happened after it was made. A late-joining investor can therefore
 * pick up deployment-credit for a small amount of spend that predates
 * their investment. Acceptable for this prototype's demo data; a fully
 * correct version would need a per-day cohort walk rather than one
 * aggregate pass.
 */
export async function runCapitalDeploymentForApp(appId: string): Promise<void> {
  const investments = await prisma.investment.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED"] }, opportunity: { appId } },
  });
  if (investments.length === 0) return;

  const totalPrincipal = investments.reduce((sum, inv) => sum + Number(inv.principalAmount), 0);
  if (totalPrincipal <= 0) return;

  const fundingDate = investments.reduce(
    (earliest, inv) => (inv.createdAt < earliest ? inv.createdAt : earliest),
    investments[0].createdAt
  );

  const alreadyAllocatedTotal = await prisma.capitalAllocation.aggregate({
    where: { investment: { opportunity: { appId } } },
    _sum: { amount: true },
  });
  let remainingCapacity = round2(totalPrincipal - Number(alreadyAllocatedTotal._sum.amount ?? 0));
  if (remainingCapacity <= 0) return;

  const campaigns = await prisma.marketingCampaign.findMany({ where: { appId }, orderBy: { startDate: "asc" } });

  await prisma.$transaction(async (tx) => {
    for (const campaign of campaigns) {
      if (remainingCapacity <= 0) break;

      const spendAgg = await tx.campaignDailyMetric.aggregate({
        where: { campaignId: campaign.id, date: { gte: fundingDate } },
        _sum: { spend: true },
      });
      const cumulativeSpend = Number(spendAgg._sum.spend ?? 0);

      const allocatedForCampaign = await tx.capitalAllocation.aggregate({
        where: { campaignId: campaign.id, investment: { opportunity: { appId } } },
        _sum: { amount: true },
      });
      const deltaForCampaign = round2(cumulativeSpend - Number(allocatedForCampaign._sum.amount ?? 0));
      if (deltaForCampaign <= 0) continue;

      const amountToAllocate = round2(Math.min(deltaForCampaign, remainingCapacity));
      if (amountToAllocate <= 0) continue;
      remainingCapacity = round2(remainingCapacity - amountToAllocate);

      for (const investment of investments) {
        const weight = Number(investment.principalAmount) / totalPrincipal;
        const amount = round2(amountToAllocate * weight);
        if (amount <= 0) continue;

        await tx.capitalAllocation.create({
          data: { investmentId: investment.id, campaignId: campaign.id, amount },
        });
        await tx.investment.update({
          where: { id: investment.id },
          data: { capitalDeployed: { increment: amount } },
        });
        await recordLedgerEntry(tx, {
          type: "CAMPAIGN_ALLOCATION",
          amount,
          investmentId: investment.id,
          opportunityId: investment.opportunityId,
          description: `Capital deployed into ${campaign.name}`,
        });
      }
    }
  }, { timeout: 30_000, maxWait: 10_000 });
}
