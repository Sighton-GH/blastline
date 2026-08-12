export const LEVELS = [
  {name:'FIRST CONTACT',duration:36,spawn:1.15,hp:1,speed:1,boss:38,bossName:'BREAKER'},
  {name:'CROSSFIRE',duration:42,spawn:1.0,hp:1.15,speed:1.08,boss:58,bossName:'RAM'},
  {name:'RED TIDE',duration:46,spawn:.88,hp:1.35,speed:1.14,boss:82,bossName:'BULLDOZER'},
  {name:'NO MAN\'S LAND',duration:50,spawn:.78,hp:1.55,speed:1.22,boss:112,bossName:'WARHOUND'},
  {name:'OVERDRIVE',duration:54,spawn:.7,hp:1.8,speed:1.3,boss:148,bossName:'FURNACE'},
  {name:'THE LAST LINE',duration:60,spawn:.62,hp:2.1,speed:1.38,boss:195,bossName:'COLOSSUS'},
];
export const META_UPGRADES = [
  {id:'troops',icon:'✦',title:'+18 STARTING TROOPS',desc:'Hit the next level with a bigger firing line.'},
  {id:'damage',icon:'↑',title:'+22% DAMAGE',desc:'Every bullet hits harder.'},
  {id:'rate',icon:'»',title:'+20% FIRE RATE',desc:'More lead, less red.'},
  {id:'armor',icon:'◆',title:'+2 ARMOR',desc:'Two breakthroughs get absorbed.'},
  {id:'spread',icon:'⋔',title:'+1 PROJECTILE',desc:'Add another shot to every volley.'},
  {id:'velocity',icon:'↟',title:'+18% BULLET SPEED',desc:'Faster bullets waste fewer shots.'},
];
export function mulberry32(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
export function formatScore(n){return Math.max(0,Math.floor(n)).toLocaleString('en-US')}
export function applyMetaUpgrade(player,id){const p={...player};if(id==='troops')p.troops+=18;if(id==='damage')p.damage*=1.22;if(id==='rate')p.fireRate*=1.2;if(id==='armor')p.armor+=2;if(id==='spread')p.projectiles=Math.min(5,p.projectiles+1);if(id==='velocity')p.bulletSpeed*=1.18;return p}
export function gateEffect(player,gate){const p={...player};switch(gate.kind){case'multiply':p.troops=Math.min(999,Math.round(p.troops*gate.value));break;case'add':p.troops=Math.min(999,p.troops+gate.value);break;case'rate':p.fireRate=Math.min(16,p.fireRate*(1+gate.value));break;case'damage':p.damage=Math.min(12,p.damage+gate.value);break;case'spread':p.projectiles=Math.min(5,p.projectiles+1);break;case'armor':p.armor=Math.min(12,p.armor+gate.value);break;}return p}
export function gateLabel(g){if(g.kind==='multiply')return `×${g.value} TROOPS`;if(g.kind==='add')return `+${g.value} TROOPS`;if(g.kind==='rate')return `+${Math.round(g.value*100)}% FIRE RATE`;if(g.kind==='damage')return `+${g.value} DAMAGE`;if(g.kind==='spread')return '+1 PROJECTILE';return `+${g.value} ARMOR`}
export function pickUnique(rng,array,count){const copy=[...array],out=[];while(copy.length&&out.length<count){out.push(copy.splice(Math.floor(rng()*copy.length),1)[0])}return out}
export function makeGatePair(rng,levelIndex){const mult=levelIndex<2?[1.5,2]:[1.5,2,2.5];const options=[
  ()=>({kind:'multiply',value:mult[Math.floor(rng()*mult.length)],charge:16+levelIndex*4}),
  ()=>({kind:'add',value:10+5*Math.floor(rng()*(3+levelIndex)),charge:10+levelIndex*3}),
  ()=>({kind:'rate',value:.25+.05*Math.floor(rng()*4),charge:13+levelIndex*3}),
  ()=>({kind:'damage',value:1,charge:15+levelIndex*4}),
  ()=>({kind:'spread',value:1,charge:22+levelIndex*5}),
  ()=>({kind:'armor',value:2,charge:13+levelIndex*3}),
];const a=Math.floor(rng()*options.length);let b=Math.floor(rng()*options.length);if(b===a)b=(b+1)%options.length;return[options[a](),options[b]()];}
export function initialPlayer(){return{x:.5,troops:12,damage:1,fireRate:5,bulletSpeed:1,projectiles:1,armor:1}}
