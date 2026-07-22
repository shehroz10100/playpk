-- Walk-in booking + white-label pricing (additive)
-- ALTER TYPE … ADD VALUE cannot run inside a Prisma transaction on Postgres.
-- prisma:disable-transaction

-- UserRole extensions
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FRONT_DESK';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GUEST';

DO $$ BEGIN CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'WALK_IN', 'PHONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PricingDayType" AS ENUM ('WEEKDAY', 'WEEKEND', 'HOLIDAY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PricingChannel" AS ENUM ('ONLINE', 'WALK_IN', 'BOTH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "bookingSource" "BookingSource" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "createdByStaffId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;

CREATE INDEX IF NOT EXISTS "Booking_bookingSource_idx" ON "Booking"("bookingSource");
CREATE INDEX IF NOT EXISTS "Booking_createdByStaffId_idx" ON "Booking"("createdByStaffId");

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByStaffId_fkey"
    FOREIGN KEY ("createdByStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PricingRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "courtId" TEXT,
    "sportId" TEXT,
    "dayType" "PricingDayType" NOT NULL,
    "timeRangeStart" TEXT NOT NULL,
    "timeRangeEnd" TEXT NOT NULL,
    "channel" "PricingChannel" NOT NULL DEFAULT 'BOTH',
    "priceOverride" DECIMAL(12,2),
    "priceMultiplier" DECIMAL(8,4),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PricingRule_companyId_active_priority_idx" ON "PricingRule"("companyId", "active", "priority");
CREATE INDEX IF NOT EXISTS "PricingRule_branchId_idx" ON "PricingRule"("branchId");
CREATE INDEX IF NOT EXISTS "PricingRule_courtId_idx" ON "PricingRule"("courtId");
CREATE INDEX IF NOT EXISTS "PricingRule_sportId_idx" ON "PricingRule"("sportId");
CREATE INDEX IF NOT EXISTS "PricingRule_channel_idx" ON "PricingRule"("channel");

DO $$ BEGIN
  ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BrandingSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#00A651',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0B1F3A',
    "businessName" TEXT,
    "receiptFooterText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandingSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrandingSettings_companyId_key" ON "BrandingSettings"("companyId");
DO $$ BEGIN
  ALTER TABLE "BrandingSettings" ADD CONSTRAINT "BrandingSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
