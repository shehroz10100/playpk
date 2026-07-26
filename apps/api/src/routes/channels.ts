import { Router } from 'express';
import { z } from 'zod';
import { ChannelKind, ChannelMemberRole, ChannelVisibility } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import * as channels from '../services/channel.service';

export const channelsRouter = Router();

channelsRouter.use(authenticate);

channelsRouter.get('/mine', async (req, res, next) => {
  try {
    sendSuccess(res, await channels.listMyChannels(req.user!.id));
  } catch (e) {
    next(e);
  }
});

channelsRouter.get('/discover', async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await channels.discoverChannels(req.user!.id, {
        kind:
          typeof req.query.kind === 'string' ? (req.query.kind as ChannelKind) : undefined,
        city: typeof req.query.city === 'string' ? req.query.city : undefined,
        sportId: typeof req.query.sportId === 'string' ? req.query.sportId : undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
      }),
    );
  } catch (e) {
    next(e);
  }
});

channelsRouter.post(
  '/',
  validate(
    z.object({
      name: z.string().min(2).max(64),
      description: z.string().max(280).optional(),
      kind: z.nativeEnum(ChannelKind),
      visibility: z.nativeEnum(ChannelVisibility).optional(),
      sportId: z.string().min(1).optional(),
      branchId: z.string().min(1).optional(),
      city: z.string().max(80).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      sendSuccess(res, await channels.createChannel(req.user!.id, req.body), 201);
    } catch (e) {
      next(e);
    }
  },
);

channelsRouter.get('/:channelId', async (req, res, next) => {
  try {
    sendSuccess(res, await channels.getChannel(req.user!.id, param(req, 'channelId')));
  } catch (e) {
    next(e);
  }
});

channelsRouter.patch(
  '/:channelId',
  validate(
    z.object({
      name: z.string().min(2).max(64).optional(),
      description: z.string().max(280).nullable().optional(),
      visibility: z.nativeEnum(ChannelVisibility).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await channels.updateChannel(req.user!.id, param(req, 'channelId'), req.body),
      );
    } catch (e) {
      next(e);
    }
  },
);

channelsRouter.delete('/:channelId', async (req, res, next) => {
  try {
    sendSuccess(res, await channels.archiveChannel(req.user!.id, param(req, 'channelId')));
  } catch (e) {
    next(e);
  }
});

channelsRouter.post('/:channelId/join', async (req, res, next) => {
  try {
    sendSuccess(res, await channels.joinChannel(req.user!.id, param(req, 'channelId')));
  } catch (e) {
    next(e);
  }
});

channelsRouter.post('/:channelId/leave', async (req, res, next) => {
  try {
    sendSuccess(res, await channels.leaveChannel(req.user!.id, param(req, 'channelId')));
  } catch (e) {
    next(e);
  }
});

channelsRouter.get('/:channelId/members', async (req, res, next) => {
  try {
    sendSuccess(res, await channels.listMembers(req.user!.id, param(req, 'channelId')));
  } catch (e) {
    next(e);
  }
});

channelsRouter.get('/:channelId/members/search', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    sendSuccess(
      res,
      await channels.searchPlayersForInvite(req.user!.id, param(req, 'channelId'), q),
    );
  } catch (e) {
    next(e);
  }
});

channelsRouter.post(
  '/:channelId/members',
  validate(z.object({ userId: z.string().min(1) })),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await channels.addMember(req.user!.id, param(req, 'channelId'), req.body.userId),
      );
    } catch (e) {
      next(e);
    }
  },
);

channelsRouter.delete('/:channelId/members/:userId', async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await channels.removeMember(
        req.user!.id,
        param(req, 'channelId'),
        param(req, 'userId'),
      ),
    );
  } catch (e) {
    next(e);
  }
});

channelsRouter.patch(
  '/:channelId/members/:userId',
  validate(z.object({ role: z.nativeEnum(ChannelMemberRole) })),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await channels.setMemberRole(
          req.user!.id,
          param(req, 'channelId'),
          param(req, 'userId'),
          req.body.role,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

channelsRouter.get('/:channelId/messages', async (req, res, next) => {
  try {
    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    sendSuccess(
      res,
      await channels.listMessages(req.user!.id, param(req, 'channelId'), after),
    );
  } catch (e) {
    next(e);
  }
});

channelsRouter.post(
  '/:channelId/messages',
  validate(z.object({ body: z.string().min(1).max(2000) })),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await channels.sendMessage(req.user!.id, param(req, 'channelId'), req.body.body),
        201,
      );
    } catch (e) {
      next(e);
    }
  },
);

channelsRouter.delete('/:channelId/messages/:messageId', async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await channels.deleteMessage(
        req.user!.id,
        param(req, 'channelId'),
        param(req, 'messageId'),
      ),
    );
  } catch (e) {
    next(e);
  }
});
