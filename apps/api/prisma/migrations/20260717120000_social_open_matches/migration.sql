-- Social / open matchmaking
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO');
CREATE TYPE "MatchVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "CasualMatchType" AS ENUM ('COMPETITIVE', 'FRIENDLY');
CREATE TYPE "MatchFormat" AS ENUM ('SINGLES', 'DOUBLES');
CREATE TYPE "OpenMatchStatus" AS ENUM ('OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OpenMatchPlayerStatus" AS ENUM ('JOINED', 'INVITED', 'LEFT', 'DECLINED');

CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL DEFAULT 'BEGINNER',
    "primarySportId" TEXT,
    "bio" TEXT,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpenMatch" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "visibility" "MatchVisibility" NOT NULL DEFAULT 'PUBLIC',
    "matchType" "CasualMatchType" NOT NULL DEFAULT 'FRIENDLY',
    "format" "MatchFormat" NOT NULL DEFAULT 'DOUBLES',
    "skillMin" "SkillLevel" NOT NULL DEFAULT 'BEGINNER',
    "skillMax" "SkillLevel" NOT NULL DEFAULT 'PRO',
    "status" "OpenMatchStatus" NOT NULL DEFAULT 'OPEN',
    "maxPlayers" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpenMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpenMatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OpenMatchPlayerStatus" NOT NULL DEFAULT 'JOINED',
    "side" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpenMatchPlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpenMatchResult" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "winnerSide" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpenMatchResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "matchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialStar" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialStar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactHash" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactHash_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerProfile_userId_key" ON "PlayerProfile"("userId");
CREATE INDEX "PlayerProfile_skillLevel_idx" ON "PlayerProfile"("skillLevel");
CREATE INDEX "PlayerProfile_points_idx" ON "PlayerProfile"("points");

CREATE INDEX "OpenMatch_status_visibility_scheduledAt_idx" ON "OpenMatch"("status", "visibility", "scheduledAt");
CREATE INDEX "OpenMatch_sportId_city_idx" ON "OpenMatch"("sportId", "city");
CREATE INDEX "OpenMatch_hostId_idx" ON "OpenMatch"("hostId");

CREATE UNIQUE INDEX "OpenMatchPlayer_matchId_userId_key" ON "OpenMatchPlayer"("matchId", "userId");
CREATE INDEX "OpenMatchPlayer_userId_status_idx" ON "OpenMatchPlayer"("userId", "status");

CREATE UNIQUE INDEX "OpenMatchResult_matchId_key" ON "OpenMatchResult"("matchId");

CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");
CREATE INDEX "SocialPost_authorId_idx" ON "SocialPost"("authorId");

CREATE UNIQUE INDEX "SocialStar_postId_userId_key" ON "SocialStar"("postId", "userId");
CREATE INDEX "SocialStar_userId_idx" ON "SocialStar"("userId");

CREATE UNIQUE INDEX "ContactHash_userId_phoneHash_key" ON "ContactHash"("userId", "phoneHash");
CREATE INDEX "ContactHash_phoneHash_idx" ON "ContactHash"("phoneHash");

ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_primarySportId_fkey" FOREIGN KEY ("primarySportId") REFERENCES "Sport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpenMatch" ADD CONSTRAINT "OpenMatch_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpenMatch" ADD CONSTRAINT "OpenMatch_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpenMatch" ADD CONSTRAINT "OpenMatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpenMatchPlayer" ADD CONSTRAINT "OpenMatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "OpenMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpenMatchPlayer" ADD CONSTRAINT "OpenMatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpenMatchResult" ADD CONSTRAINT "OpenMatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "OpenMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpenMatchResult" ADD CONSTRAINT "OpenMatchResult_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialStar" ADD CONSTRAINT "SocialStar_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialStar" ADD CONSTRAINT "SocialStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactHash" ADD CONSTRAINT "ContactHash_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
