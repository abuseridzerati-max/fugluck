export interface LeaderboardEntry {
  rank: number;
  username: string;
  bestScore: number;
  wins: number;
}

export interface LeaderboardResponse {
  gameId: string | null;
  entries: LeaderboardEntry[];
}

export interface RecentTournamentWinner {
  username: string;
  gameId: string;
  bracketSize: number;
  prizeCoins: number;
  completedAt: string;
}

export interface RecentWinnersResponse {
  winners: RecentTournamentWinner[];
}

export interface PersonalBestsResponse {
  bests: Record<string, number>;
}
