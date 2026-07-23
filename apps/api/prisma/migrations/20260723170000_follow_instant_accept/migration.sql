-- Instant follows: accept any leftover pending rows and default new follows to ACCEPTED
UPDATE "Follow" SET "status" = 'ACCEPTED' WHERE "status" = 'PENDING';
ALTER TABLE "Follow" ALTER COLUMN "status" SET DEFAULT 'ACCEPTED';
