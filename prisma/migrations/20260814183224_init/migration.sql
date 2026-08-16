-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INVESTOR', 'DEVELOPER', 'ADMIN');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('LIVE', 'MOCK', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "IntegrationCategory" AS ENUM ('ADVERTISING', 'ATTRIBUTION', 'REVENUE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('TIKTOK', 'META', 'GOOGLE_ADS', 'APPSFLYER', 'ADJUST', 'REVENUECAT', 'APPLE', 'GOOGLE_PLAY', 'STRIPE', 'DEMO');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'OPEN', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvestmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AttributionConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNATTRIBUTED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INVESTMENT_DEPOSIT', 'CAMPAIGN_ALLOCATION', 'AD_SPEND', 'ATTRIBUTED_REVENUE', 'INVESTOR_REVENUE_SHARE', 'DEVELOPER_REVENUE_SHARE', 'PLATFORM_FEE', 'INVESTOR_PAYOUT', 'REFUND', 'REVERSAL');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('ADVERTISING', 'ATTRIBUTION', 'REVENUE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "appStoreUrl" TEXT,
    "googlePlayUrl" TEXT,
    "pricingModel" TEXT,
    "subscriptionPrice" DECIMAL(12,2),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "category" "IntegrationCategory" NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "mode" "IntegrationMode" NOT NULL DEFAULT 'MOCK',
    "externalAccountId" TEXT,
    "credentialsEncrypted" TEXT,
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAccount" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AdvertisingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "advertisingAccountId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dailyBudget" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignDailyMetric" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "conversions" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" "IntegrationProvider" NOT NULL,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL DEFAULT 'API',
    "isMock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CampaignDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributedInstall" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "campaignId" TEXT,
    "externalUserId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "mediaSource" TEXT NOT NULL,
    "campaignName" TEXT,
    "adGroupId" TEXT,
    "adId" TEXT,
    "country" TEXT,
    "attributionProvider" "IntegrationProvider" NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "appCustomerId" TEXT,

    CONSTRAINT "AttributedInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributedEvent" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "campaignId" TEXT,
    "externalUserId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "revenue" DECIMAL(12,2),
    "currency" TEXT,
    "attributionProvider" "IntegrationProvider" NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AttributedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppCustomer" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "externalUserId" TEXT,
    "country" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppTransaction" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appCustomerId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "refundedAt" TIMESTAMP(3),
    "platform" "Platform" NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'REVENUECAT',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueAttribution" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "investmentId" TEXT,
    "attributionProvider" "IntegrationProvider" NOT NULL,
    "confidence" "AttributionConfidence" NOT NULL,
    "attributedAmount" DECIMAL(12,2) NOT NULL,
    "attributionMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversalOfId" TEXT,

    CONSTRAINT "RevenueAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentOpportunity" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountFunded" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minimumInvestment" DECIMAL(12,2) NOT NULL DEFAULT 50,
    "investorRevenueSharePercent" DECIMAL(5,2) NOT NULL,
    "developerRevenueSharePercent" DECIMAL(5,2) NOT NULL,
    "returnCapMultiple" DECIMAL(5,2) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DRAFT',
    "historicalROAS" DECIMAL(6,3),
    "historicalCAC" DECIMAL(10,2),
    "historicalLTV" DECIMAL(10,2),
    "riskScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "principalAmount" DECIMAL(12,2) NOT NULL,
    "capitalDeployed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "attributableRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "investorRevenueEarned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "developerRevenueEarned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaidToInvestor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentReturnMultiple" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "status" "InvestmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalAllocation" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CapitalAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueShareAccrual" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "revenueAttributionId" TEXT NOT NULL,
    "investorAmount" DECIMAL(12,2) NOT NULL,
    "developerAmount" DECIMAL(12,2) NOT NULL,
    "accruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "RevenueShareAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "investmentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'DEMO',
    "externalPayoutId" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "investmentId" TEXT,
    "opportunityId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "positives" JSONB NOT NULL,
    "negatives" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "jobType" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "lastSuccessfulSync" TIMESTAMP(3),
    "lastAttemptedSync" TIMESTAMP(3),
    "error" TEXT,
    "recordsImported" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProfile_userId_key" ON "InvestorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperProfile_userId_key" ON "DeveloperProfile"("userId");

-- CreateIndex
CREATE INDEX "App_developerId_idx" ON "App"("developerId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_appId_idx" ON "IntegrationConnection"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_appId_category_provider_key" ON "IntegrationConnection"("appId", "category", "provider");

-- CreateIndex
CREATE INDEX "AdvertisingAccount_appId_idx" ON "AdvertisingAccount"("appId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_appId_idx" ON "MarketingCampaign"("appId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_advertisingAccountId_idx" ON "MarketingCampaign"("advertisingAccountId");

-- CreateIndex
CREATE INDEX "CampaignDailyMetric_campaignId_date_idx" ON "CampaignDailyMetric"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDailyMetric_campaignId_date_key" ON "CampaignDailyMetric"("campaignId", "date");

-- CreateIndex
CREATE INDEX "AttributedInstall_appId_idx" ON "AttributedInstall"("appId");

-- CreateIndex
CREATE INDEX "AttributedInstall_campaignId_idx" ON "AttributedInstall"("campaignId");

-- CreateIndex
CREATE INDEX "AttributedInstall_externalUserId_idx" ON "AttributedInstall"("externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributedInstall_appId_externalUserId_key" ON "AttributedInstall"("appId", "externalUserId");

-- CreateIndex
CREATE INDEX "AttributedEvent_appId_idx" ON "AttributedEvent"("appId");

-- CreateIndex
CREATE INDEX "AttributedEvent_campaignId_idx" ON "AttributedEvent"("campaignId");

-- CreateIndex
CREATE INDEX "AttributedEvent_externalUserId_idx" ON "AttributedEvent"("externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributedEvent_appId_externalUserId_eventName_eventTime_key" ON "AttributedEvent"("appId", "externalUserId", "eventName", "eventTime");

-- CreateIndex
CREATE INDEX "AppCustomer_appId_idx" ON "AppCustomer"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "AppCustomer_appId_appUserId_key" ON "AppCustomer"("appId", "appUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AppTransaction_transactionId_key" ON "AppTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "AppTransaction_appId_idx" ON "AppTransaction"("appId");

-- CreateIndex
CREATE INDEX "AppTransaction_appCustomerId_idx" ON "AppTransaction"("appCustomerId");

-- CreateIndex
CREATE INDEX "AppTransaction_purchasedAt_idx" ON "AppTransaction"("purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueAttribution_reversalOfId_key" ON "RevenueAttribution"("reversalOfId");

-- CreateIndex
CREATE INDEX "RevenueAttribution_campaignId_idx" ON "RevenueAttribution"("campaignId");

-- CreateIndex
CREATE INDEX "RevenueAttribution_investmentId_idx" ON "RevenueAttribution"("investmentId");

-- CreateIndex
CREATE INDEX "RevenueAttribution_transactionId_idx" ON "RevenueAttribution"("transactionId");

-- CreateIndex
CREATE INDEX "InvestmentOpportunity_appId_idx" ON "InvestmentOpportunity"("appId");

-- CreateIndex
CREATE INDEX "InvestmentOpportunity_status_idx" ON "InvestmentOpportunity"("status");

-- CreateIndex
CREATE INDEX "Investment_investorId_idx" ON "Investment"("investorId");

-- CreateIndex
CREATE INDEX "Investment_opportunityId_idx" ON "Investment"("opportunityId");

-- CreateIndex
CREATE INDEX "Investment_status_idx" ON "Investment"("status");

-- CreateIndex
CREATE INDEX "CapitalAllocation_investmentId_idx" ON "CapitalAllocation"("investmentId");

-- CreateIndex
CREATE INDEX "CapitalAllocation_campaignId_idx" ON "CapitalAllocation"("campaignId");

-- CreateIndex
CREATE INDEX "RevenueShareAccrual_investmentId_idx" ON "RevenueShareAccrual"("investmentId");

-- CreateIndex
CREATE INDEX "Payout_investorId_idx" ON "Payout"("investorId");

-- CreateIndex
CREATE INDEX "Payout_investmentId_idx" ON "Payout"("investmentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_investmentId_idx" ON "LedgerEntry"("investmentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_opportunityId_idx" ON "LedgerEntry"("opportunityId");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_idx" ON "LedgerEntry"("type");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_opportunityId_key" ON "RiskAssessment"("opportunityId");

-- CreateIndex
CREATE INDEX "SyncJob_integrationConnectionId_idx" ON "SyncJob"("integrationConnectionId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalEventId_key" ON "WebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "InvestorProfile" ADD CONSTRAINT "InvestorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperProfile" ADD CONSTRAINT "DeveloperProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "DeveloperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAccount" ADD CONSTRAINT "AdvertisingAccount_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAccount" ADD CONSTRAINT "AdvertisingAccount_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_advertisingAccountId_fkey" FOREIGN KEY ("advertisingAccountId") REFERENCES "AdvertisingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDailyMetric" ADD CONSTRAINT "CampaignDailyMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributedInstall" ADD CONSTRAINT "AttributedInstall_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributedInstall" ADD CONSTRAINT "AttributedInstall_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributedInstall" ADD CONSTRAINT "AttributedInstall_appCustomerId_fkey" FOREIGN KEY ("appCustomerId") REFERENCES "AppCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributedEvent" ADD CONSTRAINT "AttributedEvent_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributedEvent" ADD CONSTRAINT "AttributedEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppCustomer" ADD CONSTRAINT "AppCustomer_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppTransaction" ADD CONSTRAINT "AppTransaction_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppTransaction" ADD CONSTRAINT "AppTransaction_appCustomerId_fkey" FOREIGN KEY ("appCustomerId") REFERENCES "AppCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueAttribution" ADD CONSTRAINT "RevenueAttribution_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "AppTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueAttribution" ADD CONSTRAINT "RevenueAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueAttribution" ADD CONSTRAINT "RevenueAttribution_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueAttribution" ADD CONSTRAINT "RevenueAttribution_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "RevenueAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOpportunity" ADD CONSTRAINT "InvestmentOpportunity_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalAllocation" ADD CONSTRAINT "CapitalAllocation_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalAllocation" ADD CONSTRAINT "CapitalAllocation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueShareAccrual" ADD CONSTRAINT "RevenueShareAccrual_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueShareAccrual" ADD CONSTRAINT "RevenueShareAccrual_revenueAttributionId_fkey" FOREIGN KEY ("revenueAttributionId") REFERENCES "RevenueAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "InvestorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
