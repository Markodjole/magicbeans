"use server";

import { revalidatePath } from "next/cache";
import { requireInvestorProfile } from "@/lib/authz";
import { createInvestment, InvestmentError } from "@/lib/engine/investment";

export async function investInOpportunity(
  _prevState: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const profile = await requireInvestorProfile();
  const opportunityId = formData.get("opportunityId") as string;
  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount" };
  }

  try {
    await createInvestment({ investorProfileId: profile.id, opportunityId, amount });
  } catch (err) {
    if (err instanceof InvestmentError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/investor");
  return { success: true };
}
