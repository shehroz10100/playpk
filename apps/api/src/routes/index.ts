import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth';
import { companiesRouter } from './companies';
import { branchesRouter } from './branches';
import { courtsRouter } from './courts';
import { slotsRouter } from './slots';
import { bookingsRouter } from './bookings';
import { sportsRouter } from './sports';
import { venuesRouter } from './venues';
import { loyaltyRouter, walletRouter, notificationsRouter } from './loyalty-wallet';
import { reviewsRouter, waitlistRouter } from './reviews-waitlist';
import { aiRouter } from './ai';
import { tournamentsRouter, teamsRouter, leaderboardRouter } from './tournaments';
import { adminRouter, supportRouter } from './admin';
import { socialRouter } from './social';

/**
 * Versioned API routes under /api
 */
export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      message: 'PlayPK API v1',
      endpoints: {
        health: 'GET /health',
        auth: '/api/auth',
        companies: '/api/companies',
        branches: '/api/branches',
        venues: '/api/venues',
        courts: '/api/branches/:branchId/courts',
        slots: '/api/slots',
        bookings: '/api/bookings',
        sports: '/api/sports',
        loyalty: '/api/loyalty',
        wallet: '/api/wallet',
        reviews: '/api/reviews',
        waitlist: '/api/waitlist',
        notifications: '/api/notifications',
        ai: {
          pricing: 'POST /api/ai/pricing/suggest',
          analytics: 'GET /api/ai/analytics',
          chat: 'POST /api/ai/chat',
        },
        tournaments: '/api/tournaments',
        teams: '/api/teams',
        leaderboard: '/api/leaderboard',
        social: '/api/social',
        admin: '/api/admin',
        support: '/api/support',
      },
    },
  });
});

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/companies', companiesRouter);
apiRouter.use('/branches', branchesRouter);
apiRouter.use('/branches/:branchId/courts', courtsRouter);
apiRouter.use('/venues', venuesRouter);
apiRouter.use('/slots', slotsRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/sports', sportsRouter);
apiRouter.use('/loyalty', loyaltyRouter);
apiRouter.use('/wallet', walletRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/reviews', reviewsRouter);
apiRouter.use('/waitlist', waitlistRouter);
apiRouter.use('/ai', aiRouter);
apiRouter.use('/tournaments', tournamentsRouter);
apiRouter.use('/teams', teamsRouter);
apiRouter.use('/leaderboard', leaderboardRouter);
apiRouter.use('/social', socialRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/support', supportRouter);
