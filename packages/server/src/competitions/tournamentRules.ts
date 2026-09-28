import { createHmac, randomBytes } from 'node:crypto';
import { TOURNAMENT_CAPACITIES, type TournamentCapacity, type TournamentConfig, type TournamentTerms, type CompetitionProduct, type SpecialCycle } from '@fugluck/shared';

export function defaultTournamentConfig(gameId: string): TournamentConfig {
  return {referenceEntryMinor:gameId==='cyber-hopper'?400:500,capacities:[2,4,8,16],platformRateBps:1000,
    promoPrizeBps:15000,giftPrizeBps:15000,promoThreshold:5,giftThreshold:10,promoHours:6,giftHours:24,
    timezone:'Asia/Tbilisi',promoCapacities:[2,4,8,16],giftCapacities:[16],cutoffMinutes:5,
    readyMs:30000,waitingMs:120000,recoveryAttempts:3};
}
export function validateTournamentConfig(c: TournamentConfig) {
  for(const key of ['referenceEntryMinor','platformRateBps','promoPrizeBps','giftPrizeBps','promoThreshold','giftThreshold','promoHours','giftHours','cutoffMinutes','readyMs','waitingMs','recoveryAttempts'] as const)
    if(!Number.isSafeInteger(c[key])||c[key]<0)throw Error('INVALID_TOURNAMENT_CONFIG');
  if(c.referenceEntryMinor<1||c.referenceEntryMinor>1000000||c.platformRateBps!==1000||c.promoPrizeBps!==15000||c.giftPrizeBps!==15000||
    c.promoThreshold<1||c.giftThreshold<1||c.promoThreshold>100||c.giftThreshold>100||c.promoHours!==6||c.giftHours!==24||
    c.cutoffMinutes>=c.promoHours*60||c.readyMs<1000||c.readyMs>300000||c.waitingMs<1000||c.waitingMs>86400000||c.recoveryAttempts>10||
    !['Asia/Tbilisi','UTC'].includes(c.timezone))throw Error('INVALID_TOURNAMENT_CONFIG');
  for(const list of [c.capacities,c.promoCapacities,c.giftCapacities])
    if(!Array.isArray(list)||!list.length||list.length>16||list.some(n=>!TOURNAMENT_CAPACITIES.includes(n)))throw Error('INVALID_TOURNAMENT_CAPACITY');
  if(new Set(c.capacities).size!==c.capacities.length)throw Error('INVALID_TOURNAMENT_CAPACITY');
  return c;
}
export function freezeTournamentTerms(product: CompetitionProduct, capacity: TournamentCapacity, input: TournamentConfig, revision=1): TournamentTerms {
  const config=structuredClone(validateTournamentConfig(input));
  if(!['STANDARD','PROMO','GIFT'].includes(product)||!TOURNAMENT_CAPACITIES.includes(capacity)||!Number.isSafeInteger(revision)||revision<1)throw Error('INVALID_TOURNAMENT_TERMS');
  const total=BigInt(capacity)*BigInt(config.referenceEntryMinor);
  const rate=product==='STANDARD'?10000-config.platformRateBps:product==='PROMO'?config.promoPrizeBps:config.giftPrizeBps;
  const prize=total*BigInt(rate)/10000n;
  if(prize>2147483647n||total>2147483647n)throw Error('TOURNAMENT_AMOUNT_OVERFLOW');
  const scheduled=product==='GIFT'?0:Number(total),award=Number(prize);
  return {product,capacity,referenceEntryMinor:config.referenceEntryMinor,entryMinor:product==='GIFT'?0:config.referenceEntryMinor,
    referenceTotalMinor:Number(total),scheduledEntryTotalMinor:scheduled,prizeMinor:award,marginMinor:Math.max(0,scheduled-award),
    subsidyMinor:Math.max(0,award-scheduled),prizeRateBps:rate,rounding:'FLOOR_TETRI',configRevision:revision,config};
}
/** Launch zones have no daylight-saving ambiguity; arbitrary zones are rejected, never approximated. */
export function nextSpecialCycle(gameId:string,product:'PROMO'|'GIFT',config:TournamentConfig,now:number):SpecialCycle {
  validateTournamentConfig(config);
  if(!Number.isSafeInteger(now)||!['space-blaster','cyber-hopper'].includes(gameId))throw Error('INVALID_CYCLE');
  const period=(product==='PROMO'?config.promoHours:config.giftHours)*3600000;
  const offset=config.timezone==='Asia/Tbilisi'?4*3600000:0;
  let starts=Math.floor((now+offset)/period)*period-offset+period;
  if(now>=starts-config.cutoffMinutes*60000)starts+=period;
  const rotation=product==='PROMO'?config.promoCapacities:config.giftCapacities;
  const index=((Math.floor((starts+offset)/period)%rotation.length)+rotation.length)%rotation.length;
  return {id:`${gameId}:${product}:${starts}`,gameId,product,opensAt:new Date(starts-period).toISOString(),
    cutoffAt:new Date(starts-config.cutoffMinutes*60000).toISOString(),startsAt:new Date(starts).toISOString(),
    endsAt:new Date(starts+period).toISOString(),timezone:config.timezone,capacity:rotation[index]};
}
/** Rejection sampling avoids modulo bias; the persisted seed reproduces the immutable draw. */
export function seedBracket(entrants:string[],seed=randomBytes(32).toString('hex')) {
  if(!TOURNAMENT_CAPACITIES.includes(entrants.length as TournamentCapacity)||new Set(entrants).size!==entrants.length||!/^[a-f0-9]{64}$/.test(seed))throw Error('INVALID_BRACKET_ENTRANTS');
  const order=[...entrants].sort();let counter=0;
  for(let i=order.length-1;i>0;i--){const limit=Math.floor(0x100000000/(i+1))*(i+1);let value:number;
    do{value=createHmac('sha256',Buffer.from(seed,'hex')).update(String(counter++)).digest().readUInt32BE(0);}while(value>=limit);
    const j=value%(i+1);[order[i],order[j]]=[order[j],order[i]];
  }
  return {seed,order};
}
export function roundName(capacity:number,round:number) {
  return ({16:'ROUND_OF_16',8:'QUARTERFINAL',4:'SEMIFINAL',2:'FINAL'} as const)[capacity/2**(round-1) as 2|4|8|16];
}
