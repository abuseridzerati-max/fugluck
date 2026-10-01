/** Only deliberately public domain codes cross the socket boundary. */
const publicCodes = new Set(['INSUFFICIENT_FUNDS','INSUFFICIENT_BALANCE','TEMPLATE_NOT_FOUND','TEMPLATE_DISABLED',
  'TEMPLATE_RETIRED','GAME_NOT_CERTIFIED','GUEST_NOT_ALLOWED','UNSUPPORTED_TEMPLATE_SHAPE','DUPLICATE_ENTRY',
  'ENTRY_PREVIOUSLY_RELEASED','ENTRY_REJECTED','ACCOUNTING_PENDING','CYCLE_FULL','CYCLE_CLOSED',
  'QUALIFICATION_REQUIRED','QUALIFICATION_INVALIDATED','TICKET_ALREADY_USED','TOURNAMENT_DISABLED',
  'REAL_MONEY_DISABLED','MOCK_AUTHORIZATION_REQUIRED','ACCOUNT_INACTIVE','ACTION_DISABLED','GAMEPLAY_BLOCKED']);
export function playerCompetitionError(error: unknown, fallback: string): {code:string;message:string} {
  const candidate = error && typeof error === 'object' ? (error as {code?:unknown}).code : undefined;
  const code = typeof candidate === 'string' && publicCodes.has(candidate) ? candidate : fallback;
  const message = code === 'GAMEPLAY_BLOCKED' ? 'Competition gameplay is blocked pending live authority acceptance.' :
    ['INSUFFICIENT_FUNDS','INSUFFICIENT_BALANCE'].includes(code) ? 'Insufficient available balance.' :
    code === 'QUALIFICATION_REQUIRED' ? 'Qualification is required for this competition.' :
    'Competition request could not be completed. Please retry or check the competition status.';
  return {code,message};
}
