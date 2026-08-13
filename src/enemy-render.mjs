export function drawEnemyCombatant(ctx,e,s,h,t){
  const elite=e.type==='elite',u=h/60,phase=t*(elite?8.5:10.2)+(e.bob||0)*.017;
  const bob=Math.sin(phase)*u,stride=Math.sin(phase)*4.5*u,w=(elite?25:17)*u;
  ctx.save();ctx.translate(s.x,s.y+bob);ctx.lineCap='round';
  ctx.fillStyle='rgba(25,31,34,.24)';ctx.beginPath();ctx.ellipse(0,2*u,(elite?13:9)*u,(elite?4:3)*u,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#232126';ctx.lineWidth=(elite?6:5)*u;
  ctx.beginPath();ctx.moveTo(-w*.2,-15*u);ctx.lineTo((-5+stride*.3)*u,-3*u);ctx.stroke();
  ctx.beginPath();ctx.moveTo(w*.2,-15*u);ctx.lineTo((5-stride*.3)*u,-3*u);ctx.stroke();
  ctx.fillStyle=elite?'#55282a':'#49272a';ctx.beginPath();ctx.roundRect(-w*.55,-32*u,w*1.1,(elite?21:19)*u,4*u);ctx.fill();
  ctx.fillStyle=elite?'#8f332f':'#d5483d';ctx.beginPath();ctx.roundRect(-w*.45,-31*u,w*.9,(elite?18:16)*u,3*u);ctx.fill();
  if(elite){ctx.fillStyle='#c08d46';ctx.beginPath();ctx.roundRect(-8*u,-29*u,16*u,11*u,2*u);ctx.fill();ctx.fillStyle='#382d2e';ctx.beginPath();ctx.arc(-w*.58,-28*u,6*u,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(w*.58,-28*u,6*u,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#252c30';ctx.lineWidth=(elite?4.4:3.2)*u;ctx.beginPath();ctx.moveTo(-u,-25*u);ctx.lineTo(7*u,-8*u);ctx.stroke();
  ctx.fillStyle='#bc7951';ctx.beginPath();ctx.arc(0,(elite?-39:-37)*u,(elite?6.5:5.5)*u,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=elite?'#992f2b':'#d73e35';ctx.beginPath();ctx.arc(0,(elite?-41:-39)*u,(elite?9:7.2)*u,Math.PI,Math.PI*2);ctx.lineTo((elite?9:7.2)*u,(elite?-39:-37.5)*u);ctx.lineTo(-(elite?9:7.2)*u,(elite?-39:-37.5)*u);ctx.closePath();ctx.fill();
  ctx.fillStyle='#202326';ctx.fillRect(-3.5*u,(elite?-38:-36)*u,7*u,1.3*u);ctx.restore();
}
