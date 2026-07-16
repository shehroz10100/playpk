import { z } from 'zod';
import { Router } from 'express';
import { TournamentFormat, TournamentStatus, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageBranch } from '../services/access.service';
import * as tournamentService from '../services/tournament.service';
import * as teamService from '../services/team.service';

export const tournamentsRouter = Router();
export const teamsRouter = Router();
export const leaderboardRouter = Router();

// ─── Public / player tournament browse ───────────────────────────────────────

tournamentsRouter.get('/', async (req, res, next) => {
  try {
    const q = z
      .object({
        branchId: z.string().optional(),
        sportId: z.string().optional(),
        city: z.string().optional(),
        status: z.nativeEnum(TournamentStatus).optional(),
        minFee: z.coerce.number().min(0).optional(),
        maxFee: z.coerce.number().min(0).optional(),
        dateFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD')
          .optional(),
        dateTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD')
          .optional(),
      })
      .parse(req.query);
    const data = await tournamentService.listTournaments(q);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

tournamentsRouter.get('/:tournamentId', async (req, res, next) => {
  try {
    const data = await tournamentService.getTournament(param(req, 'tournamentId'));
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

tournamentsRouter.get('/:tournamentId/standings', async (req, res, next) => {
  try {
    const data = await tournamentService.getStandings(param(req, 'tournamentId'));
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

tournamentsRouter.post(
  '/',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(
    z.object({
      branchId: z.string().min(1),
      name: z.string().min(2).max(120),
      sportId: z.string().min(1),
      format: z.nativeEnum(TournamentFormat),
      entryFee: z.number().min(0),
      prizePool: z.number().min(0).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      maxParticipants: z.number().int().positive().optional(),
      description: z.string().max(2000).optional(),
      status: z.nativeEnum(TournamentStatus).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      await assertCanManageBranch(req.user!, req.body.branchId);
      const data = await tournamentService.createTournament(req.body);
      sendSuccess(res, data, 201);
    } catch (error) {
      next(error);
    }
  },
);

tournamentsRouter.patch(
  '/:tournamentId',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(
    z.object({
      name: z.string().min(2).max(120).optional(),
      entryFee: z.number().min(0).optional(),
      prizePool: z.number().min(0).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      maxParticipants: z.number().int().positive().nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      status: z.nativeEnum(TournamentStatus).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const existing = await prisma.tournament.findUnique({
        where: { id: param(req, 'tournamentId') },
      });
      if (!existing) {
        throw new AppError('Tournament not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, existing.branchId);
      const data = await tournamentService.updateTournament(existing.id, req.body);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

tournamentsRouter.post(
  '/:tournamentId/register',
  authenticate,
  validate(
    z.object({
      teamId: z.string().optional(),
      teamName: z.string().min(2).max(80).optional(),
      teammateContacts: z.array(z.string().min(3).max(120)).max(12).optional(),
      playerName: z.string().min(2).max(80).optional(),
      paymentMethod: z.enum(['mock', 'wallet', 'jazzcash', 'easypaisa', 'card']).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await tournamentService.registerForTournament({
        tournamentId: param(req, 'tournamentId'),
        userId: req.user!.id,
        teamId: req.body.teamId,
        teamName: req.body.teamName,
        teammateContacts: req.body.teammateContacts,
        playerName: req.body.playerName,
        paymentMethod: req.body.paymentMethod,
      });
      sendSuccess(res, data, 201);
    } catch (error) {
      next(error);
    }
  },
);

tournamentsRouter.post(
  '/:tournamentId/fixtures/generate',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const existing = await prisma.tournament.findUnique({
        where: { id: param(req, 'tournamentId') },
      });
      if (!existing) {
        throw new AppError('Tournament not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, existing.branchId);
      const data = await tournamentService.generateKnockoutFixtures(existing.id);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

tournamentsRouter.post(
  '/matches/:matchId/result',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(
    z.object({
      homeScore: z.number().int().min(0),
      awayScore: z.number().int().min(0),
    }),
  ),
  async (req, res, next) => {
    try {
      const match = await prisma.tournamentMatch.findUnique({
        where: { id: param(req, 'matchId') },
        include: { tournament: true },
      });
      if (!match) {
        throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, match.tournament.branchId);
      const data = await tournamentService.recordMatchResult({
        matchId: match.id,
        homeScore: req.body.homeScore,
        awayScore: req.body.awayScore,
      });
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

// ─── Teams ───────────────────────────────────────────────────────────────────

teamsRouter.post(
  '/',
  authenticate,
  validate(
    z.object({
      name: z.string().min(2).max(80),
      sportId: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await teamService.createTeam({
        captainId: req.user!.id,
        name: req.body.name,
        sportId: req.body.sportId,
      });
      sendSuccess(res, data, 201);
    } catch (error) {
      next(error);
    }
  },
);

teamsRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const data = await teamService.listMyTeams(req.user!.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

teamsRouter.get('/invites/me', authenticate, async (req, res, next) => {
  try {
    const data = await teamService.listMyInvites(req.user!.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

teamsRouter.get('/:teamId', authenticate, async (req, res, next) => {
  try {
    const data = await teamService.getTeam(param(req, 'teamId'));
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

teamsRouter.post(
  '/:teamId/invites',
  authenticate,
  validate(
    z.object({
      email: z.string().email().optional(),
      phone: z.string().min(8).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await teamService.inviteToTeam({
        teamId: param(req, 'teamId'),
        invitedById: req.user!.id,
        email: req.body.email,
        phone: req.body.phone,
      });
      sendSuccess(res, data, 201);
    } catch (error) {
      next(error);
    }
  },
);

teamsRouter.post(
  '/invites/:inviteId/respond',
  authenticate,
  validate(z.object({ accept: z.boolean() })),
  async (req, res, next) => {
    try {
      const data = await teamService.respondToInvite({
        inviteId: param(req, 'inviteId'),
        userId: req.user!.id,
        accept: req.body.accept,
      });
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

// ─── Leaderboard ─────────────────────────────────────────────────────────────

leaderboardRouter.get('/', async (req, res, next) => {
  try {
    const q = z
      .object({
        branchId: z.string().min(1),
        sportId: z.string().optional(),
      })
      .parse(req.query);
    const data = await tournamentService.getBranchLeaderboard(q);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});
