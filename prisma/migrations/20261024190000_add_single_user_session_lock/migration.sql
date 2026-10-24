-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeSessionId" TEXT;
ALTER TABLE "User" ADD COLUMN "activeSessionExpiresAt" DATETIME;
