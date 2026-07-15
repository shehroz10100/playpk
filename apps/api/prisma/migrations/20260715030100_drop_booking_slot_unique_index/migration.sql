-- Unique index name persisted from Prisma @unique; DROP CONSTRAINT alone did not remove it.
DROP INDEX IF EXISTS "Booking_slotId_key";

-- Keep partial unique index for active bookings only
DROP INDEX IF EXISTS "Booking_active_slot_uidx";
CREATE UNIQUE INDEX "Booking_active_slot_uidx"
  ON "Booking"("slotId")
  WHERE "status" <> 'CANCELLED';
