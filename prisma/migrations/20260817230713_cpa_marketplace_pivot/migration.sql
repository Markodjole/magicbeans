-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'OPEN', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConversionEvent" AS ENUM ('VERIFIED_SUBSCRIBER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'CONVERSION_PAYOUT_OWED';
ALTER TYPE "LedgerEntryType" ADD VALUE 'MARKETPLACE_FEE';
ALTER TYPE "LedgerEntryType" ADD VALUE 'MARKETER_PAYOUT';

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "campaignId" TEXT;

-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN     "creativeId" TEXT,
ADD COLUMN     "declaredBudget" DECIMAL(12,2),
ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "launchedAt" TIMESTAMP(3),
ADD COLUMN     "marketerId" TEXT,
ADD COLUMN     "offerId" TEXT,
ADD COLUMN     "targetingTemplateId" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "PerformanceOffer" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conversionEvent" "ConversionEvent" NOT NULL DEFAULT 'VERIFIED_SUBSCRIBER',
    "payoutPerConversion" DECIMAL(10,2) NOT NULL,
    "marketplaceFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "minBudget" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "maxBudget" DECIMAL(10,2),
    "historicalCPA" DECIMAL(10,2),
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferCreative" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "IntegrationProvider" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferTargetingTemplate" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "IntegrationProvider" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferTargetingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignConversion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "appCustomerId" TEXT NOT NULL,
    "revenueAttributionId" TEXT NOT NULL,
    "grossPayout" DECIMAL(10,2) NOT NULL,
    "marketplaceFee" DECIMAL(10,2) NOT NULL,
    "netPayout" DECIMAL(10,2) NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceOffer_appId_idx" ON "PerformanceOffer"("appId");

-- CreateIndex
CREATE INDEX "PerformanceOffer_status_idx" ON "PerformanceOffer"("status");

-- CreateIndex
CREATE INDEX "OfferCreative_offerId_idx" ON "OfferCreative"("offerId");

-- CreateIndex
CREATE INDEX "OfferTargetingTemplate_offerId_idx" ON "OfferTargetingTemplate"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignConversion_revenueAttributionId_key" ON "CampaignConversion"("revenueAttributionId");

-- CreateIndex
CREATE INDEX "CampaignConversion_campaignId_idx" ON "CampaignConversion"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignConversion_campaignId_appCustomerId_key" ON "CampaignConversion"("campaignId", "appCustomerId");

-- CreateIndex
CREATE INDEX "LedgerEntry_campaignId_idx" ON "LedgerEntry"("campaignId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_marketerId_idx" ON "MarketingCampaign"("marketerId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_offerId_idx" ON "MarketingCampaign"("offerId");

-- CreateIndex
CREATE INDEX "Payout_campaignId_idx" ON "Payout"("campaignId");

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "InvestorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PerformanceOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "OfferCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_targetingTemplateId_fkey" FOREIGN KEY ("targetingTemplateId") REFERENCES "OfferTargetingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceOffer" ADD CONSTRAINT "PerformanceOffer_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferCreative" ADD CONSTRAINT "OfferCreative_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PerformanceOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferTargetingTemplate" ADD CONSTRAINT "OfferTargetingTemplate_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PerformanceOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversion" ADD CONSTRAINT "CampaignConversion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversion" ADD CONSTRAINT "CampaignConversion_appCustomerId_fkey" FOREIGN KEY ("appCustomerId") REFERENCES "AppCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignConversion" ADD CONSTRAINT "CampaignConversion_revenueAttributionId_fkey" FOREIGN KEY ("revenueAttributionId") REFERENCES "RevenueAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
