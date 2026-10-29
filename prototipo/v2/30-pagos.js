/* =====================================================================
   30-pagos.js  ·  PAGOS, ESTADÍSTICAS, HISTORIAL Y BUSCAR
   Pantallas: pagos, stats, historial, buscar
   Hojas: cotejo, pago-registrar
   ===================================================================== */
(function(){
'use strict';

/* ---------- datos de la semana (coherentes entre sí) ---------- */
const DN=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const T=[80800,74200,69500,81300,66000];
const P=[[44,0,0,42,0,0,0],[12,13,11,12,12,9,0],[11,12,10,12,11,8,0],[13,14,12,13,13,10,0],[10,11,10,11,10,8,0]];
const RU=[[12,0,0,12,0,0,0],[3,4,3,3,3,3,0],[3,3,3,3,3,2,0],[4,4,3,4,4,3,0],[3,3,3,3,3,2,0]];
const HRS=[41,36,33,39,31];
const META=130000;
const RANGO=['26 oct – 1 nov','19 – 25 oct','12 – 18 oct','5 – 11 oct','28 sep – 4 oct'];
const PAGA=['viernes 06/11','viernes 30/10','viernes 23/10','viernes 16/10','viernes 09/10'];
const M={
  w:0,
  marc:{tienda:true,apoyo:true,expo:true,taxi:true},
  pagado:{2:69500,3:80300,4:66000},
  cont:{}, cotejado:false,
  dias:[['c','f','f','c','x','x','x'],['c','c','c','c','c','c','r'],['c','c','c','c','c','c','r'],['c','c','c','c','c','c','r'],['c','c','c','c','c','c','r']]
};
const sum=a=>a.reduce((x,y)=>x+y,0);
const sumP=w=>sum(P[w]), sumR=w=>sum(RU[w]);
const f2=n=>String(n).padStart(2,'0');
const dayDate=(w,i)=>new Date(2026,9,26-7*w+i);
const dl=d=>DN[(d.getDay()+6)%7]+' '+f2(d.getDate())+'/'+f2(d.getMonth()+1);
const dayLabel=(w,i)=>dl(dayDate(w,i));
const roundC=x=>Math.round(x/100)*100;
const estadoSem=w=>w===0?'En curso':(M.pagado[w]!=null?'Pagada':'Por cobrar');
const estTono=e=>e==='En curso'?'acc':e==='Por cobrar'?'warn':'ok';
const diasCarg=w=>M.dias[w].filter(x=>x==='c').length;
const diasFalta=w=>M.dias[w].filter(x=>x==='f').length;
const dayMonto=(w,i)=>roundC(T[w]*P[w][i]/sumP(w));

function fuentes(w){
  const b=DATA.semana.fuentes;let rest=T[w];
  return b.map((f,i)=>{
    const m=i<b.length-1?roundC(f.m/80800*T[w]):rest;rest-=m;
    const k=f.k==='apoyo'?HRS[w]/41:sumP(w)/86;
    const s=f.s.replace(/\d+/,n=>Math.max(1,Math.round(n*k)));
    return Object.assign({},f,{m,s});
  });
}
const marcTotal=w=>sum(fuentes(w).filter(f=>M.marc[f.k]).map(f=>f.m));
const dayF=(w,i,f)=>roundC(f.m*P[w][i]/sumP(w));
const solC=c=>fmt.sol(c);

/* pedidos de ejemplo por fuente */
function pedFu(w,k){
  if(k==='tienda'){
    if(w===0)return DATA.pedidos.map((p,i)=>({c:p.c,m:p.m,t:(i<6?'Lun 26/10':'Jue 29/10')+' · '+(p.z||'Sin zona'),def:i<6}));
    const z=['Miraflores','Surquillo','Chorrillos','Santiago de Surco','Miraflores','Surquillo'];
    return z.map((zz,i)=>({c:'v1233'+w+f2(i)+(40+i*13)+'wofp-01',m:zz==='Chorrillos'?1300:950,t:dl(dayDate(w,i%6))+' · '+zz,def:true}));
  }
  if(k==='expo')return [0,1,2,3,4].map(i=>({c:'EV'+w+'00'+(i+1),m:i<3?850:900,t:dl(dayDate(w,i===4?3:i%3*3%4))+' · '+(i<3?'San Borja':'La Molina'),def:w>0||i<3}));
  return [];
}
const isCont=r=>M.cont[r.c]!==undefined?M.cont[r.c]:r.def;

/* pedidos de todo el mes (Historial y Buscar) */
const NOM=['Claudia Castro','Milagros Valdivia','Luis Paredes','Elsa Tizón','Ana Rojas','Jorge Salas','Rosa Medina','Pedro Quispe','Carla Núñez','Diego Flores','Lucía Vega','Mario Cáceres'];
const ZON=[['Miraflores','Av. Larco 345'],['Surquillo','Jr. Tacna 120'],['Santiago de Surco','Calle Los Pinos 88'],['Chorrillos','Av. Huaylas 410']];
const PED=(function(){
  const out=[];
  const mk=(c,date,r,e,z,m,i)=>{const zz=ZON.find(x=>x[0]===z)||ZON[0];out.push({c,d:date,r,e,z:zz[0],m,cli:NOM[i%NOM.length],tel:'9'+f2(10+(i*37)%90)+' '+String(100+(i*113)%900)+' '+String(100+(i*271)%900),dir:zz[1]+', '+zz[0]})};
  DATA.pedidos.forEach((p,i)=>mk(p.c,dayDate(0,i<6?0:3),p.r,p.e,p.z||'Miraflores',p.m,i));
  let n=10;
  for(let w=1;w<5;w++)for(let d=0;d<6;d++)for(let k=0;k<2;k++){
    const zz=ZON[(n+k)%4];n++;
    mk('v1233'+w+d+k+(20+n)+'wofp-01',dayDate(w,d),1+k,n%11===0?'P':n%17===0?'N':'E',zz[0],zz[0]==='Chorrillos'?1300:950,n);
  }
  return out.sort((a,b)=>b.d-a.d||(a.c<b.c?-1:1));
})();
const HOY=new Date(2026,9,29);

/* ---------- estilos propios ---------- */
App.css(`
@keyframes pg-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes pg-growx{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes pg-drive{from{left:0}to{left:var(--p)}}
@keyframes pg-road{to{background-position:-40px 0}}
@keyframes pg-scan{0%{top:6%}50%{top:86%}100%{top:6%}}
@keyframes pg-zoom{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes pg-fill{from{width:0}to{width:100%}}
.pg-sel{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.pg-sel-c{flex:1;text-align:center}.pg-sel-c b{display:block;font:600 19px var(--f-display)}.pg-sel-c small{color:var(--ink2);font-weight:700}
.pg-arr{width:48px;height:48px;border-radius:16px;background:var(--surf);display:grid;place-items:center;box-shadow:0 3px 0 rgba(0,0,0,.12);flex:none;transition:transform .1s}
.pg-arr:active{transform:translateY(2px)}.pg-arr:disabled{opacity:.35}
.pg-hero{position:relative;overflow:hidden;border-radius:26px;padding:16px 16px 14px;color:#fff;background:linear-gradient(145deg,var(--c-pagos),#0a5f2e);box-shadow:0 6px 0 rgba(0,0,0,.18)}
.pg-hero:before{content:"";position:absolute;right:-40px;top:-40px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.1)}
.pg-hero-t{display:flex;align-items:center;justify-content:space-between;gap:8px;position:relative}
.pg-hero-t span.l{font-weight:800;opacity:.95}
.pg-st{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:99px;font-weight:800;font-size:13px;background:#fff;color:var(--ink)}
.pg-st.acc{color:#1f5cff}.pg-st.warn{color:#b85a00}.pg-st.ok{color:#0c7d3c}
.pg-big{font:600 44px/1.05 var(--f-display);display:block;margin:4px 0 0;position:relative}
.pg-hero p{opacity:.95;font-weight:700;position:relative}
.pg-via{position:relative;margin:14px 0 6px;height:92px}
.pg-track{position:absolute;left:6px;right:48px;top:0;bottom:0}
.pg-fl{position:absolute;top:0;transform:translateX(-4px);display:flex;flex-direction:column;align-items:flex-start;font-size:11px;font-weight:800;line-height:1}
.pg-fl .ic{width:16px;height:16px}
.pg-fl.ok{color:#ffd84a}
.pg-asf{position:absolute;left:0;right:0;bottom:0;height:54px;border-radius:14px;background:#26304f;overflow:hidden;box-shadow:inset 0 3px 0 rgba(255,255,255,.12)}
.pg-lineas{position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;background:repeating-linear-gradient(90deg,#fff 0 20px,transparent 20px 40px);background-size:40px 4px;animation:pg-road .7s linear infinite;opacity:.85}
.pg-carro{position:absolute;bottom:10px;left:var(--p);margin-left:-4px;animation:pg-drive 1.5s cubic-bezier(.2,.8,.25,1) both;z-index:2}
.pg-carro .carro{display:block}
.pg-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:800;position:relative;flex-wrap:wrap}
.pg-meta .pill{background:rgba(255,255,255,.22);color:#fff}
.pg-ban{display:flex;align-items:center;gap:10px;width:100%;margin-top:12px;padding:12px 14px;border-radius:16px;background:var(--warn-soft);color:var(--warn);font-weight:800;border:3px solid var(--warn);min-height:52px}
.pg-ban .fwd{margin-left:auto}
.pg-sub{color:var(--ink2);font-weight:700;margin:-4px 2px 10px;font-size:14px}
.pg-fu{border-radius:22px;margin-bottom:10px;overflow:hidden;background:var(--surf);border:3px dashed var(--fc);transition:background .2s,transform .12s}
.pg-fu.on{background:var(--fc);color:#fff;border-color:var(--fc);box-shadow:0 5px 0 rgba(0,0,0,.18)}
.pg-fu.on.claro{color:var(--sun-ink)}
.pg-fu-top{display:flex;align-items:center;gap:12px;width:100%;padding:12px;min-height:70px}
.pg-fu-top:active{transform:scale(.985)}
.pg-box{width:40px;height:40px;border-radius:13px;border:3px solid var(--fc);display:grid;place-items:center;flex:none;background:var(--surf);color:#fff;transition:background .15s}
.pg-fu.on .pg-box{background:#fff;border-color:#fff;color:var(--fc)}
.pg-box .ic{width:26px;height:26px;opacity:0;transform:scale(.3);transition:all .2s}
.pg-fu.on .pg-box .ic{opacity:1;transform:scale(1)}
.pg-fu-t{flex:1;min-width:0}.pg-fu-t b{display:block;line-height:1.15}.pg-fu-t small{opacity:.85;font-weight:700}
.pg-fu-m{font:600 20px var(--f-display);white-space:nowrap}
.pg-bar{height:10px;margin:0 12px 10px;border-radius:5px;background:rgba(0,0,0,.1);overflow:hidden}
.pg-fu.on .pg-bar{background:rgba(255,255,255,.28)}.pg-fu.on.claro .pg-bar{background:rgba(10,34,96,.15)}
.pg-bar i{display:block;height:100%;border-radius:5px;background:var(--fc);transform-origin:left;animation:pg-growx .8s both}
.pg-fu.on .pg-bar i{background:#fff}.pg-fu.on.claro .pg-bar i{background:var(--sun-ink)}
.pg-ver{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;font-weight:800;border-top:2px solid rgba(0,0,0,.08);font-size:14px}
.pg-fu.on .pg-ver{border-top-color:rgba(255,255,255,.25)}
.pg-ver .ic{width:16px;height:16px;transition:transform .2s}.pg-ver[aria-expanded=true] .ic{transform:rotate(180deg)}
.pg-det{background:var(--surf);color:var(--ink);padding:10px;display:flex;flex-direction:column;gap:6px}
.pg-dd{display:flex;justify-content:space-between;padding:8px 10px;border-radius:12px;background:var(--surf2);font-weight:800;font-size:14px}
.pg-ped{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:14px;background:var(--surf2);flex-wrap:wrap;transition:background .2s}
.pg-ped.on{background:var(--ok-soft)}
.pg-ped b{font-family:ui-monospace,Menlo,monospace;font-size:13px}.pg-ped small{display:block;color:var(--ink2);font-weight:700}
.pg-ped .m{margin-left:auto;font:600 16px var(--f-display)}
.pg-cnt{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:0 10px;border-radius:12px;border:3px solid var(--ok);color:var(--ok);font-weight:800;font-size:14px;background:var(--surf)}
.pg-cnt .bx{width:24px;height:24px;border-radius:8px;border:3px solid var(--ok);display:grid;place-items:center;color:#fff;flex:none}
.pg-cnt .bx .ic{width:16px;height:16px;opacity:0}
.pg-ped.on .pg-cnt{background:var(--ok);color:#fff;border-color:var(--ok)}
.pg-ped.on .pg-cnt .bx{background:#fff;color:var(--ok);border-color:#fff}.pg-ped.on .pg-cnt .bx .ic{opacity:1;animation:pop .3s}
.pg-tot{display:flex;align-items:center;gap:14px}
.pg-tot-t b{display:block;font:600 30px/1.05 var(--f-display)}.pg-tot-t small{color:var(--ink2);font-weight:800}
.pg-leg{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.pg-leg i{display:inline-flex;align-items:center;gap:5px;font-style:normal;font-size:12px;font-weight:800;color:var(--ink2)}
.pg-leg i:before{content:"";width:10px;height:10px;border-radius:3px;background:var(--lc)}
.pg-cols{display:flex;align-items:flex-end;gap:6px;height:150px;margin-top:10px}
.pg-col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;min-width:0}
.pg-col small{font-size:11px;font-weight:800;color:var(--ink3)}.pg-col .v{font-size:10.5px;font-weight:800;color:var(--ink2);white-space:nowrap}
.pg-stk{width:100%;display:flex;flex-direction:column;border-radius:8px 8px 3px 3px;overflow:hidden;transform-origin:bottom;animation:pg-grow .7s cubic-bezier(.3,1,.4,1) both;min-height:3px}
.pg-stk i{display:block;min-height:0}
.pg-colbtn{border-radius:10px;padding:2px;transition:background .15s}.pg-colbtn[aria-pressed=true]{background:var(--acc-soft)}
.pg-dia{border-radius:16px;background:var(--surf2);overflow:hidden}
.pg-dia-h{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;min-height:56px}
.pg-dia-h b{display:block;line-height:1.15}.pg-dia-h small{color:var(--ink2);font-weight:700}
.pg-dia-h .r{margin-left:auto;text-align:right;font:600 15px var(--f-display)}
.pg-dia-b{padding:4px 12px 12px;display:flex;flex-direction:column;gap:8px}
.pg-dia-b .row{display:flex;gap:8px}.pg-dia-b .row .btn{flex:1}
.pg-tab{width:100%;border-collapse:collapse;font-size:14px}
.pg-tab th{text-align:left;font-size:12px;color:var(--ink3);padding:4px 6px}.pg-tab td{padding:9px 6px;border-top:2px solid var(--line);font-weight:800}
.pg-tab td.r,.pg-tab th.r{text-align:right}
.pg-up{color:var(--ok)}.pg-down{color:var(--bad)}
.pg-k4{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pg-k{border-radius:18px;padding:12px;color:#fff;display:flex;flex-direction:column;gap:2px;animation:rise .45s both}
.pg-k b{font:600 32px/1 var(--f-display)}.pg-k small{font-weight:800;font-size:12.5px;opacity:.95}
.pg-k.claro{color:var(--sun-ink)}
.pg-lst{border-radius:18px;padding:10px;display:flex;flex-direction:column;gap:6px}
.pg-lst h4{font:600 16px var(--f-display);display:flex;gap:6px;align-items:center}
.pg-lst.bad{background:var(--bad-soft);color:var(--bad)}.pg-lst.warn{background:var(--warn-soft);color:var(--warn)}
.pg-li{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:var(--surf);color:var(--ink);font-weight:800}
.pg-li b{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;display:block}.pg-li small{color:var(--ink2);font-weight:700}.pg-li .m{margin-left:auto;font:600 15px var(--f-display)}
.pg-docbtn{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;padding:22px 16px;border-radius:26px;background:var(--c-comanda);color:#fff;font:600 21px var(--f-display);text-align:center;box-shadow:0 7px 0 rgba(0,0,0,.2);transition:transform .12s}
.pg-docbtn:active{transform:translateY(4px);box-shadow:0 3px 0 rgba(0,0,0,.2)}
.pg-docbtn small{font:700 14px var(--f-body);opacity:.92}
.pg-scan{position:relative;width:150px;height:190px;margin:6px auto;border-radius:14px;background:var(--surf2);overflow:hidden}
.pg-scan:after{content:"";position:absolute;left:0;right:0;top:6%;height:5px;background:var(--c-comanda);box-shadow:0 0 14px 4px var(--c-comanda);animation:pg-scan 1.2s ease-in-out infinite}
.pg-prog{height:12px;border-radius:6px;background:var(--surf2);overflow:hidden}.pg-prog i{display:block;height:100%;background:var(--c-comanda);animation:pg-fill 2s linear both}
.pg-steps{text-align:center;display:grid;gap:4px;font-weight:800;color:var(--ink2)}.pg-steps span{animation:rise .4s both}
.pg-vel{position:relative;max-width:300px;margin:0 auto}
.pg-needle{transition:transform 1.1s cubic-bezier(.3,1.4,.5,1)}
.pg-vel-c{position:absolute;left:0;right:0;bottom:2px;text-align:center}.pg-vel-c b{font:600 28px/1 var(--f-display);display:block}
.pg-radar polygon.v{transform-origin:100px 100px;animation:pg-zoom .8s cubic-bezier(.3,1.3,.5,1) both}
.pg-med{display:flex;align-items:center;gap:10px;padding:10px;border-radius:16px;background:var(--surf2)}
.pg-med .o{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:#fff;flex:none;box-shadow:inset 0 -4px 0 rgba(0,0,0,.18);animation:pop .5s both}
.pg-med b{display:block;line-height:1.15}.pg-med small{color:var(--ink2);font-weight:700}
.pg-ab{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pg-ab>div{border-radius:18px;padding:8px;background:var(--surf);text-align:center}
.pg-ab .l{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--c-stats);color:#fff;font-weight:800;margin-bottom:4px}
.pg-ab .nv{display:flex;align-items:center;gap:4px;justify-content:center}
.pg-ab .nv button{width:44px;height:44px;border-radius:14px;background:var(--surf2);display:grid;place-items:center;flex:none}
.pg-ab .nv button:disabled{opacity:.35}.pg-ab .nv span{flex:1;font-weight:800;font-size:13.5px;line-height:1.1}
.pg-chg{border-radius:22px;padding:16px;text-align:center;color:#fff;box-shadow:0 5px 0 rgba(0,0,0,.18)}
.pg-chg.up{background:var(--ok)}.pg-chg.down{background:var(--bad)}
.pg-chg b{display:block;font:600 40px/1.05 var(--f-display)}.pg-chg small{font-weight:800;opacity:.95}
.pg-mes{display:flex;align-items:flex-end;gap:8px;height:170px}
.pg-mes button{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;border-radius:14px;padding:4px 2px}
.pg-mes button[aria-pressed=true]{background:var(--acc-soft)}
.pg-mes .stk{width:100%;border-radius:10px 10px 4px 4px;background:var(--c-stats);transform-origin:bottom;animation:pg-grow .8s cubic-bezier(.3,1,.4,1) both}
.pg-mes button[aria-pressed=false] .stk{opacity:.55}
.pg-mes small{font-size:11px;font-weight:800;color:var(--ink2)}
.pg-hrow{display:flex;align-items:center;gap:8px;width:100%;min-height:52px;padding:8px 12px;border-radius:14px;background:var(--surf2);font-weight:800;font-size:14px;transition:transform .12s}
.pg-hrow:active{transform:scale(.98)}.pg-hrow + .pg-hrow{margin-top:6px}.pg-hrow .ic{margin-left:auto;width:18px;height:18px;color:var(--ink3);flex:none}
.pg-hrow .t{flex:1}.pg-hrow .t small{display:block;color:var(--ink2);font-weight:700}
.pg-ch{color:#fff}.pg-ch[aria-pressed=false]{opacity:.62}
.pg-find{display:flex;gap:8px}.pg-find .inp{flex:1}
.pg-big-inp{position:relative}.pg-big-inp .inp{min-height:60px;font-size:19px;padding-right:112px;padding-left:46px}
.pg-big-inp>.ic{position:absolute;left:14px;top:19px;color:var(--ink3)}
.pg-big-inp .borrar{position:absolute;right:6px;top:7px;height:46px;padding:0 14px;border-radius:12px;background:var(--c-buscar);color:#fff;font-weight:800;display:flex;align-items:center;gap:4px}
.pg-grp{font:600 15px var(--f-display);color:var(--ink2);margin:12px 2px 6px;display:flex;align-items:center;gap:8px}
.pg-grp:after{content:"";flex:1;height:2px;background:var(--line);border-radius:1px}
.pg-res{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;min-height:60px;border-radius:16px;background:var(--surf);transition:transform .12s}
.pg-res:active{transform:scale(.98)}.pg-res+.pg-res{margin-top:6px}
.pg-res .t{flex:1;min-width:0}.pg-res b{display:block;font-family:ui-monospace,Menlo,monospace;font-size:13px}
.pg-res small{display:block;color:var(--ink2);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pg-res .m{font:600 16px var(--f-display);white-space:nowrap}
.pg-ill{display:grid;place-items:center;gap:6px;padding:22px 10px;text-align:center;color:var(--ink2);font-weight:800}
.pg-inpwrap{margin-top:6px}
`);

/* ---------- ayudas de dibujo ---------- */
const pillE=(e,cls='')=>`<span class="pg-st ${estTono(e)} ${cls}">${e==='En curso'?I('clock'):e==='Por cobrar'?I('warn'):I('check')}${e}</span>`;
function colBar(label,val,segs,max,i,txt){
  const h=Math.max(val/max*86,val?4:0);
  return `<div class="pg-col"><span class="v">${txt!=null?txt:val}</span><div class="pg-stk" style="height:${h}%;animation-delay:${i*.06}s">${segs.map(s=>`<i style="flex:${Math.max(s.v,0)};background:${s.c}"></i>`).join('')}</div><small>${label}</small></div>`;
}
function ac(ctx,o){o.open=!!ctx.s.ab[o.id];return UI.ac(o)}
function trackAc(root,ctx){
  $$('.ac',root).forEach(a=>{const h=$('.ac-h',a),id=a.dataset.acid;if(!id)return;
    h.addEventListener('click',()=>{ctx.s.ab[id]=!a.classList.contains('open')});});
}
function chip(t,sel,a,c,extra=''){return `<button type="button" class="chip col pg-ch" style="background:${c}${extra}" aria-pressed="${!!sel}" ${a}>${t}</button>`}
function flecha(){return I('fwd')}
function difHtml(calc,monto){
  if(monto==null||isNaN(monto))return '';
  const d=monto-calc;
  if(d===0)return UI.aviso('Cuadra justo con lo calculado.','ok');
  if(d<0)return UI.aviso(`Te pagaron de menos: <b>${solC(-d)}</b> por reclamar.`,'bad');
  return UI.aviso(`Te pagaron de más: <b>${solC(d)}</b> a tu favor.`,'ok');
}
const parseC=v=>{const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:Math.round(n*100)};

/* =====================================================================
   PAGOS
   ===================================================================== */
function carretera(pct){
  const flags=[25,50,75,100].map(x=>`<span class="pg-fl ${pct>=x?'ok':''}" style="left:${x}%">${I('flag')}${x}</span>`).join('');
  return `<div class="pg-via" style="--p:${Math.min(100,pct)}%"><div class="pg-track">${flags}<div class="pg-asf"><i class="pg-lineas"></i></div><span class="pg-carro">${CAR(44)}</span></div></div>`;
}

function fuenteCard(ctx,f,w,d){
  const s=ctx.s,on=!!M.marc[f.k],abierta=s.abierta===f.k,tot=T[w];
  const pct=Math.round(f.m/tot*100);
  let det='';
  if(abierta){
    const dias=P[w].map((p,i)=>p?`<div class="pg-dd"><span>${dayLabel(w,i)}</span><span>${solC(dayF(w,i,f))}</span></div>`:'').join('');
    const peds=pedFu(w,f.k);
    const sh=s.faltan?peds.filter(r=>!isCont(r)):peds;
    const n=peds.filter(isCont).length;
    const filas=sh.map(r=>{const c=isCont(r);
      return `<div class="pg-ped ${c?'on':''}"><div><b>${r.c}</b><small>${r.t}</small></div><span class="m">${solC(r.m)}</span><button type="button" class="pg-cnt" data-act="cont" data-c="${r.c}" aria-pressed="${c}"><span class="bx">${I('check')}</span>La empresa contó este pedido</button></div>`}).join('');
    det=`<div class="pg-det"><b style="font-family:var(--f-display)">Días</b>${dias}${peds.length?`<b style="font-family:var(--f-display);margin-top:4px">Pedidos · ${n} de ${peds.length} contados por la empresa</b>${filas||UI.aviso('Todos están contados por la empresa.','ok')}`:`<p class="tiny">${f.k==='apoyo'?'Se paga por hora, no por pedido.':'Se paga por carrera.'}</p>`}</div>`;
  }
  return `<div class="pg-fu ${on?'on':''} ${f.claro?'claro':''} ${d||''}" style="--fc:${f.c}">
    <button type="button" class="pg-fu-top" data-act="fu" data-k="${f.k}" role="switch" aria-checked="${on}" aria-label="Sumar ${f.n}"><span class="pg-box">${I('check')}</span><span class="pg-fu-t"><b>${f.n}</b><small>${f.s} · ${pct} %</small></span><span class="pg-fu-m">${solC(f.m)}</span></button>
    <div class="pg-bar"><i style="width:${pct}%"></i></div>
    <button type="button" class="pg-ver" data-act="abrir" data-k="${f.k}" aria-expanded="${abierta}">${abierta?'Cerrar':'Ver días y pedidos'}${I('chev')}</button>${det}</div>`;
}

function barrasPagos(w,F){
  const marc=F.filter(f=>M.marc[f.k]);
  const vals=P[w].map((p,i)=>sum(marc.map(f=>dayF(w,i,f))));
  const mx=Math.max(...vals,1);
  return `<div class="pg-cols">${P[w].map((p,i)=>colBar(DN[i],vals[i],marc.map(f=>({v:dayF(w,i,f),c:f.c})),mx,i,vals[i]?Math.round(vals[i]/100):'')).join('')}</div>`;
}

function diaPanel(ctx,w){
  const s=ctx.s;
  return `<div style="display:flex;flex-direction:column;gap:8px">`+M.dias[w].map((e,i)=>{
    const lab=dayLabel(w,i),ab=s.dia===i;
    const pill=e==='c'?UI.pill('Cargado','ok','check'):e==='f'?UI.pill('Sin cargar','warn','warn'):e==='r'?UI.pill('Descanso','acc','moon'):UI.pill('Falta','','clock');
    const res=e==='c'?`${P[w][i]} pedidos · ${RU[w][i]} rutas`:e==='f'?'Aún no subes este día':e==='r'?'Día de descanso':'Todavía no llega';
    let body='';
    if(ab){
      if(e==='c')body=`<div class="pg-k4"><div class="kpi"><b>${P[w][i]}</b><small>Pedidos</small></div><div class="kpi"><b>${solC(dayMonto(w,i))}</b><small>Ganado</small></div></div><p class="tiny">${i===3&&w===0?'Cubierto por permanencia en tienda.':'Rutas con hora y entrega registradas.'}</p>${UI.btn({t:'Abrir en Inicio',i:'home',a:'data-go="inicio"'})}`;
      else if(e==='f')body=`<div class="row">${UI.btn({t:'Subir el día',i:'cargar',c:'var(--acc)',a:'data-sheet="cargar"'})}${UI.btn({t:'No trabajé',i:'moon',cls:'sec',a:`data-act="desc" data-i="${i}"`})}</div>`;
      else if(e==='r')body=UI.btn({t:'Quitar descanso',i:'refresh',cls:'sec',a:`data-act="quitar" data-i="${i}"`});
      else body='<p class="tiny">Este día todavía no llega.</p>';
    }
    return `<div class="pg-dia"><button type="button" class="pg-dia-h" data-act="dia" data-i="${i}" aria-expanded="${ab}"><span><b>${lab}</b><small>${res}</small></span><span class="r">${e==='c'?solC(dayMonto(w,i)):''}<br>${pill}</span></button>${ab?`<div class="pg-dia-b">${body}</div>`:''}</div>`;
  }).join('')+`</div>`;
}

function zonaPanel(){
  const cnt={};DATA.pedidos.forEach(p=>{if(p.z){const c=cnt[p.z]=cnt[p.z]||{n:0,m:0};c.n++;c.m+=p.m}});
  const mx=Math.max(...Object.values(cnt).map(x=>x.n));
  const col={Miraflores:'var(--c-comanda)',Surquillo:'var(--c-cantidad)','Santiago de Surco':'var(--c-apoyo)',Chorrillos:'var(--c-mano)'};
  return Object.entries(cnt).map(([z,c])=>`<div><div style="display:flex;justify-content:space-between;font-weight:800"><span>${z}</span><span>${c.n} · ${solC(c.m)}</span></div><div class="barra"><i style="width:${c.n/mx*100}%;background:${col[z]||'var(--acc)'}"></i></div></div>`).join('');
}

function cobroPanel(ctx,w){
  const calc=T[w],pg=M.pagado[w],val=ctx.s.cobro!=null?ctx.s.cobro:pg;
  const soloPed=roundC(calc*0.84);
  return `<div class="pg-dd"><span>Se paga el</span><span>${PAGA[w]}</span></div>
  <div class="pg-dd"><span>Tiempo en ruta</span><span>${HRS[w]} h</span></div>
  <div class="pg-dd"><span>Calculado</span><span>${solC(calc)}</span></div>
  <div class="pg-dd"><span>Solo por pedidos habría sido</span><span>${solC(soloPed)}</span></div>
  <label class="lbl" for="pg-cobro" style="margin:4px 0 0">¿Cuánto te pagaron?</label>
  <input class="inp" id="pg-cobro" type="number" inputmode="decimal" step="0.01" placeholder="${(calc/100).toFixed(2)}" value="${val!=null?(val/100).toFixed(2):''}">
  <div id="pg-dif">${difHtml(calc,val)}</div>
  ${UI.btn({t:pg!=null?'Registrar de nuevo':'Registrar pago',i:'wallet',cls:'ok',a:'data-act="registrar"'})}
  ${pg!=null?UI.btn({t:'Reabrir la semana',i:'refresh',cls:'sec',a:'data-act="reabrir"'}):''}`;
}

function tarifaPanel(){
  return `<table class="pg-tab"><tr><th>Zona</th><th>Distrito</th><th class="r">Por pedido</th></tr>${DATA.zonasAurora.map((z,i)=>`<tr><td>${i+1}</td><td>${z.n}</td><td class="r">${solC(z.m)}</td></tr>`).join('')}</table>${UI.aviso('Garantía por permanencia: S/ 130.00 al día en tu tienda si lo ganado por pedidos es menos.','','shield')}`;
}

function otrasPanel(w){
  return [0,1,2,3,4].map(i=>{const e=estadoSem(i);
    return UI.fila({t:'Sem. '+RANGO[i],s:e,i:i===w?'check':'wallet',c:i===w?'var(--c-pagos)':'var(--ink3)',der:solC(T[i]),a:`data-act="sem" data-w="${i}"`});}).join('');
}

App.screen('pagos',{
  titulo:'Pagos',icono:'wallet',tab:'pagos',
  render(ctx){
    const s=ctx.s;s.ab=s.ab||{};s.abierta=s.abierta||null;
    const w=M.w,F=fuentes(w),tot=T[w],pct=Math.round(tot/META*100),rz=s.vp===ctx.p?'':'rise';
    const e=estadoSem(w),falta=diasFalta(w),hora=Math.round(tot/HRS[w]);
    const marc=marcTotal(w),seg=F.filter(f=>M.marc[f.k]).map(f=>({m:f.m,c:f.c}));
    const peds=F.reduce((n,f)=>n+pedFu(w,f.k).length,0),cont=F.reduce((n,f)=>n+pedFu(w,f.k).filter(isCont).length,0);
    return `<div class="${rz}">
    <div class="pg-sel"><button type="button" class="pg-arr" data-act="ant" aria-label="Semana anterior" ${w>=4?'disabled':''}>${I('back')}</button>
      <div class="pg-sel-c"><b>Sem. ${RANGO[w]}</b><small>Se paga el ${PAGA[w]}</small></div>
      <button type="button" class="pg-arr" data-act="sig" aria-label="Semana siguiente" ${w<=0?'disabled':''}>${I('fwd')}</button></div>
    ${w?`<div style="margin-bottom:10px">${UI.btn({t:'Volver a hoy',i:'cal',cls:'sun sm',a:'data-act="hoy"'})}</div>`:''}
    <div class="pg-hero"><div class="pg-hero-t"><span class="l">Total de la semana</span>${pillE(e)}</div>
      <b class="pg-big" id="pg-tot">${solC(0)}</b>
      <p>${sumP(w)} pedidos · ${sumR(w)} rutas</p>
      ${carretera(pct)}
      <div class="pg-meta"><span>${pct>=100?'¡Meta cumplida!':`${pct} % de la meta · faltan ${solC(Math.max(0,META-tot))}`}</span><span class="pill">${I('clock')}${solC(hora*100)} por hora</span></div></div>
    ${w===0&&falta?`<button type="button" class="pg-ban" data-act="verfal">${I('warn')}<span>Faltan ${falta} días por subir</span><span class="fwd">${I('fwd')}</span></button>`:''}
    <h3 class="titulo-s">Marca lo que quieres sumar</h3>
    <p class="pg-sub">Toca cada color para sumarlo o quitarlo.</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">${UI.chip((s.faltan?'Viendo solo los que faltan':'Ver solo los que faltan'),s.faltan,'data-act="faltan"')}<span class="tiny">${cont} de ${peds} contados</span>${M.cotejado&&w===0?UI.pill('Cotejado con la empresa','ok','check'):''}</div>
    ${F.map((f,i)=>fuenteCard(ctx,f,w,'')).join('')}
    <div class="card" style="margin-top:6px"><div class="pg-tot">${UI.ring(seg,`<small class="tiny">${seg.length} de 4</small>`,128,16)}<div class="pg-tot-t"><small>Total de lo marcado</small><b id="pg-marc">${solC(0)}</b><div class="pg-leg">${F.filter(f=>M.marc[f.k]).map(f=>`<i style="--lc:${f.c}">${f.k==='expo'?'Expo':f.n.split(' ')[0]}</i>`).join('')||'<span class="tiny">Marca al menos uno</span>'}</div></div></div>
      ${barrasPagos(w,F)}</div>
    <div style="margin:14px 0 4px">${UI.btn({t:'Subir el reporte de la empresa',i:'doc',c:'var(--c-comanda)',cls:'',a:'data-sheet="cotejo"'})}</div>
    <div style="margin-top:12px">
    ${ac(ctx,{id:'dias',t:'Día por día',s:`${diasCarg(w)} cargados${falta?' · '+falta+' sin subir':''}`,c:'var(--c-pagos)',i:'cal',body:diaPanel(ctx,w)})}
    ${ac(ctx,{id:'zona',t:'Por zona',s:'Dónde fueron tus entregas',c:'var(--c-comanda)',i:'map',body:zonaPanel()})}
    ${ac(ctx,{id:'cobro',t:'Cobro',s:e==='Pagada'?'Pagada · '+solC(M.pagado[w]):'Registra lo que te pagaron',c:'var(--c-pagos)',i:'coins',body:cobroPanel(ctx,w)})}
    ${ac(ctx,{id:'tarifa',t:'Tarifa vigente',s:'Wong Aurora',c:'var(--c-adic)',i:'store',body:tarifaPanel()})}
    ${ac(ctx,{id:'otras',t:'Otras semanas',s:'Toca una para verla',c:'var(--c-historial)',i:'history',body:otrasPanel(w)})}
    </div></div>`;
  },
  mount(el,ctx){
    const s=ctx.s,w=M.w;s.vp=ctx.p;
    trackAc(el,ctx);
    const h=$('#pg-tot',el),m=$('#pg-marc',el);
    if(h){UI.count(h,T[w],fmt.sol,s.prevHero!=null&&s.prevW===w?s.prevHero:0);s.prevHero=T[w];s.prevW=w}
    if(m){UI.count(m,marcTotal(w),fmt.sol,s.prevMarc!=null&&s.prevMW===w?s.prevMarc:0);s.prevMarc=marcTotal(w);s.prevMW=w}
    const inp=$('#pg-cobro',el);
    if(inp)inp.addEventListener('input',()=>{s.cobro=parseC(inp.value);$('#pg-dif',el).innerHTML=difHtml(T[M.w],s.cobro)});
    if(s.irDia){s.irDia=false;const a=$('[data-acid="dias"]',el);if(a&&a.scrollIntoView)a.scrollIntoView({block:'center'})}
  },
  acts:{
    ant(el,ev,ctx){if(M.w<4){M.w++;ctx.s.abierta=null;ctx.s.dia=null;ctx.s.cobro=null}},
    sig(el,ev,ctx){if(M.w>0){M.w--;ctx.s.abierta=null;ctx.s.dia=null;ctx.s.cobro=null}},
    hoy(el,ev,ctx){M.w=0;ctx.s.abierta=null;ctx.s.dia=null;ctx.s.cobro=null;App.toast('Esta semana')},
    sem(el,ev,ctx){M.w=+el.dataset.w;ctx.s.abierta=null;ctx.s.dia=null;ctx.s.cobro=null;ctx.s.irTop=true},
    fu(el){const k=el.dataset.k;M.marc[k]=!M.marc[k]},
    abrir(el,ev,ctx){ctx.s.abierta=ctx.s.abierta===el.dataset.k?null:el.dataset.k},
    cont(el){const c=el.dataset.c;const r=[...pedFu(M.w,'tienda'),...pedFu(M.w,'expo')].find(x=>x.c===c);M.cont[c]=r?!isCont(r):true},
    faltan(el,ev,ctx){ctx.s.faltan=!ctx.s.faltan},
    dia(el,ev,ctx){const i=+el.dataset.i;ctx.s.dia=ctx.s.dia===i?null:i},
    desc(el,ev,ctx){M.dias[M.w][+el.dataset.i]='r';ctx.s.dia=null;App.toast('Día de descanso anotado')},
    quitar(el,ev,ctx){M.dias[M.w][+el.dataset.i]='f';ctx.s.dia=null;App.toast('Descanso quitado')},
    verfal(el,ev,ctx){ctx.s.ab.dias=true;ctx.s.dia=M.dias[M.w].indexOf('f');ctx.s.irDia=true},
    registrar(el,ev,ctx){App.openSheet('pago-registrar',{w:M.w,monto:ctx.s.cobro!=null?ctx.s.cobro:undefined});return false},
    reabrir(el,ev,ctx){delete M.pagado[M.w];ctx.s.cobro=null;App.toast('Semana reabierta','warn')}
  },
  cambios:['Cada fuente es un botón de color con casilla grande: apagas o enciendes y el total se recalcula al instante.','La carretera con el carro muestra la meta de un vistazo, en lugar de solo un porcentaje.','Subir el reporte de la empresa es ahora un botón grande, no un enlace.','Los días sin subir tienen su banner ámbar y botones para subir o marcar descanso.','Cada pedido se marca como contado con una casilla verde que pinta toda la fila.']
});

/* ---------- HOJA: cotejo con el reporte de la empresa ---------- */
const COT_ROJO=[{c:'v12340122wofp-01',f:'Lun 26/10',m:1000},{c:'v12340377wofp-01',f:'Lun 26/10',m:1000},{c:'v12341205wofp-01',f:'Jue 29/10',m:1000}];
const COT_AMBAR=[{c:'v12344999wofp-01',f:'Mar 27/10',m:950},{c:'v12345012wofp-01',f:'Mié 28/10',m:950}];
const docSvg=(w=96)=>`<svg width="${w}" height="${Math.round(w*1.2)}" viewBox="0 0 96 116" aria-hidden="true"><rect x="8" y="4" width="72" height="100" rx="10" fill="#fff"/><rect x="8" y="4" width="72" height="100" rx="10" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="3"/><path d="M22 28h44M22 42h44M22 56h30M22 70h38" stroke="#1f5cff" stroke-width="5" stroke-linecap="round" opacity=".55"/><circle cx="72" cy="88" r="20" fill="#ffc800"/><path d="M63 88l7 7 12-14" fill="none" stroke="#0a2260" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
App.sheet('cotejo',{
  titulo:'Reporte de la empresa',sub:'Compara lo que ellos contaron con lo tuyo',k:'comanda',icono:'doc',full:true,
  render(ctx){
    const f=ctx.s.fase||0;
    if(f===0)return `<div class="rise"><button type="button" class="pg-docbtn" data-act="elegir"><span class="bob">${docSvg(92)}</span>Elegir la imagen del reporte<small>Una captura o foto de la hoja de la empresa</small></button></div>
      ${UI.aviso('La imagen se lee aquí mismo, en tu celular. No se envía a ningún lado.','','shield')}
      <div class="grid3">${['Código por código','Tarda unos segundos','Tú decides qué marcar'].map((t,i)=>`<div class="kpi rise d${i+1}"><small>${t}</small></div>`).join('')}</div>`;
    if(f===1)return `<div class="rise"><div class="pg-scan">${docSvg(150).replace('height="180"','height="190"')}</div><div class="pg-prog"><i></i></div></div>
      <div class="pg-steps"><span>Abriendo la imagen…</span><span style="animation-delay:.6s">Leyendo los códigos…</span><span style="animation-delay:1.2s">Comparando con tus pedidos…</span></div>`;
    const sinCod=1,tot=COT_ROJO.reduce((n,x)=>n+x.m,0);
    const li=(x,m)=>`<div class="pg-li"><div><b>${x.c}</b><small>${x.f}</small></div><span class="m">${solC(x.m)}</span></div>`;
    return `<div class="pg-k4">
      <div class="pg-k" style="background:var(--c-comanda)"><b data-n="75">75</b><small>La empresa contó</small></div>
      <div class="pg-k" style="background:var(--ok);animation-delay:.08s"><b>72</b><small>Coinciden</small></div>
      <div class="pg-k claro" style="background:var(--sun);animation-delay:.16s"><b>2</b><small>No los tienes registrados</small></div>
      <div class="pg-k" style="background:var(--bad);animation-delay:.24s"><b>3</b><small>Tuyos que no contó</small></div></div>
    <div class="pg-lst bad rise d2"><h4>${I('x')}Tú los tienes y la empresa no los contó (3 · ${solC(tot)})</h4>${COT_ROJO.map(li).join('')}</div>
    <div class="pg-lst warn rise d3"><h4>${I('warn')}La empresa los contó y no los tienes (2)</h4>${COT_AMBAR.map(li).join('')}</div>
    ${UI.aviso(`Hay ${sinCod} pedido sin código en el reporte. No se pudo comparar: revísalo a mano.`,'warn')}`;
  },
  pie(ctx){
    const f=ctx.s.fase||0;
    if(f<2)return UI.btn({t:f===0?'Primero elige la imagen':'Leyendo…',cls:'sec dis'});
    return UI.btn({t:'Marcar como contados los 72 que coinciden',i:'check',cls:'ok',a:'data-act="aplicar"'});
  },
  acts:{
    elegir(el,ev,ctx){ctx.s.fase=1;setTimeout(()=>{if(App.sheetCtx===ctx){ctx.s.fase=2;App.refresh()}},2100)},
    aplicar(el,ev,ctx){
      DATA.pedidos.forEach(p=>{M.cont[p.c]=true});
      pedFu(0,'expo').forEach(r=>{M.cont[r.c]=true});
      M.cotejado=true;App.confetti();App.toast('¡Listo! 72 pedidos marcados');App.closeSheet();App.draw(false);return false;
    }
  },
  cambios:['Un solo botón gigante para elegir la imagen; ya no hay pasos escondidos.','Mientras lee, una animación muestra que la app está trabajando.','Cuatro cifras de color: verde coincide, rojo falta, ámbar sobra.','Un botón verde marca de golpe todos los que coinciden.']
});

/* ---------- HOJA: registrar pago ---------- */
App.sheet('pago-registrar',{
  titulo:'Registrar pago',k:'pagos',icono:'wallet',
  sub(ctx){return 'Sem. '+RANGO[ctx.p.w!=null?ctx.p.w:M.w]},
  render(ctx){
    const s=ctx.s,w=ctx.p.w!=null?ctx.p.w:M.w,calc=T[w];
    if(s.monto==null)s.monto=ctx.p.monto!=null?ctx.p.monto:(M.pagado[w]!=null?M.pagado[w]:calc);
    return `<div class="rise" style="text-align:center"><small class="tiny">Calculado: ${solC(calc)}</small>
      <b class="num" id="pr-m" style="display:block;font-size:46px;line-height:1.1;margin:4px 0 8px">${solC(s.monto)}</b></div>
    <label class="lbl" for="pr-in">Escribe lo que te pagaron</label>
    <input class="inp" id="pr-in" type="number" inputmode="decimal" step="0.01" value="${(s.monto/100).toFixed(2)}">
    <div class="grid3" style="grid-template-columns:repeat(4,1fr)">${[[-1000,'−10'],[-100,'−1'],[100,'+1'],[1000,'+10']].map(([d,t])=>`<button type="button" class="chip sun" style="justify-content:center;padding:0" data-act="ajuste" data-d="${d}">${t}</button>`).join('')}</div>
    <button type="button" class="chip col" style="background:var(--c-pagos);justify-content:center" data-act="calc">${I('check')}Es justo lo calculado</button>
    <div id="pr-dif">${difHtml(calc,s.monto)}</div>`;
  },
  pie(ctx){return UI.btn({t:'Guardar',i:'check',cls:'ok',a:'data-act="guardar"'})},
  mount(h,ctx){
    const inp=$('#pr-in',h),w=ctx.p.w!=null?ctx.p.w:M.w;
    if(inp)inp.addEventListener('input',()=>{const v=parseC(inp.value);if(v==null)return;ctx.s.monto=v;$('#pr-m',h).textContent=solC(v);$('#pr-dif',h).innerHTML=difHtml(T[w],v)});
  },
  acts:{
    ajuste(el,ev,ctx){ctx.s.monto=Math.max(0,(ctx.s.monto||0)+ +el.dataset.d)},
    calc(el,ev,ctx){const w=ctx.p.w!=null?ctx.p.w:M.w;ctx.s.monto=T[w]},
    guardar(el,ev,ctx){const w=ctx.p.w!=null?ctx.p.w:M.w;M.pagado[w]=ctx.s.monto;App.confetti();App.toast('¡Pago guardado!');App.closeSheet();App.draw(false);return false}
  },
  cambios:['El monto se ve enorme y se cambia con botones de +1 y +10, o escribiendo.','La diferencia aparece en vivo: verde si sobra, roja si falta.','Un solo botón: Guardar.']
});

/* =====================================================================
   ESTADÍSTICAS
   ===================================================================== */
const wName=w=>'Sem. '+RANGO[w];
const dow=w=>diasCarg(w)||P[w].filter(x=>x).length;
const prom=w=>Math.round(T[w]/Math.max(1,P[w].filter(x=>x).length));
const lejos=w=>Math.round(sumP(w)*0.22);

function velocimetro(w,F){
  const tot=T[w],L=Math.PI*80,den=Math.max(META,tot);let acc=0;
  const arc='M 20 100 A 80 80 0 0 1 180 100';
  const segs=F.map(f=>{const l=f.m/den*L,o=-acc;acc+=l;return `<path d="${arc}" fill="none" stroke-width="16" style="stroke:${f.c};stroke-dasharray:${Math.max(l-2,0)} ${L};stroke-dashoffset:${o}"/>`}).join('');
  const ang=-90+180*Math.min(1,tot/META);
  const ticks=[0,25,50,75,100].map(p=>{const a=(-180+1.8*p)*Math.PI/180;return `<line x1="${100+68*Math.cos(a)}" y1="${100+68*Math.sin(a)}" x2="${100+60*Math.cos(a)}" y2="${100+60*Math.sin(a)}" stroke="var(--ink3)" stroke-width="2"/>`}).join('');
  return `<div class="pg-vel"><svg viewBox="0 0 200 118" width="100%" aria-label="Velocímetro de meta"><path d="${arc}" fill="none" stroke-width="16" style="stroke:var(--surf2)"/>${segs}${ticks}<g class="pg-needle" data-ang="${ang}" style="transform-origin:100px 100px;transform:rotate(-90deg)"><path d="M96 100 L100 36 L104 100z" style="fill:var(--ink)"/></g><circle cx="100" cy="100" r="9" style="fill:var(--ink)"/><circle cx="100" cy="100" r="3.5" fill="#ffc800"/><text x="20" y="116" font-size="9" font-weight="800" text-anchor="middle" style="fill:var(--ink3)">0</text><text x="180" y="116" font-size="9" font-weight="800" text-anchor="middle" style="fill:var(--ink3)">${Math.round(META/100)}</text></svg>
  <div class="pg-vel-c"><b>${Math.round(tot/META*100)} %</b></div></div>`;
}
function radar(w){
  const base=[58,18,6,3,1],k=sumP(w)/86,vals=base.map(v=>Math.max(1,Math.round(v*k)));
  const mx=Math.max(...vals),cx=100,cy=100,R=60,lab=['0–3 km','3–8','8–10','10–11','11–12'];
  const pt=(i,r)=>{const a=(-90+72*i)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)]};
  const ring=f=>[0,1,2,3,4].map(i=>pt(i,R*f).map(x=>x.toFixed(1)).join(',')).join(' ');
  return `<svg class="pg-radar" viewBox="0 0 200 200" width="100%" style="max-width:260px;display:block;margin:auto" aria-label="Pedidos por distancia">${[.25,.5,.75,1].map(f=>`<polygon points="${ring(f)}" fill="none" style="stroke:var(--line)" stroke-width="2"/>`).join('')}${[0,1,2,3,4].map(i=>{const [x,y]=pt(i,R);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" style="stroke:var(--line)" stroke-width="1.5"/>`}).join('')}<polygon class="v" points="${vals.map((v,i)=>pt(i,R*v/mx).map(x=>x.toFixed(1)).join(',')).join(' ')}" style="fill:var(--c-stats);stroke:var(--c-stats)" fill-opacity=".35" stroke-width="3"/>${vals.map((v,i)=>{const [x,y]=pt(i,R*v/mx);return `<circle cx="${x}" cy="${y}" r="4" style="fill:var(--c-stats)"/>`}).join('')}${lab.map((t,i)=>{const [x,y]=pt(i,R+17);return `<text x="${x}" y="${y+3}" font-size="10" font-weight="800" text-anchor="middle" style="fill:var(--ink2)">${t} · ${vals[i]}</text>`}).join('')}</svg>`;
}
function medalla(c,ic,t,s,i){return `<div class="pg-med"><span class="o" style="background:${c};animation-delay:${i*.08}s">${I(ic)}</span><div><b>${t}</b><small>${s}</small></div></div>`}

function statsSemana(ctx){
  const s=ctx.s,w=s.A,F=fuentes(w),tot=T[w];
  const vals=P[w].map((p,i)=>s.barra==='sol'?dayMonto(w,i):p),mx=Math.max(...vals,1);
  const cols=P[w].map((p,i)=>{
    const v=vals[i],far=s.barra==='sol'?roundC(v*.22):Math.round(v*.22);
    return colBar(DN[i],v,[{v:far,c:'var(--warn)'},{v:v-far,c:'var(--c-stats)'}],mx,i,v?(s.barra==='sol'?Math.round(v/100):v):'');
  }).join('');
  return `<div class="pg-sel"><button type="button" class="pg-arr" data-act="a-ant" aria-label="Semana anterior" ${w>=4?'disabled':''}>${I('back')}</button><div class="pg-sel-c"><b>${wName(w)}</b><small>${estadoSem(w)}</small></div><button type="button" class="pg-arr" data-act="a-sig" aria-label="Semana siguiente" ${w<=0?'disabled':''}>${I('fwd')}</button></div>
  <div class="pg-k4">
    <div class="pg-k" style="background:var(--c-comanda)"><b>${sumP(w)}</b><small>Pedidos</small></div>
    <div class="pg-k" style="background:var(--c-pagos);animation-delay:.07s"><b>${solC(tot)}</b><small>Soles</small></div>
    <div class="pg-k" style="background:var(--c-stats);animation-delay:.14s"><b>${P[w].filter(x=>x).length}</b><small>Días trabajados</small></div>
    <div class="pg-k claro" style="background:var(--sun);animation-delay:.21s"><b>${solC(prom(w))}</b><small>Promedio por día</small></div></div>
  <div class="card" style="margin-top:12px"><h3>Tu meta de la semana</h3>${velocimetro(w,F)}<p class="tiny" style="text-align:center">${solC(tot)} de ${solC(META)}</p></div>
  <div class="card" style="margin-top:12px"><h3>De dónde viene</h3><div class="pg-tot">${UI.ring(F.map(f=>({m:f.m,c:f.c})),`<b class="num" style="font-size:18px">${solC(tot)}</b>`,140,18)}<div style="flex:1;display:flex;flex-direction:column;gap:6px">${F.map(f=>`<div style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:13px"><span style="width:12px;height:12px;border-radius:4px;background:${f.c};flex:none"></span><span style="flex:1">${f.n.split(' ·')[0]}</span><span>${Math.round(f.m/tot*100)} %</span></div>`).join('')}</div></div></div>
  <div class="card" style="margin-top:12px"><h3>Por día</h3>${UI.seg('barra',[['ped','Pedidos'],['sol','Soles']],s.barra)}
    <div class="pg-cols">${cols}</div><div class="pg-leg" style="justify-content:center"><i style="--lc:var(--c-stats)">Hasta 3 km</i><i style="--lc:var(--warn)">Más de 3 km</i></div></div>`;
}
function statsMes(ctx){
  const s=ctx.s,mx=Math.max(...T),sel=s.mes,w=sel;
  const order=[4,3,2,1,0];
  return `<div class="card"><h3>Semanas del mes</h3><div class="pg-mes">${order.map((i,n)=>`<button type="button" data-act="mes" data-w="${i}" aria-pressed="${i===sel}" aria-label="${wName(i)}"><small>${Math.round(T[i]/100)}</small><span class="stk" style="height:${T[i]/mx*78}%;animation-delay:${n*.08}s"></span><small>${RANGO[i].split(' ')[0]}</small></button>`).join('')}</div></div>
  <div class="card" style="margin-top:12px"><h3>${wName(w)}</h3><div class="pg-k4"><div class="kpi"><b>${sumP(w)}</b><small>Pedidos</small></div><div class="kpi"><b>${solC(T[w])}</b><small>Soles</small></div><div class="kpi"><b>${sumR(w)}</b><small>Rutas</small></div><div class="kpi"><b>${HRS[w]} h</b><small>En ruta</small></div></div></div>
  <div class="aviso ok" style="margin-top:12px">${I('coins')}<div>Entre las 5 semanas sumas <b>${solC(sum(T))}</b> y <b>${sum(T.map((_,i)=>sumP(i)))}</b> pedidos.</div></div>`;
}
function statsComparar(ctx){
  const s=ctx.s,a=s.A,b=s.B;
  const ph=w=>Math.round(T[w]/HRS[w]*1);
  const rows=[['Pedidos',sumP(a),sumP(b),n=>String(n)],['Rutas',sumR(a),sumR(b),n=>String(n)],['Soles',T[a],T[b],solC],['Por hora',ph(a)*100,ph(b)*100,solC],['Promedio por día',prom(a),prom(b),solC]];
  const d=T[a]-T[b],up=d>=0,pc=Math.round(Math.abs(d)/T[b]*100);
  const sel=(k,w,lab)=>`<div><span class="l">${lab}</span><div class="nv"><button type="button" data-act="${k}-ant" aria-label="Más antigua" ${w>=4?'disabled':''}>${I('back')}</button><span>${wName(w)}</span><button type="button" data-act="${k}-sig" aria-label="Más reciente" ${w<=0?'disabled':''}>${I('fwd')}</button></div></div>`;
  return `<div class="pg-ab">${sel('a',a,'A')}${sel('b',b,'B')}</div>
  <div class="pg-chg ${up?'up':'down'}" style="margin-top:12px"><small>${up?'A ganó más que B':'A ganó menos que B'}</small><b>${up?'▲':'▼'} ${solC(Math.abs(d))}</b><small>${pc} % ${up?'más':'menos'}</small></div>
  <div class="card" style="margin-top:12px"><h3>Cifra por cifra</h3><table class="pg-tab"><tr><th></th><th class="r">A</th><th class="r">B</th><th class="r">Cambio</th></tr>${rows.map(([n,x,y,f])=>{const dd=x-y;return `<tr><td>${n}</td><td class="r">${f(x)}</td><td class="r">${f(y)}</td><td class="r ${dd>=0?'pg-up':'pg-down'}">${dd>=0?'▲':'▼'} ${f(Math.abs(dd))}</td></tr>`}).join('')}</table></div>`;
}

App.screen('stats',{
  titulo:'Estadísticas',icono:'bars',tab:'stats',
  render(ctx){
    const s=ctx.s;s.ab=s.ab||{};s.vista=s.vista||'sem';s.barra=s.barra||'ped';
    if(s.A==null){s.A=0;s.B=1;s.mes=0}
    const w=s.A,rz=s.vp===ctx.p?'':'rise';
    const cuerpo=s.vista==='mes'?statsMes(ctx):s.vista==='comp'?statsComparar(ctx):statsSemana(ctx);
    const rec=[['var(--c-pagos)','coins','Mejor día','Lun 26/10 · 44 pedidos'],['var(--warn)','fire','Racha más larga','9 días seguidos'],['var(--c-stats)','star','Mejor semana','Sem. 5–11 oct · '+solC(T[3])],['var(--c-apoyo)','bolt','Mejor por hora',solC(2100)+' en una ruta'],['var(--c-comanda)','flag','Más rutas en un día','5 rutas · Mar 20/10']];
    return `<div class="${rz}">${UI.seg('vista',[['sem','Semana'],['comp','Comparar'],['mes','Mes']],s.vista)}
    <div style="margin-top:12px">${cuerpo}</div>
    <div style="margin-top:14px">
    ${ac(ctx,{id:'tiempos',t:'Tiempos',s:`${HRS[w]} h en ruta`,c:'var(--c-comanda)',i:'clock',body:`<div class="pg-dd"><span>Tiempo en ruta</span><span>${HRS[w]} h 20 min</span></div><div class="pg-dd"><span>Promedio por ruta</span><span>${Math.round(HRS[w]*60/sumR(w))} min</span></div><div class="pg-dd"><span>Salida más temprana</span><span>08:15</span></div><div class="pg-dd"><span>Horas en tienda</span><span>${Math.round(HRS[w]*1.3)} h</span></div>`})}
    ${ac(ctx,{id:'ingresos',t:'Ingresos',s:solC(T[w]),c:'var(--c-pagos)',i:'coins',body:fuentes(w).map(f=>`<div><div style="display:flex;justify-content:space-between;font-weight:800"><span>${f.n}</span><span>${solC(f.m)}</span></div><div class="barra"><i style="width:${f.m/T[w]*100}%;background:${f.c};animation:pg-growx .8s both;transform-origin:left"></i></div></div>`).join('')+`<div class="pg-dd"><span>Promedio por pedido</span><span>${solC(Math.round(T[w]/sumP(w)))}</span></div>`})}
    ${ac(ctx,{id:'dist',t:'Por distancia',s:`${lejos(w)} de más de 3 km`,c:'var(--c-stats)',i:'route',body:radar(w)})}
    ${ac(ctx,{id:'records',t:'Récords',s:'Tus mejores marcas',c:'var(--sun)',claro:true,i:'star',body:rec.map((r,i)=>medalla(r[0],r[1],r[2],r[3],i)).join('')})}
    </div>
    <div style="margin-top:14px">${UI.btn({t:'Exportar a PDF',i:'download',c:'var(--c-stats)',a:'data-toast="PDF listo (demostración)" data-confetti'})}</div></div>`;
  },
  mount(el,ctx){
    ctx.s.vp=ctx.p;trackAc(el,ctx);
    const g=$('.pg-needle',el);
    if(g)setTimeout(()=>{g.style.transform=`rotate(${g.dataset.ang}deg)`},80);
  },
  acts:{
    'a-ant'(el,ev,ctx){if(ctx.s.A<4)ctx.s.A++},'a-sig'(el,ev,ctx){if(ctx.s.A>0)ctx.s.A--},
    'b-ant'(el,ev,ctx){if(ctx.s.B<4)ctx.s.B++},'b-sig'(el,ev,ctx){if(ctx.s.B>0)ctx.s.B--},
    mes(el,ev,ctx){ctx.s.mes=+el.dataset.w}
  },
  cambios:['Tres pestañas simples: Semana, Comparar y Mes.','Un velocímetro con aguja muestra tu meta; el arco tiene un color por fuente.','Las barras por día cambian entre pedidos y soles, y marcan los de más de 3 km.','Comparar usa flechas-botón y una tarjeta verde o roja que dice si subiste o bajaste.','Los detalles quedan en acordeones de color.']
});

/* =====================================================================
   HISTORIAL
   ===================================================================== */
function histDias(ctx){
  const s=ctx.s,ws=s.rango==='sem'?[0]:[0,1,2,3,4];
  return ws.map(w=>{
    const filas=[];for(let i=6;i>=0;i--)if(M.dias[w][i]==='c')filas.push(`<button type="button" class="pg-hrow" data-go="inicio"><span class="t">${dayLabel(w,i)} · ${P[w][i]} pedidos · ${RU[w][i]} rutas · ${solC(dayMonto(w,i))}</span>${I('fwd')}</button>`);
    return ac(ctx,{id:'h'+w,t:'Sem. '+RANGO[w],s:`${sumP(w)} pedidos`,der:solC(T[w]),c:w===0?'var(--c-historial)':'var(--ink3)',i:'cal',body:filas.join('')||'<p class="tiny">Sin días cargados.</p>'});
  }).join('');
}
function listaPed(arr,n){
  let last='';
  return arr.slice(0,n).map(p=>{const g=dl(p.d);let h='';if(g!==last){last=g;h=`<div class="pg-grp">${g}</div>`}
    const e=DATA.estado[p.e];
    return h+`<button type="button" class="pg-res" data-go="inicio"><span class="t"><b>${p.c}</b><small>${p.cli} · ${p.r?'Ruta '+p.r:'Sin ruta'}</small></span>${UI.pill(e[0],e[1])}<span class="m">${solC(p.m)}</span></button>`}).join('');
}
App.screen('historial',{
  titulo:'Historial',icono:'history',
  render(ctx){
    const s=ctx.s;s.ab=s.ab||{};s.modo=s.modo||'dia';s.rango=s.rango||'sem';s.q=s.q||'';s.n=s.n||8;
    const rz=s.vp===ctx.p?'':'rise';
    const lim=s.rango==='sem'?new Date(2026,9,26):new Date(2026,8,28);
    let arr=PED.filter(p=>p.d>=lim);
    const buscando=!!s.q;
    if(buscando)arr=arr.filter(p=>p.c.toLowerCase().includes(s.q.toLowerCase()));
    const ws=s.rango==='sem'?[0]:[0,1,2,3,4];
    const totP=sum(ws.map(sumP)),totM=sum(ws.map(w=>T[w]));
    const modoPed=s.modo==='ped'||buscando;
    return `<div class="${rz}">${UI.seg('modo',[['dia','Por día'],['ped','Pedidos',PED.filter(p=>p.d>=lim).length]],s.modo)}
    <div style="display:flex;gap:8px;margin:10px 0">${chip('Semana',s.rango==='sem','data-act="rango" data-v="sem"','var(--c-historial)','')}${chip('Mes',s.rango==='mes','data-act="rango" data-v="mes"','var(--c-historial)','')}</div>
    <div class="card"><label class="lbl" for="hi-q">Buscar un pedido por su código</label><div class="pg-find"><input class="inp" id="hi-q" placeholder="v12341686wofp-01" value="${s.q}" autocomplete="off">${UI.btn({t:'Buscar',i:'search',cls:'sm',c:'var(--c-buscar)',a:'data-act="buscar"'})}</div>${buscando?`<div style="margin-top:8px">${UI.btn({t:'Limpiar',i:'x',cls:'sm sec',a:'data-act="limpiar"'})}</div>`:''}</div>
    <div class="pg-k4" style="margin-top:12px"><div class="kpi"><b>${totP}</b><small>Pedidos</small></div><div class="kpi"><b>${solC(totM)}</b><small>Soles</small></div></div>
    <div style="margin-top:12px">${modoPed?`<p class="tiny" style="margin:0 2px 4px">${arr.length} pedidos${buscando?' con «'+s.q+'»':''}</p>${arr.length?listaPed(arr,s.n):`<div class="pg-ill"><svg width="90" height="70" viewBox="0 0 90 70" aria-hidden="true"><circle cx="38" cy="30" r="22" fill="none" stroke="var(--c-buscar)" stroke-width="6"/><path d="M54 46l22 18" stroke="var(--c-buscar)" stroke-width="8" stroke-linecap="round"/></svg>No hay pedidos con ese código</div>`}${arr.length>s.n?`<div style="margin-top:10px">${UI.btn({t:'Ver más',i:'plus',cls:'sec',a:'data-act="mas"'})}</div>`:''}`:histDias(ctx)}</div>
    <div style="margin-top:14px">${ac(ctx,{id:'exp',t:'Exportar',s:'Excel o PDF',c:'var(--c-historial)',i:'download',body:`${UI.btn({t:'Exportar Excel',i:'download',cls:'ok',a:'data-toast="Excel listo (demostración)" data-confetti'})}${UI.btn({t:'Exportar PDF',i:'doc',cls:'bad',a:'data-toast="PDF listo (demostración)" data-confetti'})}`})}</div></div>`;
  },
  mount(el,ctx){
    ctx.s.vp=ctx.p;trackAc(el,ctx);
    const q=$('#hi-q',el);
    if(q){q.addEventListener('input',()=>{ctx.s.qq=q.value});q.addEventListener('keydown',e=>{if(e.key==='Enter'){ctx.s.q=q.value.trim();ctx.s.n=8;App.draw(false)}})}
  },
  acts:{
    rango(el,ev,ctx){ctx.s.rango=el.dataset.v;ctx.s.n=8},
    buscar(el,ev,ctx){const q=$('#hi-q');ctx.s.q=q?q.value.trim():'';ctx.s.n=8;if(!ctx.s.q)App.toast('Escribe un código','warn')},
    limpiar(el,ev,ctx){ctx.s.q='';ctx.s.n=8},
    mas(el,ev,ctx){ctx.s.n+=8}
  },
  cambios:['Por día y Pedidos son pestañas; Semana y Mes son botones de color.','Buscar por código tiene botones Buscar y Limpiar, no enlaces.','Cada día es un botón que te lleva a ese día en Inicio.','Exportar a Excel o PDF son dos botones grandes, verde y rojo.']
});

/* =====================================================================
   BUSCAR
   ===================================================================== */
const CAMPOS={c:['Código','v12341686wofp-01','var(--c-comanda)'],n:['Cliente','Nombre del cliente','var(--c-cantidad)'],t:['Teléfono','9xx xxx xxx','var(--c-apoyo)'],d:['Dirección','Calle o distrito','var(--c-mano)']};
const RANGOS=[[0,'Hoy','var(--c-buscar)'],[7,'7 días','var(--c-stats)'],[14,'14 días','var(--c-adic)'],[30,'30 días','var(--c-historial)']];
function resultados(s){
  const q=(s.q||'').trim().toLowerCase(),lim=new Date(2026,9,29-(s.rango||0));
  const key={c:'c',n:'cli',t:'tel',d:'dir'}[s.campo];
  const arr=PED.filter(p=>p.d>=lim&&(!q||String(p[key]).toLowerCase().includes(q)||(s.campo==='t'&&String(p.tel).replace(/\s/g,'').includes(q.replace(/\s/g,'')))));
  if(!arr.length)return `<div class="pg-ill"><svg width="96" height="76" viewBox="0 0 96 76" aria-hidden="true"><circle cx="40" cy="32" r="24" fill="none" stroke="var(--c-buscar)" stroke-width="6"/><path d="M58 50l24 20" stroke="var(--c-buscar)" stroke-width="8" stroke-linecap="round"/><path d="M30 32h20" stroke="var(--c-buscar)" stroke-width="5" stroke-linecap="round"/></svg>No encontré nada.<br>Prueba otro dato o más días.</div>`;
  return `<p class="tiny" style="margin:0 2px">${arr.length} resultado${arr.length>1?'s':''}</p>`+listaPed(arr,40);
}
App.screen('buscar',{
  titulo:'Buscar',icono:'search',
  render(ctx){
    const s=ctx.s;s.campo=s.campo||'c';s.q=s.q||'';if(s.rango==null)s.rango=30;
    const rz=s.vp===ctx.p?'':'rise';
    return `<div class="${rz}">
    <div class="pg-big-inp">${I('search')}<input class="inp" id="bu-q" placeholder="${CAMPOS[s.campo][1]}" value="${s.q}" autocomplete="off" aria-label="Qué buscar"><button type="button" class="borrar" data-act="borrar">${I('x')}Borrar</button></div>
    <div class="chips" style="margin:12px 0">${Object.entries(CAMPOS).map(([k,v])=>chip(v[0],s.campo===k,`data-act="campo" data-v="${k}"`,v[2])).join('')}</div>
    <p class="lbl" style="margin-bottom:6px">Días a revisar</p>
    <div class="chips" style="margin-bottom:12px">${RANGOS.map(([n,t,c])=>chip(t,s.rango===n,`data-act="rango" data-v="${n}"`,c)).join('')}</div>
    <div id="bu-res">${resultados(s)}</div></div>`;
  },
  mount(el,ctx){
    ctx.s.vp=ctx.p;
    const q=$('#bu-q',el);
    if(q)q.addEventListener('input',()=>{ctx.s.q=q.value;$('#bu-res',el).innerHTML=resultados(ctx.s)});
  },
  acts:{
    borrar(el,ev,ctx){ctx.s.q=''},
    campo(el,ev,ctx){ctx.s.campo=el.dataset.v},
    rango(el,ev,ctx){ctx.s.rango=+el.dataset.v}
  },
  cambios:['El campo de búsqueda es grande, con un botón Borrar dentro.','Código, Cliente, Teléfono y Dirección son botones de color que cambian la pista.','Hoy, 7, 14 y 30 días son botones de color en vez de un calendario.','Los resultados se filtran mientras escribes y salen agrupados por fecha.']
});

})();
