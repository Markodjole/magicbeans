"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireDeveloperProfile } from "@/lib/authz";
import { getOrCreateConnection } from "@/lib/integrations/provider-factory";
import { getAppPerformanceSummary } from "@/lib/queries/developer";
import { computeRiskScoreForOpportunity } from "@/lib/engine/risk-score";
import { openFundingTerms } from "@/lib/engine/funding-terms";
import type { IntegrationCategory, IntegrationProvider } from "@/generated/prisma/client";

const CreateAppSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1),
  description: z.string().max(2000).optional(),
  appStoreUrl: z.string().url().optional().or(z.literal("")),
  googlePlayUrl: z.string().url().optional().or(z.literal("")),
  pricingModel: z.enum(["subscription", "one_time", "freemium"]),
  subscriptionPrice: z.coerce.number().min(0).optional(),
});

export async function createApp(_prevState: { error?: string; appId?: string }, formData: FormData) {
  const profile = await requireDeveloperProfile();
  const parsed = CreateAppSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    appStoreUrl: formData.get("appStoreUrl") || "",
    googlePlayUrl: formData.get("googlePlayUrl") || "",
    pricingModel: formData.get("pricingModel"),
    subscriptionPrice: formData.get("subscriptionPrice") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const app = await prisma.app.create({
    data: {
      developerId: profile.id,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      appStoreUrl: parsed.data.appStoreUrl || undefined,
      googlePlayUrl: parsed.data.googlePlayUrl || undefined,
      pricingModel: parsed.data.pricingModel,
      subscriptionPrice: parsed.data.subscriptionPrice,
    },
  });

  revalidatePath("/developer");
  return { appId: app.id };
}

/**
 * "Use Demo Data" for any onboarding step. Creates (or reuses) a MOCK
 * IntegrationConnection; for advertising, also ensures there's an
 * AdvertisingAccount + MarketingCampaign so the mock provider chain has
 * something to generate metrics against.
 */
export async function connectDemoIntegration(
  appId: string,
  category: IntegrationCategory,
  provider: IntegrationProvider,
  campaignName?: string,
  dailyBudget?: number
) {
  const profile = await requireDeveloperProfile();
  const app = await prisma.app.findFirstOrThrow({ where: { id: appId, developerId: profile.id } });

  const connection = await getOrCreateConnection(appId, category, provider);

  if (category === "ADVERTISING") {
    const existingAccount = await prisma.advertisingAccount.findFirst({ where: { appId, provider } });
    const account =
      existingAccount ??
      (await prisma.advertisingAccount.create({
        data: {
          appId,
          integrationConnectionId: connection.id,
          provider,
          externalAccountId: `mock-${provider.toLowerCase()}-${appId}`,
          name: `${provider} Demo Account`,
        },
      }));

    const existingCampaign = await prisma.marketingCampaign.findFirst({ where: { appId, provider } });
    if (!existingCampaign) {
      await prisma.marketingCampaign.create({
        data: {
          appId,
          advertisingAccountId: account.id,
          provider,
          externalCampaignId: `mock-campaign-${appId}`,
          name: campaignName ?? `${app.name} ${provider} Growth Campaign`,
          dailyBudget: dailyBudget ?? 100,
          status: "ACTIVE",
          startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
          isMock: true,
        },
      });
    }
  }

  revalidatePath(`/developer/apps/${appId}`);
  return { connectionId: connection.id };
}

const FundingTermsSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  minimumInvestment: z.coerce.number().positive().default(50),
  investorRevenueSharePercent: z.coerce.number().min(1).max(99),
  returnCapMultiple: z.coerce.number().min(1).max(10),
});

/**
 * Sets a developer's standing revenue-share terms for an app — applies to
 * whatever marketing campaigns the app runs, on any channel, from here on.
 * There is no funding target and no threshold to hit: investing starts
 * earning the moment money comes in (see attribution-revenue-engine.ts).
 *
 * Changing terms never edits the existing row. If the app already has an
 * OPEN terms row, it's superseded (endDate set) and a new PENDING_APPROVAL
 * row is created — every existing Investment keeps pointing at whichever
 * row it was made under, so past investors keep exactly what they signed
 * up for; only new money gets the new terms.
 */
export async function setFundingTerms(_prevState: { error?: string; opportunityId?: string }, formData: FormData) {
  const profile = await requireDeveloperProfile();
  const appId = formData.get("appId") as string;
  // Ownership check — throws if this app doesn't belong to the caller.
  await prisma.app.findFirstOrThrow({ where: { id: appId, developerId: profile.id } });

  const parsed = FundingTermsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    minimumInvestment: formData.get("minimumInvestment") || 50,
    investorRevenueSharePercent: formData.get("investorRevenueSharePercent"),
    returnCapMultiple: formData.get("returnCapMultiple"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const performance = await getAppPerformanceSummary(appId, 30);

  const { opportunityId } = await openFundingTerms({
    appId,
    title: parsed.data.title,
    description: parsed.data.description,
    minimumInvestment: parsed.data.minimumInvestment,
    investorRevenueSharePercent: parsed.data.investorRevenueSharePercent,
    returnCapMultiple: parsed.data.returnCapMultiple,
    historicalROAS: performance.roas || 1.5,
    historicalCAC: performance.cac || undefined,
    historicalLTV: performance.roas > 0 ? performance.cac * performance.roas : undefined,
  });

  await computeRiskScoreForOpportunity(opportunityId);

  revalidatePath("/developer");
  redirect(`/developer/apps/${appId}`);
}
