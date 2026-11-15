-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'REQUESTED';
ALTER TYPE "AppointmentStatus" ADD VALUE 'UNKNOWN';

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'DISPUTED', 'INSUFFICIENT_EVIDENCE');

-- AlterTable
ALTER TABLE "CompletionVerification" ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9;

-- AddForeignKey
ALTER TABLE "CompletionVerification" ADD CONSTRAINT "CompletionVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
