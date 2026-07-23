-- CreateTable
CREATE TABLE "SportDiscount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "percentOff" DECIMAL(5,2) NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SportDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SportDiscount_companyId_active_idx" ON "SportDiscount"("companyId", "active");

-- CreateIndex
CREATE INDEX "SportDiscount_sportId_idx" ON "SportDiscount"("sportId");

-- CreateIndex
CREATE UNIQUE INDEX "SportDiscount_companyId_sportId_key" ON "SportDiscount"("companyId", "sportId");

-- AddForeignKey
ALTER TABLE "SportDiscount" ADD CONSTRAINT "SportDiscount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportDiscount" ADD CONSTRAINT "SportDiscount_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
