import { registerJob } from '../lib/jobs';
import { notifyPlayersOfTournamentListed } from './notify.service';

export function registerBackgroundJobs() {
  registerJob('NOTIFY_TOURNAMENT_LISTED', async (payload) => {
    const { tournamentId } = payload as { tournamentId: string };
    await notifyPlayersOfTournamentListed(tournamentId);
  });
}
