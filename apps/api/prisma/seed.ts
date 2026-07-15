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
  'Snooker',
  'Gym',
  'Pickleball',
  'Tennis',
  'Squash',
  'Basketball',
  'Volleyball',
  'Table Tennis',
  'Swimming',
  'Bowling',
] as const;

const SPORT_COVERS: Record<(typeof SPORTS)[number], string> = {
  Cricket:
    'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=480&h=720&q=80',
  Padel:
    'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=480&h=720&q=80',
  Futsal:
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=480&h=720&q=80',
  Badminton:
    'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=480&h=720&q=80',
  Snooker:
    'https://images.unsplash.com/photo-1611293388250-580b08c4a145?auto=format&fit=crop&w=480&h=720&q=80',
  Gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=480&h=720&q=80',
  Pickleball:
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=480&h=720&q=80',
  Tennis:
    'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=480&h=720&q=80',
  Squash:
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=480&h=720&q=80',
  Basketball:
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=480&h=720&q=80',
  Volleyball:
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=480&h=720&q=80',
  'Table Tennis':
    'https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=480&h=720&q=80',
  Swimming:
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=480&h=720&q=80',
  Bowling:
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=480&h=720&q=80',
};

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
        update: { iconUrl: SPORT_COVERS[name] },
        create: { name, iconUrl: SPORT_COVERS[name] },
      }),
    ),
  );
  console.log(`✓ ${sports.length} sports`);

  const sportByName = Object.fromEntries(sports.map((s) => [s.name, s])) as Record<
    (typeof SPORTS)[number],
    (typeof sports)[number]
  >;

  // ── Demo company owners (one account per company) ───────────────────────
  const passwordHash = await bcrypt.hash('PlayPK@demo1', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@playpk.demo' },
    update: {
      name: 'GameOn Owner',
      passwordHash,
      role: UserRole.COMPANY_OWNER,
    },
    create: {
      name: 'GameOn Owner',
      email: 'owner@playpk.demo',
      phone: '+923001234567',
      passwordHash,
      role: UserRole.COMPANY_OWNER,
    },
  });
  console.log(`✓ GameOn owner: ${owner.email}`);

  const arenaHash = await bcrypt.hash('PlayPK@3601', 10);
  const arenaOwner = await prisma.user.upsert({
    where: { email: 'owner360@playpk.demo' },
    update: {
      name: '360 Arena Owner',
      passwordHash: arenaHash,
      role: UserRole.COMPANY_OWNER,
    },
    create: {
      name: '360 Arena Owner',
      email: 'owner360@playpk.demo',
      phone: '+923001111360',
      passwordHash: arenaHash,
      role: UserRole.COMPANY_OWNER,
    },
  });
  console.log(`✓ 360 Arena owner: ${arenaOwner.email}`);

  // If a 360 Arena company already exists (created via dashboard), keep it
  // owned by the dedicated owner account — do not merge into GameOn.
  await prisma.company.updateMany({
    where: { name: '360 Arena' },
    data: {
      ownerId: arenaOwner.id,
      approvalStatus: 'APPROVED',
      description: '360 Arena sports venues',
    },
  });
  await prisma.branch.updateMany({
    where: { name: '360 Arena' },
    data: { approvalStatus: 'APPROVED' },
  });

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

  // ── Platform admin ──────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('PlayPK@admin1', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@playpk.demo' },
    update: { passwordHash: adminHash, role: UserRole.ADMIN, suspendedAt: null },
    create: {
      name: 'PlayPK Admin',
      email: 'admin@playpk.demo',
      phone: '+923000000001',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
    },
  });
  console.log(`✓ demo admin: ${admin.email}`);

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
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedById: admin.id,
        commissionPercent: 10,
      },
    });
  } else {
    company = await prisma.company.update({
      where: { id: company.id },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: company.approvedAt ?? new Date(),
        approvedById: company.approvedById ?? admin.id,
        commissionPercent: company.commissionPercent ?? 10,
      },
    });
  }
  console.log(`✓ company: ${company.name} (${company.approvalStatus})`);

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
        approvalStatus: 'APPROVED',
      },
    });
  } else {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: { approvalStatus: 'APPROVED' },
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
  console.log('  Admin:         admin@playpk.demo       / PlayPK@admin1');
  console.log('  GameOn owner:  owner@playpk.demo       / PlayPK@demo1');
  console.log('  360 Arena:     owner360@playpk.demo    / PlayPK@3601');
  console.log('  Player:        player@playpk.demo      / PlayPK@player1');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
