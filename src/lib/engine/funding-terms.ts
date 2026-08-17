import { prisma } from "@/lib/prisma";

/**
 * Core "open new standing funding terms" logic, separated from the
 * auth-wrapped setFundingTerms server action so both it and the seed
 * script (which has no request/session context) can call the same
 * business logic. Supersedes whatever OPEN terms already exist for the
 * app rather than editing them — see InvestmentOpportunity's doc comment
 * in prisma/schema.prisma for why.
 */
export async function openFundingTerms(params: {
  appId: string;
  title: string;
  description: string;
  minimumInvestment: number;
  investorRevenueSharePercent: number;
  returnCapMultiple: number;
  historicalROAS?: number;
  historicalCAC?: number;
  historicalLTV?: number;
  status?: "PENDING_APPROVAL" | "OPEN";
}): Promise<{ opportunityId: string }> {
  const opportunity = await prisma.$transaction(async (tx) => {
    const currentOpen = await tx.investmentOpportunity.findFirst({ where: { appId: params.appId, status: "OPEN" } });
    if (currentOpen) {
      await tx.investmentOpportunity.update({
        where: { id: currentOpen.id },
        data: { status: "SUPERSEDED", endDate: new Date() },
      });
    }

    return tx.investmentOpportunity.create({
      data: {
        appId: params.appId,
        title: params.title,
        description: params.description,
        minimumInvestment: params.minimumInvestment,
        investorRevenueSharePercent: params.investorRevenueSharePercent,
        developerRevenueSharePercent: 100 - params.investorRevenueSharePercent,
        returnCapMultiple: params.returnCapMultiple,
        status: params.status ?? "PENDING_APPROVAL",
        historicalROAS: params.historicalROAS,
        historicalCAC: params.historicalCAC,
        historicalLTV: params.historicalLTV,
      },
    });
  }, { timeout: 30_000, maxWait: 10_000 });

  return { opportunityId: opportunity.id };
}
