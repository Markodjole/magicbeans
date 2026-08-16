import { Prisma, type LedgerEntryType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type TxClient = Prisma.TransactionClient;

/**
 * Every financial number shown anywhere in the app must ultimately be
 * traceable back to rows created here. This is the ONLY function allowed
 * to insert a LedgerEntry — do not call prisma.ledgerEntry.create()
 * directly anywhere else.
 *
 * Sign convention: normal entries carry a positive magnitude; REFUND and
 * REVERSAL entries carry a negative amount representing money/credit
 * taken back, per the spec's refund example (-$100 / -$70 / -$30).
 * Nothing is ever deleted or mutated — a mistake gets reversed by a new
 * entry, never by editing the old one.
 */
export async function recordLedgerEntry(
  tx: TxClient,
  params: {
    type: LedgerEntryType;
    amount: number;
    currency?: string;
    investmentId?: string;
    opportunityId?: string;
    description: string;
    metadata?: Record<string, unknown>;
    /** Only for seeding believable historical demo data. */
    createdAt?: Date;
  }
): Promise<void> {
  await tx.ledgerEntry.create({
    data: {
      type: params.type,
      amount: params.amount,
      currency: params.currency ?? "USD",
      investmentId: params.investmentId,
      opportunityId: params.opportunityId,
      description: params.description,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    },
  });
}

export async function getInvestmentLedgerSummary(investmentId: string) {
  const entries = await prisma.ledgerEntry.findMany({ where: { investmentId } });
  const byType: Partial<Record<LedgerEntryType, number>> = {};
  for (const entry of entries) {
    byType[entry.type] = (byType[entry.type] ?? 0) + Number(entry.amount);
  }
  return byType;
}
