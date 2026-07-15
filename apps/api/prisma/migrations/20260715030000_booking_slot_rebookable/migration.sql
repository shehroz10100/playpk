-- Allow rebooking a slot after cancellation (history rows keep the same slotId).
-- Active bookings are unique per slot via a partial unique index.

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_slotId_key";
DROP INDEX IF EXISTS "Booking_slotId_key";

CREATE INDEX IF NOT EXISTS "Booking_slotId_idx" ON "Booking"("slotId");

DROP INDEX IF EXISTS "Booking_active_slot_uidx";
CREATE UNIQUE INDEX "Booking_active_slot_uidx"
  ON "Booking"("slotId")
  WHERE "status" <> 'CANCELLED';
