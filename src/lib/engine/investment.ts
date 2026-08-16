import { prisma } from "@/lib/prisma";
import { recordLedgerEntry } from "@/lib/ledger/ledger";
import { getPaymentProvider } from "@/lib/integrations/provider-factory";

export class InvestmentError extends Error {}

/**
 * "Investor selects Invest $500" from the spec's demo payment flow. Runs
 * the (mock, unless ENABLE_REAL_MONEY) payment provider, then creates the
 * Investment + INVESTMENT_DEPOSIT ledger entry, and activates the
 * opportunity's campaign on first funding. Nothing about capital
 * deployment or revenue happens here — that's
 * capital-deployment.ts/attribution-revenue-engine.ts, run by sync jobs.
 */
export async function createInvestment(params: {
  investorProfileId: string;
  opportunityId: string;
  amount: number;
  /** Only for seeding believable historical demo data — real investments always happen "now". */
  investedAt?: Date;
}): Promise<{ investmentId: string }> {
  const { investorProfileId, opportunityId, amount, investedAt } = params;

  const opportunity = await prisma.investmentOpportunity.findUniqueOrThrow({ where: { id: opportunityId } });
  if (opportunity.status !== "OPEN") {
    throw new InvestmentError(`These terms are no longer accepting investment (status: ${opportunity.status})`);
  }
  if (amount < Number(opportunity.minimumInvestment)) {
    throw new InvestmentError(`Minimum investment is $${opportunity.minimumInvestment}`);
  }

  const paymentProvider = getPaymentProvider();
  const deposit = await paymentProvider.createDeposit({ investorId: investorProfileId, amount, currency: "USD" });
  if (deposit.status !== "SUCCEEDED") {
    throw new InvestmentError("Payment did not succeed");
  }

  const investmentId = await prisma.$transaction(async (tx) => {
    const investment = await tx.investment.create({
      data: {
        investorId: investorProfileId,
        opportunityId,
        principalAmount: amount,
        status: "ACTIVE",
        ...(investedAt ? { createdAt: investedAt } : {}),
      },
    });

    await recordLedgerEntry(tx, {
      type: "INVESTMENT_DEPOSIT",
      amount,
      investmentId: investment.id,
      opportunityId,
      description: `Investor deposit for ${opportunity.title}`,
      metadata: { externalPaymentId: deposit.externalPaymentId },
      createdAt: investedAt,
    });

    await tx.investmentOpportunity.update({
      where: { id: opportunityId },
      data: {
        amountFunded: { increment: amount },
        startDate: opportunity.startDate ?? investedAt ?? new Date(),
      },
    });

    return investment.id;
  });

  return { investmentId };
}
