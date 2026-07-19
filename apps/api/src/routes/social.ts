import { Router } from 'express';
import { z } from 'zod';
import {
  CasualMatchType,
  MatchFormat,
  MatchVisibility,
  OpenMatchStatus,
  SkillLevel,
} from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import * as social from '../services/social-match.service';

export const socialRouter = Router();

socialRouter.use(authenticate);

socialRouter.get('/profile/me', async (req, res, next) => {
  try {
    sendSuccess(res, await social.getMyProfile(req.user!.id));
  } catch (e) {
    next(e);
  }
});

socialRouter.post(
  '/profile/onboarding',
  validate(
    z.object({
      skillLevel: z.nativeEnum(SkillLevel).optional(),
      primarySportId: z.string().optional(),
      bio: z.string().max(280).optional(),
      answers: z
        .object({
          yearsPlaying: z.number().int().min(0).max(40).optional(),
          playsWeekly: z.boolean().optional(),
          competes: z.boolean().optional(),
        })
        .optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const skillLevel = (req.body.skillLevel as SkillLevel) ?? SkillLevel.BEGINNER;
      sendSuccess(
        res,
        await social.completeSkillOnboarding(req.user!.id, {
          skillLevel,
          primarySportId: req.body.primarySportId,
          bio: req.body.bio,
          answers: req.body.answers,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

socialRouter.get('/matches', async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await social.listOpenMatches({
        userId: req.user!.id,
        city: typeof req.query.city === 'string' ? req.query.city : undefined,
        sportId: typeof req.query.sportId === 'string' ? req.query.sportId : undefined,
        visibility:
          typeof req.query.visibility === 'string'
            ? (req.query.visibility as MatchVisibility)
            : undefined,
        status:
          typeof req.query.status === 'string' ? (req.query.status as OpenMatchStatus) : undefined,
      }),
    );
  } catch (e) {
    next(e);
  }
});

socialRouter.get('/matches/:matchId', async (req, res, next) => {
  try {
    sendSuccess(res, await social.getOpenMatch(param(req, 'matchId'), req.user!.id));
  } catch (e) {
    next(e);
  }
});

socialRouter.post(
  '/matches',
  validate(
    z.object({
      title: z.string().min(3).max(80),
      sportId: z.string().min(1),
      visibility: z.nativeEnum(MatchVisibility),
      matchType: z.nativeEnum(CasualMatchType),
      format: z.nativeEnum(MatchFormat),
      skillMin: z.nativeEnum(SkillLevel).optional(),
      skillMax: z.nativeEnum(SkillLevel).optional(),
      notes: z.string().max(500).optional(),
      city: z.string().optional(),
      branchId: z.string().optional(),
      scheduledAt: z.string().datetime().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      sendSuccess(res, await social.createOpenMatch(req.user!.id, req.body), 201);
    } catch (e) {
      next(e);
    }
  },
);

socialRouter.post('/matches/:matchId/join', async (req, res, next) => {
  try {
    sendSuccess(res, await social.joinOpenMatch(param(req, 'matchId'), req.user!.id));
  } catch (e) {
    next(e);
  }
});

socialRouter.post(
  '/matches/:matchId/invite',
  validate(
    z
      .object({
        userId: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().min(10).optional(),
      })
      .refine((d) => Boolean(d.userId || d.email || d.phone), {
        message: 'userId, email, or phone required',
      }),
  ),
  async (req, res, next) => {
    try {
      sendSuccess(res, await social.invitePlayerToMatch(param(req, 'matchId'), req.user!.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

socialRouter.post(
  '/matches/:matchId/result',
  validate(
    z.object({
      homeScore: z.number().int().min(0).max(99),
      awayScore: z.number().int().min(0).max(99),
      notes: z.string().max(280).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      sendSuccess(res, await social.reportMatchResult(param(req, 'matchId'), req.user!.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

socialRouter.get('/players/search', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    sendSuccess(res, await social.searchPlayers(req.user!.id, q));
  } catch (e) {
    next(e);
  }
});

socialRouter.post('/players/:userId/follow', async (req, res, next) => {
  try {
    sendSuccess(res, await social.followPlayer(req.user!.id, param(req, 'userId')));
  } catch (e) {
    next(e);
  }
});

socialRouter.delete('/players/:userId/follow', async (req, res, next) => {
  try {
    sendSuccess(res, await social.unfollowPlayer(req.user!.id, param(req, 'userId')));
  } catch (e) {
    next(e);
  }
});

socialRouter.get('/feed', async (req, res, next) => {
  try {
    const starredOnly = req.query.starred === '1' || req.query.starred === 'true';
    sendSuccess(res, await social.listFeed(req.user!.id, starredOnly));
  } catch (e) {
    next(e);
  }
});

socialRouter.post(
  '/feed',
  validate(z.object({ body: z.string().min(1).max(500), matchId: z.string().optional() })),
  async (req, res, next) => {
    try {
      sendSuccess(res, await social.createPost(req.user!.id, req.body.body, req.body.matchId), 201);
    } catch (e) {
      next(e);
    }
  },
);

socialRouter.post('/feed/:postId/star', async (req, res, next) => {
  try {
    sendSuccess(res, await social.toggleStar(req.user!.id, param(req, 'postId')));
  } catch (e) {
    next(e);
  }
});

socialRouter.post(
  '/contacts/sync',
  validate(z.object({ phones: z.array(z.string()).max(500) })),
  async (req, res, next) => {
    try {
      sendSuccess(res, await social.syncContacts(req.user!.id, req.body.phones));
    } catch (e) {
      next(e);
    }
  },
);

socialRouter.get('/leaderboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await social.performanceLeaderboard(50));
  } catch (e) {
    next(e);
  }
});
