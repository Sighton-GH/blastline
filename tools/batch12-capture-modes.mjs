import fs from'node:fs';
const path='src/game.js';let s=fs.readFileSync(path,'utf8');
const old=`await loadAssets();\nupdateHud();\nsetState('menu');\nrequestAnimationFrame(loop);`;
const next=`await loadAssets();\nupdateHud();\nconst captureMode=navigator.webdriver?new URLSearchParams(location.search).get('capture'):null;\nif(captureMode==='upgrade'){setState('upgrade');showUpgrades();}\nelse if(captureMode==='victory'){victory();}\nelse if(captureMode==='gameover'){player.troops=0;gameOver();}\nelse if(captureMode==='lane'){resetRun(7);gates=[{x:-.35,y:.54,w:.68,h:.14,kind:'troops',value:-10,label:()=>'-10',color:'red',hit:false},{x:.35,y:.54,w:.68,h:.14,kind:'troops',value:9,label:()=>'+9',color:'blue',hit:false}];paused=true;}\nelse{setState('menu');}\nrequestAnimationFrame(loop);`;
if(s.includes(next)){console.log('capture modes already present');process.exit(0)}
if(!s.includes(old))throw new Error('capture-mode anchor missing');
fs.writeFileSync(path,s.replace(old,next));console.log('capture modes installed');
