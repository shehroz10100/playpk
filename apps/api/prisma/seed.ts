/**
 * PlayPK seed script
 * Seeds: 14 sports + demo company owner, company, branch, courts, and slots.
 */
import { PrismaClient, SlotStatus, TournamentFormat, TournamentStatus, UserRole } from '@prisma/client';
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

/** Keep in sync with packages/shared-types SPORT_COVER_IMAGES (visually verified). */
const SPORT_COVERS: Record<(typeof SPORTS)[number], string> = {
  Cricket:
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=480&h=720&q=80',
  Padel:
    'https://images.unsplash.com/photo-1767128890576-ecc5c643f9c4?auto=format&fit=crop&w=480&h=720&q=80',
  Futsal:
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=480&h=720&q=80',
  Badminton:
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=480&h=720&q=80',
  Snooker:
    'https://images.unsplash.com/photo-1707916041849-927236f6b4c8?auto=format&fit=crop&w=480&h=720&q=80',
  Gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=480&h=720&q=80',
  Pickleball:
    'https://images.unsplash.com/photo-1693142518820-78d7a05f1546?auto=format&fit=crop&w=480&h=720&q=80',
  Tennis:
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=480&h=720&q=80',
  Squash:
    'https://images.unsplash.com/photo-1740813416102-5d42f408bc85?auto=format&fit=crop&w=480&h=720&q=80',
  Basketball:
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=480&h=720&q=80',
  Volleyball:
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=480&h=720&q=80',
  'Table Tennis':
    'https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=480&h=720&q=80',
  Swimming:
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=480&h=720&q=80',
  Bowling:
    'https://images.unsplash.com/photo-1538511059256-46e76f13f071?auto=format&fit=crop&w=480&h=720&q=80',
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

  // ── Demo player 2 (join-match testing) ──────────────────────────────────
  const player2Hash = await bcrypt.hash('PlayPK@player2', 10);
  const player2 = await prisma.user.upsert({
    where: { email: 'player2@playpk.demo' },
    update: {
      name: 'Ali Raza',
      passwordHash: player2Hash,
      role: UserRole.PLAYER,
    },
    create: {
      name: 'Ali Raza',
      email: 'player2@playpk.demo',
      phone: '+923009876544',
      passwordHash: player2Hash,
      role: UserRole.PLAYER,
      loyaltyPoints: 40,
    },
  });
  console.log(`✓ demo player 2: ${player2.email}`);

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
        bankAccountName: 'GameOn Sports Pvt Ltd',
        bankAccountNumber: '1234567890123',
        bankName: 'HBL',
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
        bankAccountName: 'GameOn Sports Pvt Ltd',
        bankAccountNumber: '1234567890123',
        bankName: 'HBL',
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
        operatingHoursStart: '17:00',
        operatingHoursEnd: '04:00',
        approvalStatus: 'APPROVED',
      },
    });
  } else {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        approvalStatus: 'APPROVED',
        operatingHoursStart: '17:00',
        operatingHoursEnd: '04:00',
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

  // ── 360 Arena (second demo company — visible to owner + customers) ───────
  // Reclaim any existing "360 Arena" company (e.g. registered via dashboard)
  // and ensure it is APPROVED with courts so it shows on the customer list.
  await prisma.company.updateMany({
    where: { name: { equals: '360 Arena', mode: 'insensitive' } },
    data: {
      ownerId: arenaOwner.id,
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      approvedById: admin.id,
      description: '360 Arena sports venues — cricket, padel, and more.',
    },
  });

  let arenaCompany = await prisma.company.findFirst({
    where: { ownerId: arenaOwner.id, name: { equals: '360 Arena', mode: 'insensitive' } },
  });
  if (!arenaCompany) {
    arenaCompany = await prisma.company.findFirst({
      where: { ownerId: arenaOwner.id },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (!arenaCompany) {
    arenaCompany = await prisma.company.create({
      data: {
        ownerId: arenaOwner.id,
        name: '360 Arena',
        description: '360 Arena sports venues — cricket, padel, and more.',
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedById: admin.id,
        commissionPercent: 10,
        bankAccountName: '360 Arena',
        bankAccountNumber: '9876543210987',
        bankName: 'Meezan Bank',
      },
    });
  } else {
    arenaCompany = await prisma.company.update({
      where: { id: arenaCompany.id },
      data: {
        name: '360 Arena',
        ownerId: arenaOwner.id,
        approvalStatus: 'APPROVED',
        approvedAt: arenaCompany.approvedAt ?? new Date(),
        approvedById: arenaCompany.approvedById ?? admin.id,
        description:
          arenaCompany.description ?? '360 Arena sports venues — cricket, padel, and more.',
        commissionPercent: arenaCompany.commissionPercent ?? 10,
        bankAccountName: '360 Arena',
        bankAccountNumber: '9876543210987',
        bankName: 'Meezan Bank',
      },
    });
  }
  console.log(`✓ company: ${arenaCompany.name} (${arenaCompany.approvalStatus})`);

  // Approve every company/branch owned by the 360 demo owner (covers renamed registrations).
  await prisma.company.updateMany({
    where: { ownerId: arenaOwner.id },
    data: {
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      approvedById: admin.id,
    },
  });
  await prisma.branch.updateMany({
    where: { company: { ownerId: arenaOwner.id } },
    data: { approvalStatus: 'APPROVED' },
  });

  let arenaBranch = await prisma.branch.findFirst({
    where: { companyId: arenaCompany.id, name: { equals: '360 Arena', mode: 'insensitive' } },
  });
  if (!arenaBranch) {
    arenaBranch = await prisma.branch.findFirst({
      where: { companyId: arenaCompany.id },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (!arenaBranch) {
    arenaBranch = await prisma.branch.create({
      data: {
        companyId: arenaCompany.id,
        name: '360 Arena',
        city: 'Lahore',
        address: 'Main Boulevard, Gulberg III, Lahore',
        latitude: 31.5102,
        longitude: 74.3441,
        operatingHoursStart: '08:00',
        operatingHoursEnd: '23:00',
        approvalStatus: 'APPROVED',
      },
    });
  } else {
    arenaBranch = await prisma.branch.update({
      where: { id: arenaBranch.id },
      data: {
        name: '360 Arena',
        city: arenaBranch.city || 'Lahore',
        address: arenaBranch.address || 'Main Boulevard, Gulberg III, Lahore',
        approvalStatus: 'APPROVED',
        operatingHoursStart: arenaBranch.operatingHoursStart || '08:00',
        operatingHoursEnd: arenaBranch.operatingHoursEnd || '23:00',
      },
    });
  }
  console.log(`✓ branch: ${arenaBranch.name} (${arenaBranch.city})`);

  const arenaCourtDefs = [
    {
      name: 'Cricket indoor',
      sportId: sportByName.Cricket.id,
      capacity: 12,
      pricePerHour: 1000,
      indoor: true,
      hasAC: true,
      equipmentAvailable: ['batting pads', 'helmets', 'balls'],
    },
    {
      name: 'Padel Court A',
      sportId: sportByName.Padel.id,
      capacity: 4,
      pricePerHour: 3000,
      indoor: true,
      hasAC: true,
      equipmentAvailable: ['rackets', 'balls'],
    },
    {
      name: 'Futsal Court',
      sportId: sportByName.Futsal.id,
      capacity: 10,
      pricePerHour: 4000,
      indoor: false,
      hasAC: false,
      equipmentAvailable: ['balls'],
    },
  ] as const;

  const arenaCourts = [];
  for (const def of arenaCourtDefs) {
    const court = await prisma.court.upsert({
      where: {
        branchId_name: { branchId: arenaBranch.id, name: def.name },
      },
      update: {
        pricePerHour: def.pricePerHour,
        capacity: def.capacity,
        indoor: def.indoor,
        hasAC: def.hasAC,
        equipmentAvailable: [...def.equipmentAvailable],
      },
      create: {
        branchId: arenaBranch.id,
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
    arenaCourts.push(court);
  }
  console.log(`✓ ${arenaCourts.length} 360 Arena courts`);

  let arenaSlotCount = 0;
  for (const court of arenaCourts) {
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
        arenaSlotCount += 1;
      }
    }
  }
  console.log(`✓ ${arenaSlotCount} 360 Arena slots (upserted)`);

  // ── Demo open tournament (customer Events tab) ───────────────────────────
  const padelSport = sportByName.Padel;
  const existingTournament = await prisma.tournament.findFirst({
    where: { branchId: branch.id, name: 'GameOn Padel Open' },
  });
  if (!existingTournament) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 3);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 2);
    await prisma.tournament.create({
      data: {
        branchId: branch.id,
        name: 'GameOn Padel Open',
        sportId: padelSport.id,
        format: TournamentFormat.KNOCKOUT,
        status: TournamentStatus.OPEN,
        entryFee: 1000,
        prizePool: 20000,
        startDate: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())),
        endDate: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())),
        maxParticipants: 16,
        description:
          'Open padel knockout. Register solo or with a team. Entry fee Rs 1,000 (same payment options as court booking).',
      },
    });
    console.log('✓ demo tournament: GameOn Padel Open (Rs 1,000 entry)');
  } else {
    await prisma.tournament.update({
      where: { id: existingTournament.id },
      data: { status: TournamentStatus.OPEN, entryFee: 1000 },
    });
    console.log('✓ demo tournament refreshed: GameOn Padel Open');
  }

  // Social / open-match demo
  const SkillLevel = { BEGINNER: 'BEGINNER', INTERMEDIATE: 'INTERMEDIATE', ADVANCED: 'ADVANCED', PRO: 'PRO' } as const;
  await prisma.playerProfile.upsert({
    where: { userId: player.id },
    create: {
      userId: player.id,
      skillLevel: 'INTERMEDIATE',
      primarySportId: padelSport.id,
      onboardingComplete: true,
      wins: 2,
      losses: 1,
      points: 55,
      matchesPlayed: 3,
      bio: 'Looking for doubles partners in DHA',
    },
    update: {
      skillLevel: 'INTERMEDIATE',
      primarySportId: padelSport.id,
      onboardingComplete: true,
    },
  });

  await prisma.playerProfile.upsert({
    where: { userId: player2.id },
    create: {
      userId: player2.id,
      skillLevel: 'INTERMEDIATE',
      primarySportId: padelSport.id,
      onboardingComplete: true,
      wins: 1,
      losses: 1,
      points: 30,
      matchesPlayed: 2,
      bio: 'Free evenings for open matches',
    },
    update: {
      skillLevel: 'INTERMEDIATE',
      primarySportId: padelSport.id,
      onboardingComplete: true,
    },
  });

  const openCount = await prisma.openMatch.count({
    where: { hostId: player.id, status: { in: ['OPEN', 'FULL'] } },
  });
  if (openCount === 0) {
    await prisma.openMatch.create({
      data: {
        hostId: player.id,
        sportId: padelSport.id,
        branchId: branch.id,
        title: 'Evening open padel · looking for 2',
        notes: 'Friendly doubles. Intermediate preferred.',
        visibility: 'PUBLIC',
        matchType: 'FRIENDLY',
        format: 'DOUBLES',
        skillMin: 'BEGINNER',
        skillMax: 'ADVANCED',
        status: 'OPEN',
        maxPlayers: 4,
        city: 'Lahore',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        players: {
          create: { userId: player.id, status: 'JOINED', side: 'HOME' },
        },
      },
    });
    console.log('✓ demo open match seeded');
  }

  await prisma.socialPost.createMany({
    data: [
      {
        authorId: player.id,
        body: 'Anyone up for padel in DHA this week? Open match posted in Play.',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✓ social profile + feed seed');
  void SkillLevel;

  console.log('\n✅ Seed complete.');
  console.log('Demo accounts:');
  console.log('  Admin:         admin@playpk.demo       / PlayPK@admin1');
  console.log('  GameOn owner:  owner@playpk.demo       / PlayPK@demo1');
  console.log('  360 Arena:     owner360@playpk.demo    / PlayPK@3601');
  console.log('  Player 1:      player@playpk.demo      / PlayPK@player1');
  console.log('  Player 2:      player2@playpk.demo     / PlayPK@player2');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
