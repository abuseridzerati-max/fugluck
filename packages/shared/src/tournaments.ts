/** Frozen product terms and player-safe tournament projections. Money is integer tetri. */
export const TOURNAMENT_CAPACITIES = [2, 4, 8, 16] as const;
export type TournamentCapacity = typeof TOURNAMENT_CAPACITIES[number];
export type CompetitionProduct = 'STANDARD' | 'PROMO' | 'GIFT';
export interface TournamentConfig {
  referenceEntryMinor: number;
  capacities: TournamentCapacity[];
  platformRateBps: number;
  promoPrizeBps: number;
  giftPrizeBps: number;
  promoThreshold: number;
  giftThreshold: number;
  promoHours: number;
  giftHours: number;
  timezone: 'Asia/Tbilisi' | 'UTC';
  promoCapacities: TournamentCapacity[];
  giftCapacities: TournamentCapacity[];
  cutoffMinutes: number;
  readyMs: number;
  waitingMs: number;
  recoveryAttempts: number;
}
export interface TournamentTerms {
  product: CompetitionProduct;
  capacity: TournamentCapacity;
  referenceEntryMinor: number;
  entryMinor: number;
  referenceTotalMinor: number;
  scheduledEntryTotalMinor: number;
  prizeMinor: number;
  marginMinor: number;
  subsidyMinor: number;
  prizeRateBps: number;
  rounding: 'FLOOR_TETRI';
  configRevision: number;
  config: TournamentConfig;
}
export interface SpecialCycle {
  id: string;
  gameId: string;
  product: 'PROMO' | 'GIFT';
  opensAt: string;
  cutoffAt: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: TournamentCapacity;
}
export interface QualificationTrackView {
  progress: number;
  threshold: number;
  ticketStatus: 'AVAILABLE' | 'CONSUMED' | null;
  targetCycleId: string | null;
  expiresAt: string | null;
}
export interface TournamentCardInfo {
  product: CompetitionProduct;
  cycle: SpecialCycle | null;
  eligibility: 'AVAILABLE' | 'QUALIFY' | 'SIGN_IN' | 'CLOSED' | 'USED';
  promo: QualificationTrackView;
  gift: QualificationTrackView;
  nextPromoCycle: SpecialCycle | null;
  nextGiftCycle: SpecialCycle | null;
}
export interface BracketMatchView {
  id: string;
  round: number;
  roundName: 'ROUND_OF_16' | 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL';
  position: number;
  players: (string | null)[];
  playerNames: (string | null)[];
  winnerUserId: string | null;
  status: string;
  attempt: number;
}
export interface PlayerTournamentView {
  product: CompetitionProduct;
  cycle: SpecialCycle | null;
  state: string;
  matches: BracketMatchView[];
  currentMatch: BracketMatchView | null;
  playerState: 'WAITING' | 'READY' | 'PLAYING' | 'ELIMINATED' | 'CHAMPION' | 'REFUNDED';
  yourScore: number | null;
  opponentScore: number | null;
}
