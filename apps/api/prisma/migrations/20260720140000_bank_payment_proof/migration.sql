-- Company bank details for advance bank transfers
ALTER TABLE "Company" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankName" TEXT;

-- Booking payment proof (customer screenshot)
ALTER TABLE "Booking" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paymentProofUrl" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paymentProofUploadedAt" TIMESTAMP(3);
