function panel(ctx,x,y,w,h,r,stops){
  const g=ctx.createLinearGradient(x,y,x+w,y+h);for(const [p,c] of stops)g.addColorStop(p,c);
  ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
function limb(ctx,x0,y0,x1,y1,w,c){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}

export function drawEnemyCombatant(ctx,e,s,h,t){
  const elite=e.type==='elite',u=h/60,phase=t*(elite?8.1:10.0)+(e.bob||0)*.017;
  const bob=Math.sin(phase)*u,stride=Math.sin(phase)*4.2*u;
  const bodyW=(elite?29:19)*u,flash=Math.max(0,e.hitFlash||0);
  ctx.save();ctx.translate(s.x,s.y+bob);ctx.lineCap='round';

  // Grounding shadow.
  ctx.fillStyle=elite?'rgba(31,23,26,.32)':'rgba(28,28,30,.25)';ctx.beginPath();ctx.ellipse(1*u,2*u,(elite?15:10)*u,(elite?4.4:3.2)*u,0,0,Math.PI*2);ctx.fill();

  // Forward-facing legs and boots.
  limb(ctx,-bodyW*.20,-15*u,(-5+stride*.28)*u,-3*u,(elite?6.8:5.1)*u,'#2b272b');
  limb(ctx, bodyW*.20,-15*u,( 5-stride*.28)*u,-3*u,(elite?6.8:5.1)*u,'#211f22');
  panel(ctx,(-9+stride*.09)*u,-5*u,7.7*u,4.5*u,1.5*u,[[0,'#3b2b2d'],[1,'#171719']]);
  panel(ctx,(1.4-stride*.09)*u,-5*u,7.7*u,4.5*u,1.5*u,[[0,'#302629'],[1,'#141416']]);

  // Torso depth: dark side shell plus saturated faction face.
  ctx.fillStyle='#452329';ctx.beginPath();ctx.moveTo(-bodyW*.60,-33*u);ctx.lineTo(bodyW*.58,-33*u);ctx.lineTo(bodyW*.48,-13*u);ctx.lineTo(-bodyW*.50,-13*u);ctx.closePath();ctx.fill();
  const torso=ctx.createLinearGradient(-bodyW*.45,-33*u,bodyW*.45,-14*u);
  torso.addColorStop(0,flash?'#ff8f75':(elite?'#b94339':'#f05b4c'));
  torso.addColorStop(.45,flash?'#ef755e':(elite?'#8c2f31':'#cf3d39'));
  torso.addColorStop(1,elite?'#4a252a':'#70282e');
  ctx.fillStyle=torso;ctx.beginPath();ctx.roundRect(-bodyW*.48,-32*u,bodyW*.96,(elite?20:18)*u,4*u);ctx.fill();

  if(elite){
    // Elite is a different silhouette, not a scaled grunt.
    panel(ctx,-bodyW*.72,-31*u,10*u,12*u,3*u,[[0,'#4b3434'],[.45,'#2f292c'],[1,'#181a1d']]);
    panel(ctx,bodyW*.72-10*u,-31*u,10*u,12*u,3*u,[[0,'#332d30'],[.45,'#282528'],[1,'#171719']]);
    panel(ctx,-10*u,-29*u,20*u,12*u,2.5*u,[[0,'#cf7044'],[.42,'#8d3a32'],[1,'#3f2528']]);
    ctx.fillStyle='#1a1d20';ctx.beginPath();ctx.roundRect(-7.5*u,-26.5*u,15*u,6.5*u,2*u);ctx.fill();
    ctx.fillStyle='rgba(255,179,88,.4)';ctx.fillRect(-4.8*u,-24.8*u,9.6*u,1.6*u);
  }else{
    panel(ctx,-5.2*u,-28*u,10.4*u,8.4*u,2*u,[[0,'#a53233'],[1,'#63262b']]);
  }

  // Arms + forward/down-bridge weapon. Larger on elite.
  limb(ctx,-bodyW*.46,-26*u,-5*u,-19*u,(elite?4.8:3.5)*u,'#a86549');
  limb(ctx, bodyW*.46,-26*u, 5*u,-19*u,(elite?4.8:3.5)*u,'#955d45');
  ctx.save();ctx.translate(2*u,-20*u);ctx.rotate(.66);
  panel(ctx,-2*u,-2*u,(elite?7.5:5.2)*u,(elite?22:18)*u,1.2*u,[[0,'#647077'],[.25,'#343d42'],[1,'#171b1e']]);
  ctx.fillStyle='#0e1214';ctx.fillRect((elite?1.8:1.0)*u,11*u,(elite?2.4:1.8)*u,(elite?11:8)*u);ctx.restore();

  // Visible face / helmet establishes enemy direction toward the camera.
  ctx.fillStyle='#bd7854';ctx.beginPath();ctx.arc(0,(elite?-40:-38)*u,(elite?6.7:5.6)*u,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#362226';ctx.beginPath();ctx.arc(-2.2*u,(elite?-39:-37.5)*u,1.1*u,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(2.2*u,(elite?-39:-37.5)*u,1.1*u,0,Math.PI*2);ctx.fill();
  const helmet=ctx.createLinearGradient(-10*u,-49*u,10*u,-37*u);helmet.addColorStop(0,flash?'#ff8c76':(elite?'#b94239':'#f05649'));helmet.addColorStop(.48,elite?'#8e3032':'#cd3b38');helmet.addColorStop(1,'#54242a');
  ctx.fillStyle=helmet;ctx.beginPath();ctx.arc(0,(elite?-42:-40)*u,(elite?10:8)*u,Math.PI,Math.PI*2);ctx.lineTo((elite?10:8)*u,(elite?-39:-37.6)*u);ctx.lineTo(-(elite?10:8)*u,(elite?-39:-37.6)*u);ctx.closePath();ctx.fill();
  ctx.fillStyle='#241f22';ctx.beginPath();ctx.roundRect(-(elite?10.7:8.5)*u,(elite?-40:-38)*u,(elite?21.4:17)*u,2.3*u,1*u);ctx.fill();

  // Controlled armor highlights.
  ctx.strokeStyle=elite?'rgba(235,121,81,.46)':'rgba(255,137,103,.42)';ctx.lineWidth=1.1*u;ctx.beginPath();ctx.moveTo(-bodyW*.34,-30*u);ctx.lineTo(-bodyW*.28,-17*u);ctx.stroke();
  ctx.restore();
}
