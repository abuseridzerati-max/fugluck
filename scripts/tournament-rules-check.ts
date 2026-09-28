import { defaultTournamentConfig, freezeTournamentTerms, nextSpecialCycle, seedBracket, roundName, validateTournamentConfig } from '../packages/server/src/competitions/tournamentRules';
import { TOURNAMENT_CAPACITIES } from '@fugluck/shared';
let passes=0,failures=0;
function check(label:string,ok:unknown){console.log(`${ok?'PASS':'FAIL'} ${label}`);ok?passes++:failures++;}
function rejects(label:string,fn:()=>unknown){try{fn();check(label,false)}catch{check(label,true)}}
for(const game of ['space-blaster','cyber-hopper'])for(const capacity of TOURNAMENT_CAPACITIES){
  const config=defaultTournamentConfig(game),total=config.referenceEntryMinor*capacity;
  for(const product of ['STANDARD','PROMO','GIFT'] as const){const frozen=freezeTournamentTerms(product,capacity,config);
    check(`${game}/${capacity}/${product} frozen prize`,frozen.prizeMinor===(product==='STANDARD'?total*0.9:total*1.5));
    check(`${game}/${capacity}/${product} independent entry`,frozen.entryMinor===(product==='GIFT'?0:config.referenceEntryMinor));
    check(`${game}/${capacity}/${product} balanced economics`,frozen.scheduledEntryTotalMinor+frozen.subsidyMinor===frozen.prizeMinor+frozen.marginMinor);
    check(`${game}/${capacity}/${product} correct funding`,frozen.marginMinor===(product==='STANDARD'?total/10:0)&&frozen.subsidyMinor===(product==='GIFT'?total*1.5:product==='PROMO'?total/2:0));
    const original=frozen.config.referenceEntryMinor;config.referenceEntryMinor++;check(`${game}/${capacity}/${product} config copied`,frozen.config.referenceEntryMinor===original);config.referenceEntryMinor--;
  }
  const entrants=Array.from({length:capacity},(_,i)=>`player-${i}`),seed='a'.repeat(64),draw=seedBracket(entrants,seed);
  check(`${capacity}/${game} unique seeded entrants`,new Set(draw.order).size===capacity&&draw.order.every(id=>entrants.includes(id)));
  check(`${capacity}/${game} reproducible after restart`,JSON.stringify(draw)===JSON.stringify(seedBracket([...entrants].reverse(),seed)));
  check(`${capacity}/${game} rounds total N-1`,Array.from({length:Math.log2(capacity)},(_,i)=>capacity/2**(i+1)).reduce((a,b)=>a+b)===capacity-1);
  check(`${capacity}/${game} final label`,roundName(capacity,Math.log2(capacity))==='FINAL');
}
const c=defaultTournamentConfig('space-blaster');
check('floor odd tetri keeps Standard remainder as margin',freezeTournamentTerms('STANDARD',2,{...c,referenceEntryMinor:3}).prizeMinor===5&&freezeTournamentTerms('STANDARD',2,{...c,referenceEntryMinor:3}).marginMinor===1);
for(const patch of [{referenceEntryMinor:1.1},{platformRateBps:900},{giftPrizeBps:Infinity},{promoThreshold:0},{giftHours:23},{timezone:'America/New_York'},{capacities:[3]},{capacities:[2,2]},{cutoffMinutes:360},{readyMs:0},{recoveryAttempts:11}])rejects(`invalid config ${JSON.stringify(patch)}`,()=>validateTournamentConfig({...c,...patch} as any));
for(const product of ['PROMO','GIFT'] as const){
  const boundary=Date.parse('2026-09-28T20:00:00Z'),cutoff=boundary-c.cutoffMinutes*60000;
  const before=nextSpecialCycle('space-blaster',product,c,cutoff-1),at=nextSpecialCycle('space-blaster',product,c,cutoff);
  check(`${product} before cutoff gets nearest cycle`,Date.parse(before.startsAt)===boundary);
  check(`${product} exact cutoff gets following cycle`,Date.parse(at.startsAt)===boundary+(product==='PROMO'?6:24)*3600000);
  check(`${product} stable IDs`,before.id===nextSpecialCycle('space-blaster',product,c,cutoff-2).id);
  check(`${product} named timezone`,before.timezone==='Asia/Tbilisi'&&new Intl.DateTimeFormat('en',{timeZone:before.timezone,hour:'2-digit',hourCycle:'h23'}).format(new Date(before.startsAt))==='00');
  check(`${product} ticket cycle has end`,Date.parse(before.endsAt)>Date.parse(before.startsAt));
}
const rotations=Array.from({length:4},(_,i)=>nextSpecialCycle('space-blaster','PROMO',c,Date.parse('2026-09-28T00:00:00Z')+i*21600000).capacity);
check('one rotating Promo capacity per cycle',new Set(rotations).size===4);
check('Gift default single 16 seat capacity',nextSpecialCycle('space-blaster','GIFT',c,Date.now()).capacity===16);
check('UTC midnight independent of Tbilisi',nextSpecialCycle('space-blaster','GIFT',{...c,timezone:'UTC'},Date.parse('2026-09-28T12:00:00Z')).startsAt==='2026-09-29T00:00:00.000Z');
rejects('duplicate entrant rejected',()=>seedBracket(['same','same']));
rejects('unsupported entrant count rejected',()=>seedBracket(['a','b','c']));
rejects('invalid seed rejected',()=>seedBracket(['a','b'],'client-seed'));
console.log(`Tournament rules: ${passes} PASS, ${failures} FAIL`);process.exitCode=failures?1:0;
