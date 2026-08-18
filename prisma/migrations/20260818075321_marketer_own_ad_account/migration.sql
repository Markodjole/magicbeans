-- AlterTable
ALTER TABLE "AdvertisingAccount" ADD COLUMN     "marketerId" TEXT;

-- CreateIndex
CREATE INDEX "AdvertisingAccount_marketerId_idx" ON "AdvertisingAccount"("marketerId");

-- AddForeignKey
ALTER TABLE "AdvertisingAccount" ADD CONSTRAINT "AdvertisingAccount_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "InvestorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
