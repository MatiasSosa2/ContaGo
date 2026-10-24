-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" DATETIME;

-- AlterTable
ALTER TABLE "EmailChallenge" ADD COLUMN "loginConsumedAt" DATETIME;
