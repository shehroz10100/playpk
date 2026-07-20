-- AlterEnum MatchFormat
ALTER TYPE "MatchFormat" ADD VALUE 'EIGHT_A_SIDE';
ALTER TYPE "MatchFormat" ADD VALUE 'TEN_A_SIDE';
ALTER TYPE "MatchFormat" ADD VALUE 'FOURTEEN_A_SIDE';

-- Tournament host (customer-created tournaments)
ALTER TABLE "Tournament" ADD COLUMN "hostUserId" TEXT;
CREATE INDEX "Tournament_hostUserId_idx" ON "Tournament"("hostUserId");
ALTER TABLE "Tournament"
  ADD CONSTRAINT "Tournament_hostUserId_fkey"
  FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Social comments
CREATE TABLE "SocialComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialComment_postId_createdAt_idx" ON "SocialComment"("postId", "createdAt");
CREATE INDEX "SocialComment_userId_idx" ON "SocialComment"("userId");

ALTER TABLE "SocialComment"
  ADD CONSTRAINT "SocialComment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialComment"
  ADD CONSTRAINT "SocialComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
