-- CreateEnum
CREATE TYPE "MatchGenderPreference" AS ENUM ('MEN', 'WOMEN', 'MIXED', 'ANY');

-- AlterTable
ALTER TABLE "OpenMatch" ADD COLUMN "genderPreference" "MatchGenderPreference" NOT NULL DEFAULT 'ANY';
ALTER TABLE "OpenMatch" ADD COLUMN "pricePerPlayer" DECIMAL(10,2);
