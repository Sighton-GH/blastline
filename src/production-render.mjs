const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function ellipse(ctx,x,y,rx,ry,fill,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function capsule(ctx,x0,y0,x1,y1,w,stroke){
  ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
}
function panel(ctx,x,y,w,h,r,stops){
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  for(const [p,c] of stops)g.addColorStop(p,c);
  ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}

export function drawBlueSoldier(ctx,scr,h,t,phase=0,shooting=false,lean=0){
  const u=h/62;
  const run=t*10.8+phase;
  const bob=Math.sin(run)*1.25*u;
  const stride=Math.sin(run)*5.1*u;
  const recoil=shooting?2.2*u:0;
  ctx.save();ctx.translate(scr.x,scr.y+bob);ctx.rotate(lean);

  // Tight contact shadow; no sticker outline.
  ellipse(ctx,1*u,2*u,11.5*u,3.5*u,'#193039',.28);
  ellipse(ctx,2*u,1.4*u,7.5*u,2.2*u,'#12262d',.16);

  // Boots and legs: chunky, faceted, rear-facing.
  capsule(ctx,-4.5*u,-15*u,(-5.2+stride*.28)*u,-4*u,5.4*u,'#163342');
  capsule(ctx,4.5*u,-15*u,(5.2-stride*.28)*u,-4*u,5.4*u,'#102b3b');
  panel(ctx,(-8.8+stride*.10)*u,-5.3*u,7.2*u,4.3*u,1.5*u,[[0,'#102a38'],[.55,'#1c4153'],[1,'#0b202c']]);
  panel(ctx,(1.6-stride*.10)*u,-5.3*u,7.2*u,4.3*u,1.5*u,[[0,'#0d2633'],[.55,'#193b4c'],[1,'#091d28']]);

  // Torso and side faces create the soft low-poly toy volume.
  ctx.fillStyle='#082c48';ctx.beginPath();ctx.moveTo(-10.5*u,-31*u);ctx.lineTo(10*u,-31*u);ctx.lineTo(8.4*u,-12.7*u);ctx.lineTo(-8.7*u,-12.7*u);ctx.closePath();ctx.fill();
  panel(ctx,-8.9*u,-32*u,16.4*u,18.5*u,3.2*u,[[0,'#2fa7ea'],[.32,'#167fca'],[.72,'#0c5d9c'],[1,'#08456f']]);
  // shoulder armor
  panel(ctx,-12.3*u,-29.5*u,5.7*u,9.5*u,2.2*u,[[0,'#269ee0'],[1,'#074c7d']]);
  panel(ctx,6.3*u,-29.5*u,5.7*u,9.5*u,2.2*u,[[0,'#0d68a8'],[1,'#063956']]);
  // backpack / rear plate
  panel(ctx,-6.0*u,-27.4*u,12.0*u,10.6*u,2.5*u,[[0,'#0c4e7a'],[.45,'#083d62'],[1,'#062c48']]);
  ctx.fillStyle='rgba(95,205,255,.34)';ctx.beginPath();ctx.roundRect(-4.7*u,-26.2*u,1.8*u,7.8*u,.8*u);ctx.fill();
  ctx.fillStyle='#071e2d';ctx.fillRect(-1*u,-29*u,2*u,13*u);

  // Neck and rear helmet. Face is intentionally not visible.
  ellipse(ctx,0,-36.7*u,5.1*u,5.0*u,'#bd7c57');
  const helmet=ctx.createLinearGradient(-7*u,-45*u,7*u,-36*u);
  helmet.addColorStop(0,'#39b5ef');helmet.addColorStop(.43,'#1688ce');helmet.addColorStop(1,'#075681');
  ctx.fillStyle=helmet;ctx.beginPath();ctx.arc(0,-40.0*u,8.1*u,Math.PI,Math.PI*2);ctx.lineTo(8.2*u,-37.4*u);ctx.lineTo(-8.2*u,-37.4*u);ctx.closePath();ctx.fill();
  ctx.fillStyle='#06446c';ctx.beginPath();ctx.roundRect(-8.8*u,-38.5*u,17.6*u,2.3*u,1*u);ctx.fill();
  ctx.fillStyle='rgba(153,231,255,.45)';ctx.beginPath();ctx.arc(-2.2*u,-40.8*u,5*u,3.65,5.15);ctx.lineWidth=1.2*u;ctx.strokeStyle='rgba(174,238,255,.48)';ctx.stroke();

  // Arms lead upward toward the horizon; rifle stays compact and dimensional.
  capsule(ctx,-8.2*u,-27.5*u,-2.6*u,-35.2*u,3.8*u,'#bb7651');
  capsule(ctx,8.0*u,-27.5*u,3.0*u,-35.1*u,3.8*u,'#a96648');
  ctx.save();ctx.translate(3.6*u,-34.5*u+recoil);ctx.rotate(-.10);
  panel(ctx,-2.7*u,-1.4*u,5.8*u,13*u,1.3*u,[[0,'#35434b'],[.4,'#1f2d34'],[1,'#101a20']]);
  ctx.fillStyle='#0d171c';ctx.beginPath();ctx.roundRect(-1.1*u,-12.2*u,2.6*u,15.2*u,.8*u);ctx.fill();
  ctx.fillStyle='#697a82';ctx.fillRect(-.45*u,-13.8*u,1.0*u,10*u);
  ctx.restore();

  if(shooting){
    const mx=4.2*u,my=-49.4*u+recoil;
    const glow=ctx.createRadialGradient(mx,my,0,mx,my,8*u);glow.addColorStop(0,'rgba(255,255,224,.98)');glow.addColorStop(.24,'rgba(255,220,92,.94)');glow.addColorStop(.58,'rgba(69,207,255,.48)');glow.addColorStop(1,'rgba(69,207,255,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(mx,my,8*u,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff8ce';ctx.beginPath();ctx.moveTo(mx,my-5*u);ctx.lineTo(mx+3*u,my);ctx.lineTo(mx,my+3.5*u);ctx.lineTo(mx-2.2*u,my);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

export function drawBossCombatant(ctx,scr,h,flash=0,t=0){
  const u=h/126, f=clamp(flash/.1,0,1), pulse=.5+.5*Math.sin(t*4.5);
  ctx.save();ctx.translate(scr.x,scr.y);
  ellipse(ctx,0,4*u,48*u,11*u,'#14262c',.33);

  // Heavy separated legs.
  capsule(ctx,-20*u,-39*u,-25*u,-5*u,17*u,'#2c292c');
  capsule(ctx,20*u,-39*u,25*u,-5*u,17*u,'#211f23');
  panel(ctx,-36*u,-13*u,23*u,12*u,4*u,[[0,'#4b2528'],[.5,'#7e292c'],[1,'#351d20']]);
  panel(ctx,13*u,-13*u,23*u,12*u,4*u,[[0,'#391f22'],[.5,'#682427'],[1,'#27191b']]);

  // Broad armored torso, intentionally unlike the grunt.
  ctx.fillStyle='#241f22';ctx.beginPath();ctx.moveTo(-50*u,-83*u);ctx.lineTo(50*u,-83*u);ctx.lineTo(39*u,-35*u);ctx.lineTo(-39*u,-35*u);ctx.closePath();ctx.fill();
  const chest=ctx.createLinearGradient(-42*u,-86*u,42*u,-35*u);chest.addColorStop(0,f?'#ff7965':'#be4b40');chest.addColorStop(.42,f?'#e95b4e':'#8f302f');chest.addColorStop(1,'#421f25');
  ctx.fillStyle=chest;ctx.beginPath();ctx.roundRect(-39*u,-82*u,78*u,45*u,10*u);ctx.fill();
  // central recessed armor and vents
  panel(ctx,-23*u,-75*u,46*u,28*u,5*u,[[0,'#3d292b'],[.5,'#251e21'],[1,'#17171a']]);
  panel(ctx,-17*u,-69*u,34*u,15*u,3*u,[[0,'#e17445'],[.45,'#a43c31'],[1,'#4c2427']]);
  ctx.fillStyle=`rgba(255,190,74,${.22+.16*pulse})`;ctx.beginPath();ctx.roundRect(-12*u,-65*u,24*u,5*u,2*u);ctx.fill();

  // Massive shoulders + charcoal weapon pods.
  for(const side of [-1,1]){
    const x=side*48*u;
    ellipse(ctx,x,-72*u,18*u,17*u,'#282428');
    panel(ctx,x-15*u,-80*u,30*u,19*u,6*u,[[0,side<0?'#7d2b2d':'#5e2529'],[.5,'#3b2528'],[1,'#1e1d20']]);
    ctx.fillStyle='#111619';ctx.beginPath();ctx.roundRect(x+(side<0?-19:4)*u,-68*u,15*u,28*u,4*u);ctx.fill();
    ctx.fillStyle='#59646a';ctx.fillRect(x+(side<0?-15:8)*u,-72*u,7*u,31*u);
  }

  // Helmet/head is small relative to torso for boss visual mass.
  ellipse(ctx,0,-96*u,12*u,11*u,'#a7694c');
  const hg=ctx.createLinearGradient(-20*u,-113*u,20*u,-91*u);hg.addColorStop(0,f?'#ff6658':'#d4473e');hg.addColorStop(.48,'#8c2d30');hg.addColorStop(1,'#3f2228');
  ctx.fillStyle=hg;ctx.beginPath();ctx.moveTo(-20*u,-99*u);ctx.quadraticCurveTo(-16*u,-117*u,0,-118*u);ctx.quadraticCurveTo(16*u,-117*u,20*u,-99*u);ctx.lineTo(14*u,-92*u);ctx.lineTo(-14*u,-92*u);ctx.closePath();ctx.fill();
  ctx.fillStyle='#17191c';ctx.beginPath();ctx.roundRect(-15*u,-99*u,30*u,6*u,2*u);ctx.fill();
  ctx.fillStyle=`rgba(255,191,69,${.65+.25*pulse})`;ctx.fillRect(-9*u,-97.5*u,18*u,2*u);

  // Armor edge highlights, never white outlines.
  ctx.strokeStyle='rgba(244,111,77,.46)';ctx.lineWidth=1.7*u;ctx.beginPath();ctx.moveTo(-33*u,-78*u);ctx.lineTo(-28*u,-42*u);ctx.stroke();
  ctx.strokeStyle='rgba(255,177,87,.28)';ctx.beginPath();ctx.moveTo(24*u,-75*u);ctx.lineTo(31*u,-45*u);ctx.stroke();
  ctx.restore();
}
