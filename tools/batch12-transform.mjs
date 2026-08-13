import fs from 'node:fs';

function edit(path, fn){
  const before=fs.readFileSync(path,'utf8');
  const after=fn(before);
  if(after===before){console.log(`${path}: already transformed or no-op`);return;}
  fs.writeFileSync(path,after);console.log(`${path}: transformed`);
}
function mustReplace(s,from,to,label){
  if(s.includes(to))return s;
  if(!s.includes(from))throw new Error(`Missing transform anchor: ${label}`);
  return s.replace(from,to);
}

edit('index.html',s=>{
  s=mustReplace(s,
`        <p class="eyebrow">THE REAL GATE RUNNER</p>\n        <h1>BLASTLINE</h1>\n        <p class="sub">Choose a lane, grow your army, blast through enemy waves, and beat the boss bridge by bridge.</p>\n        <div class="controls">\n          <span>Move: drag, mouse, A/D, ←/→</span>\n          <span>Shoot: automatic</span>\n        </div>\n        <button id="playBtn" class="primary">PLAY NOW</button>`,
`        <img class="menu-logo" src="assets/logo.svg" alt="BLASTLINE" />\n        <p class="eyebrow">BRIDGE ASSAULT</p>\n        <h1 class="sr-only">BLASTLINE</h1>\n        <p class="sub">Build the squad. Pick the lane. Break through the line.</p>\n        <div class="controls"><span>DRAG / A D / ← →</span><span>AUTO FIRE</span></div>\n        <button id="playBtn" class="primary">PLAY</button>`,
'menu lockup');
  if(!s.includes('id="victoryPanel"')){
    const anchor='    <section id="gameOverPanel" class="overlay">';
    const victory=`    <section id="victoryPanel" class="overlay victory-overlay">\n      <div class="card victory-card">\n        <div class="victory-stars" aria-hidden="true">★ ★ ★</div>\n        <p class="eyebrow victory-eyebrow">BRIDGE SECURED</p>\n        <h2>VICTORY!</h2>\n        <div class="results victory-results">\n          <div><span>Score</span><b id="victoryScore">0</b></div>\n          <div><span>Best</span><b id="victoryBest">0</b></div>\n        </div>\n        <button id="continueBtn" class="primary victory-button">RUN AGAIN</button>\n      </div>\n    </section>\n\n`;
    if(!s.includes(anchor))throw new Error('Missing victory insertion anchor');
    s=s.replace(anchor,victory+anchor);
  }
  return s;
});

edit('styles.css',s=>{
  if(!s.includes('.menu-logo{'))s+=`\n.menu-logo{display:block;width:min(430px,78vw);height:auto;margin:0 auto 10px;filter:drop-shadow(0 8px 12px rgba(1,16,28,.32))}.hero-card .menu-logo+ .eyebrow{margin-top:2px}.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.victory-overlay{background:radial-gradient(circle at 50% 38%,rgba(71,192,255,.20),rgba(4,18,29,.52) 60%,rgba(3,12,20,.72))}.victory-card{position:relative;border-color:rgba(255,205,79,.42);background:linear-gradient(180deg,rgba(19,64,91,.96),rgba(8,27,43,.98));overflow:hidden}.victory-card::before{content:"";position:absolute;inset:-60%;background:conic-gradient(from 0deg,transparent,rgba(255,220,91,.11),transparent 12%,transparent 25%,rgba(87,211,255,.10),transparent 37%);animation:victorySpin 18s linear infinite;pointer-events:none}.victory-card>*{position:relative}.victory-stars{font-size:clamp(35px,8vw,54px);letter-spacing:.08em;color:#ffc84e;text-shadow:0 4px 0 #a76616,0 8px 18px rgba(255,184,41,.30);margin-bottom:8px}.victory-eyebrow{color:#ffd66d}.victory-results{grid-template-columns:repeat(2,1fr)}.victory-button{background:linear-gradient(180deg,#ffd45b,#efa82b 55%,#c67a17);box-shadow:0 10px 23px rgba(186,112,12,.32),inset 0 2px rgba(255,255,255,.32)}@keyframes victorySpin{to{transform:rotate(360deg)}}\n`;
  return s;
});

edit('src/game.js',s=>{
  s=mustReplace(s,
`import { drawEnemyCombatant } from './enemy-render.mjs';`,
`import { drawEnemyCombatant } from './enemy-render.mjs';\nimport { drawBlueSoldier, drawBossCombatant } from './production-render.mjs';`,
'production renderer import');
  s=mustReplace(s,
`const gameOverPanel = document.querySelector('#gameOverPanel');`,
`const gameOverPanel = document.querySelector('#gameOverPanel');\nconst victoryPanel = document.querySelector('#victoryPanel');\nconst continueBtn = document.querySelector('#continueBtn');\nconst victoryScore = document.querySelector('#victoryScore');\nconst victoryBest = document.querySelector('#victoryBest');`,
'victory selectors');
  s=mustReplace(s,
`  gameOverPanel.classList.toggle('visible', next === 'over');\n  hud.classList.toggle('hidden', next !== 'playing');`,
`  gameOverPanel.classList.toggle('visible', next === 'over');\n  victoryPanel?.classList.toggle('visible', next === 'victory');\n  hud.classList.toggle('hidden', next !== 'playing');`,
'victory visibility');
  s=s.replace(`function sceneHorizon(){ return H * (W < H ? 0.18 : 0.16); }`,`function sceneHorizon(){ return H * (W < H ? 0.205 : 0.18); }`);
  s=s.replace(`const bridgeRed = '#d94a43';`,`const bridgeRed = '#e34a40';`)
     .replace(`const bridgeRedDark = '#9f282b';`,`const bridgeRedDark = '#a52b2c';`)
     .replace(`const bridgeRedDeep = '#762127';`,`const bridgeRedDeep = '#711f25';`)
     .replace(`const bridgeRedLight = '#ee6a58';`,`const bridgeRedLight = '#f47a61';`);
  s=s.replace(`sky.addColorStop(0,'#67c9f7');`,`sky.addColorStop(0,'#70c9ee');`)
     .replace(`sky.addColorStop(.56,'#8ad8f6');`,`sky.addColorStop(.56,'#9edcf1');`)
     .replace(`sky.addColorStop(1,'#d0edf4');`,`sky.addColorStop(1,'#d9eef1');`)
     .replace(`water.addColorStop(0,'#55b9d9');`,`water.addColorStop(0,'#55c1dd');`)
     .replace(`water.addColorStop(.28,'#2fa7d3');`,`water.addColorStop(.28,'#28acd2');`)
     .replace(`water.addColorStop(1,'#0b79ad');`,`water.addColorStop(1,'#087da9');`);
  s=s.replace(`shoulderGrad.addColorStop(0,'#c7c7c1');`,`shoulderGrad.addColorStop(0,'#b9c0bf');`)
     .replace(`shoulderGrad.addColorStop(1,'#a6a7a7');`,`shoulderGrad.addColorStop(1,'#8e999b');`)
     .replace(`roadGrad.addColorStop(0,'#a8aaa8');`,`roadGrad.addColorStop(0,'#616a6e');`)
     .replace(`roadGrad.addColorStop(.52,'#909391');`,`roadGrad.addColorStop(.52,'#4d565b');`)
     .replace(`roadGrad.addColorStop(1,'#7d8282');`,`roadGrad.addColorStop(1,'#343d43');`);
  s=s.replace(`return lerp(H*0.105, Math.min(H*0.255,210), t);`,`return lerp(H*0.115, Math.min(H*0.285,224), t);`);
  s=s.replace(`  const towers=[0.10,0.39];`,`  const towers=[0.09,0.405];`);
  s=mustReplace(s,
`    const scr=worldToScreen(boss.x,boss.y);drawBossFigure(scr,bossHeightAt(boss.y),boss.hitFlash||0);`,
`    const scr=worldToScreen(boss.x,boss.y);drawBossCombatant(ctx,scr,bossHeightAt(boss.y),boss.hitFlash||0,waveTime);`,
'boss renderer');
  s=mustReplace(s,
`    drawForwardSoldier(scr,soldierHeightAt(slot.y),slot.phase,activeFlashes.has(slot.index),player._visualLean||0);`,
`    drawBlueSoldier(ctx,scr,soldierHeightAt(slot.y),waveTime,slot.phase,activeFlashes.has(slot.index),player._visualLean||0);`,
'player renderer');

  // Player projectile palette and bloom: cyan/white like the target renders.
  s=s.replace(`const len = 24; ctx.strokeStyle = frenzyTimer>0 ? '#9ee6ff' : '#ffd06c'; ctx.lineWidth = 3;`,
`const len = 28; ctx.save(); ctx.shadowColor='#55d9ff'; ctx.shadowBlur=7; ctx.strokeStyle = frenzyTimer>0 ? '#d9f8ff' : '#69ddff'; ctx.lineWidth = 3;`)
   .replace(`ctx.fillStyle = '#fff4ba'; ctx.beginPath(); ctx.arc(scr.x, scr.y, 2.5, 0, Math.PI*2); ctx.fill();`,`ctx.fillStyle = '#f2fdff'; ctx.beginPath(); ctx.arc(scr.x, scr.y, 2.7, 0, Math.PI*2); ctx.fill(); ctx.restore();`);

  // Final boss now produces a real victory state instead of wrapping silently to wave one.
  s=mustReplace(s,
`if(boss.hp <= 0){ score += 1200 + wave*500; burst(boss.x,boss.y,'#ffc44d',30); boss = null; setState('upgrade'); showUpgrades(); updateHud(); return; }`,
`if(boss.hp <= 0){ score += 1200 + wave*500; burst(boss.x,boss.y,'#ffc44d',30); boss = null; if(wave >= LEVELS.length-1){ victory(); }else{ setState('upgrade'); showUpgrades(); } updateHud(); return; }`,
'final boss victory');
  s=mustReplace(s,
`    btn.onclick = () => { player = applyUpgrade(player, item.id); wave = (wave + 1) % LEVELS.length; startWave(); updateHud(); };`,
`    btn.onclick = () => { player = applyUpgrade(player, item.id); wave += 1; startWave(); updateHud(); };`,
'upgrade progression');
  if(!s.includes('function victory(){')){
    const anchor=`function gameOver(){\n`;
    const fn=`function victory(){\n  best = Math.max(best, player.coins + score); localStorage.setItem('blastline-best', best);\n  if(victoryScore) victoryScore.textContent = format(player.coins + score);\n  if(victoryBest) victoryBest.textContent = format(best);\n  setState('victory');\n}\n\n`;
    if(!s.includes(anchor))throw new Error('Missing victory function anchor');
    s=s.replace(anchor,fn+anchor);
  }
  s=mustReplace(s,
`playBtn.onclick = () => resetRun(); retryBtn.onclick = () => resetRun(); pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? '▶' : '❚❚'; };`,
`playBtn.onclick = () => resetRun(); retryBtn.onclick = () => resetRun(); if(continueBtn) continueBtn.onclick = () => resetRun(); pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? '▶' : '❚❚'; };`,
'victory button');
  if(!s.includes('forceVictory(){')){
    s=s.replace(`    setWaveTime(value){waveTime=Math.max(0,Number(value)||0);return waveTime;},`,
`    setWaveTime(value){waveTime=Math.max(0,Number(value)||0);return waveTime;},\n    setWave(value){wave=clamp(Math.round(Number(value)||1)-1,0,LEVELS.length-1);updateHud();return wave+1;},\n    forceUpgrade(){setState('upgrade');showUpgrades();return state;},\n    forceVictory(){victory();return state;},\n    forceGameOver(){player.troops=0;gameOver();return state;},`);
  }
  return s;
});
