import { registerJob } from '../lib/jobs';
import { notifyPlayersOfTournamentListed } from './notify.service';
import { expireStaleOpenMatches } from './social-match.service';

const OPEN_MATCH_EXPIRE_INTERVAL_MS = 15 * 60 * 1000;

export function registerBackgroundJobs() {
  registerJob('NOTIFY_TOURNAMENT_LISTED', async (payload) => {
    const { tournamentId } = payload as { tournamentId: string };
    await notifyPlayersOfTournamentListed(tournamentId);
  });

  registerJob('EXPIRE_STALE_OPEN_MATCHES', async () => {
    const count = await expireStaleOpenMatches();
    if (count > 0) {
      console.log(`[Jobs] Expired ${count} stale open match listing(s)`);
    }
  });

  // Keep Upcoming Matches clean without waiting for a browse request.
  void expireStaleOpenMatches().catch((err) =>
    console.warn('[Jobs] Initial open-match expiry failed', err),
  );
  setInterval(() => {
    void expireStaleOpenMatches().catch((err) =>
      console.warn('[Jobs] Periodic open-match expiry failed', err),
    );
  }, OPEN_MATCH_EXPIRE_INTERVAL_MS);
}
