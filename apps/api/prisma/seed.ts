/**
 * PlayPK seed script
 * Seeds: 14 sports + demo company owner, company, branch, courts, and slots.
 */
import { PrismaClient, SlotStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SPORTS = [
  'Cricket',
  'Padel',
  'Futsal',
  'Badminton',
  'Pickleball',
  'Tennis',
  'Squash',
  'Basketball',
  'Volleyball',
  'Table Tennis',
  'Swimming',
  'Gym',
  'Snooker',
  'Bowling',
] as const;

/** Build HH:mm strings for hourly slots between startHour (inclusive) and endHour (exclusive). */
function buildHourlyWindows(
  startHour: number,
  endHour: number,
): Array<{ startTime: string; endTime: string }> {
  const windows: Array<{ startTime: string; endTime: string }> = [];
  for (let hour = startHour; hour < endHour; hour += 1) {
    const startTime = `${String(hour).padStart(2, '0')}:00`;
    const endTime = `${String(hour + 1).padStart(2, '0')}:00`;
    windows.push({ startTime, endTime });
  }
  return windows;
}

/** Return the next `count` calendar dates starting from today (local UTC date at midnight). */
function nextDates(count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    dates.push(d);
  }
  return dates;
}

async function main(): Promise<void> {
  console.log('🌱 Seeding PlayPK database...');

  // ── Sports ──────────────────────────────────────────────────────────────
  const sports = await Promise.all(
    SPORTS.map((name) =>
      prisma.sport.upsert({
        where: { name },
        update: {},
        create: { name, iconUrl: `/icons/sports/${name.toLowerCase().replace(/\s+/g, '-')}.svg` },
      }),
    ),
  );
  console.log(`✓ ${sports.length} sports`);

  const sportByName = Object.fromEntries(sports.map((s) => [s.name, s])) as Record<
    (typeof SPORTS)[number],
    (typeof sports)[number]
  >;

  // ── Demo company owner ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('PlayPK@demo1', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@playpk.demo' },
    update: {
      passwordHash,
      role: UserRole.COMPANY_OWNER,
    },
    create: {
      name: 'Ali Khan',
      email: 'owner@playpk.demo',
      phone: '+923001234567',
      passwordHash,
      role: UserRole.COMPANY_OWNER,
    },
  });
  console.log(`✓ demo owner: ${owner.email}`);

  // ── Demo player ─────────────────────────────────────────────────────────
  const playerHash = await bcrypt.hash('PlayPK@player1', 10);
  const player = await prisma.user.upsert({
    where: { email: 'player@playpk.demo' },
    update: { passwordHash: playerHash },
    create: {
      name: 'Sara Ahmed',
      email: 'player@playpk.demo',
      phone: '+923009876543',
      passwordHash: playerHash,
      role: UserRole.PLAYER,
      loyaltyPoints: 120,
    },
  });
  console.log(`✓ demo player: ${player.email}`);

  // ── Demo company + branch ───────────────────────────────────────────────
  let company = await prisma.company.findFirst({
    where: { ownerId: owner.id, name: 'GameOn Sports' },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        ownerId: owner.id,
        name: 'GameOn Sports',
        description:
          'Premier multi-sport venues across Lahore. Padel, cricket nets, futsal, and more.',
        logoUrl: '/uploads/demo/gameon-logo.png',
      },
    });
  }
  console.log(`✓ company: ${company.name}`);

  let branch = await prisma.branch.findFirst({
    where: { companyId: company.id, name: 'GameOn DHA Phase 5' },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'GameOn DHA Phase 5',
        city: 'Lahore',
        address: '23-K, DHA Phase 5, Lahore',
        latitude: 31.4697,
        longitude: 74.4081,
        operatingHoursStart: '06:00',
        operatingHoursEnd: '23:00',
      },
    });
  }
  console.log(`✓ branch: ${branch.name} (${branch.city})`);

  // ── Courts ──────────────────────────────────────────────────────────────
  const courtDefs = [
    {
      name: 'Padel Court 1',
      sportId: sportByName.Padel.id,
      capacity: 4,
      pricePerHour: 3500,
      indoor: true,
      hasAC: true,
      equipmentAvailable: ['rackets', 'balls'],
    },
    {
      name: 'Padel Court 2',
      sportId: sportByName.Padel.id,
      capacity: 4,
      pricePerHour: 3500,
      indoor: true,
      hasAC: true,
      equipmentAvailable: ['rackets', 'balls'],
    },
    {
      name: 'Futsal Pitch A',
      sportId: sportByName.Futsal.id,
      capacity: 10,
      pricePerHour: 4500,
      indoor: false,
      hasAC: false,
      equipmentAvailable: ['balls'],
    },
    {
      name: 'Cricket Net 1',
      sportId: sportByName.Cricket.id,
      capacity: 6,
      pricePerHour: 2500,
      indoor: false,
      hasAC: false,
      equipmentAvailable: ['batting pads', 'helmets', 'balls'],
    },
    {
      name: 'Badminton Court 1',
      sportId: sportByName.Badminton.id,
      capacity: 4,
      pricePerHour: 1500,
      indoor: true,
      hasAC: true,
      equipmentAvailable: ['rackets', 'shuttlecocks'],
    },
  ] as const;

  const courts = [];
  for (const def of courtDefs) {
    const court = await prisma.court.upsert({
      where: {
        branchId_name: { branchId: branch.id, name: def.name },
      },
      update: {
        pricePerHour: def.pricePerHour,
        capacity: def.capacity,
        indoor: def.indoor,
        hasAC: def.hasAC,
        equipmentAvailable: [...def.equipmentAvailable],
      },
      create: {
        branchId: branch.id,
        sportId: def.sportId,
        name: def.name,
        capacity: def.capacity,
        pricePerHour: def.pricePerHour,
        indoor: def.indoor,
        hasAC: def.hasAC,
        equipmentAvailable: [...def.equipmentAvailable],
        photos: [],
      },
    });
    courts.push(court);
  }
  console.log(`✓ ${courts.length} courts`);

  // ── Slots (next 7 days, 09:00–21:00 hourly) ─────────────────────────────
  const dates = nextDates(7);
  const windows = buildHourlyWindows(9, 21);
  let slotCount = 0;

  for (const court of courts) {
    for (const date of dates) {
      for (const window of windows) {
        await prisma.slot.upsert({
          where: {
            courtId_date_startTime: {
              courtId: court.id,
              date,
              startTime: window.startTime,
            },
          },
          update: {
            endTime: window.endTime,
            price: court.pricePerHour,
            // Keep existing status if already BOOKED; otherwise reset to AVAILABLE for seed refresh
          },
          create: {
            courtId: court.id,
            date,
            startTime: window.startTime,
            endTime: window.endTime,
            status: SlotStatus.AVAILABLE,
            price: court.pricePerHour,
          },
        });
        slotCount += 1;
      }
    }
  }
  console.log(`✓ ${slotCount} slots (upserted)`);

  console.log('\n✅ Seed complete.');
  console.log('Demo accounts:');
  console.log('  Owner:  owner@playpk.demo  / PlayPK@demo1');
  console.log('  Player: player@playpk.demo / PlayPK@player1');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
