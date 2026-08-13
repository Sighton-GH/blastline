export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const format = v => Math.round(v).toLocaleString();
export function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
export const LEVELS = [
  {name:'First Contact', length:28, spawn:1.0, enemies:18, bossHp:60, speed:1.0},
  {name:'Crossfire', length:30, spawn:.92, enemies:22, bossHp:80, speed:1.08},
  {name:'Red Tide', length:32, spawn:.84, enemies:26, bossHp:100, speed:1.16},
  {name:'No Man\'s Land', length:34, spawn:.80, enemies:30, bossHp:120, speed:1.24},
  {name:'Overdrive', length:36, spawn:.74, enemies:34, bossHp:145, speed:1.34},
  {name:'The Last Line', length:38, spawn:.68, enemies:38, bossHp:175, speed:1.45}
];
export const UPGRADES = [
  {id:'troops', icon:'👥', title:'+12 Troops', desc:'Start the next wave with a larger army.'},
  {id:'power', icon:'💥', title:'+1 Power', desc:'Bullets hit harder and elite enemies fall faster.'},
  {id:'rate', icon:'⚡', title:'+20% Fire Rate', desc:'Shoot denser bullet streams.'},
  {id:'spread', icon:'🔫', title:'+1 Projectile', desc:'Fire one additional bullet every burst.'},
  {id:'coins', icon:'🪙', title:'Bonus Coins', desc:'Grab an instant bank boost and keep rolling.'}
];
export function initialPlayer(){
  return {x:0, targetX:0, troops:12, power:1, fireRate:5.5, projectiles:1, coins:0, gems:1280, speed:1.9, hp:12};
}
export function applyUpgrade(player, id){
  const p={...player};
  if(id==='troops') p.troops+=12;
  else if(id==='power') p.power+=1;
  else if(id==='rate') p.fireRate*=1.2;
  else if(id==='spread') p.projectiles=Math.min(4,p.projectiles+1);
  else if(id==='coins') p.coins+=600;
  return p;
}
export function makeGatePair(rng, level){
  const positive = [
    {kind:'troops', value:6 + Math.floor(rng()*6) + level*2, label:v=>`+${v}`},
    {kind:'troopsMul', value:2, label:v=>`x${v}`},
    {kind:'power', value:1, label:()=>'+1 DMG'},
    {kind:'rate', value:.2, label:()=>'+20%'}
  ];
  const negative = [
    {kind:'troops', value:4 + Math.floor(rng()*6) + level, label:v=>`-${v}`},
    {kind:'slow', value:.15, label:()=>'-15%'}
  ];
  const good = positive[Math.floor(rng()*positive.length)];
  const bad = negative[Math.floor(rng()*negative.length)];
  return rng() < .5 ? [bad, good] : [good, bad];
}
export function applyGate(player, gate){
  const p={...player};
  if(gate.kind==='troops') p.troops=Math.max(1,p.troops + gate.value);
  else if(gate.kind==='troopsMul') p.troops=Math.min(999, Math.round(p.troops*gate.value));
  else if(gate.kind==='power') p.power+=gate.value;
  else if(gate.kind==='rate') p.fireRate*=1+gate.value;
  else if(gate.kind==='slow') p.fireRate*=1-gate.value;
  return p;
}
export function gateText(g){ return g.label(g.value); }
export function pickUpgradeSet(rng){
  const copy=[...UPGRADES], res=[];
  while(res.length<3 && copy.length){res.push(copy.splice(Math.floor(rng()*copy.length),1)[0]);}
  return res;
}

export function visibleSquadCount(troops){
  const n = Math.max(1, Math.round(Number.isFinite(troops) ? troops : 1));
  if(n <= 20) return n;
  if(n <= 50) return Math.min(28, 20 + Math.ceil((n - 20) * 0.25));
  if(n <= 100) return Math.min(36, 28 + Math.ceil((n - 50) * 0.16));
  return Math.min(42, 36 + Math.ceil((n - 100) * 0.025));
}

export function squadColumnCount(visibleCount){
  const n = Math.max(1, Math.round(visibleCount));
  if(n <= 3) return n;
  if(n <= 6) return 3;
  if(n <= 10) return 4;
  if(n <= 18) return 6;
  if(n <= 25) return 5;
  return 7;
}
