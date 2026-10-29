/* =====================================================================
   MÓDULO 10 · INICIO Y REGISTRO
   Pantalla: inicio · Hojas: cargar, mas, subirmas, dia, pedido, visor-foto, rutas-hoja
   Prefijo de estilos: .ini-
   ===================================================================== */
(function(){
const NOM=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'], NOM3=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const HOY=3;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fechaL=i=>`${NOM[i]} ${DATA.hoy.dias[i].n} de ${i<6?'octubre':'noviembre'}`;
const fechaC=i=>`${NOM3[i]} ${DATA.hoy.dias[i].n}`;
const isoDia=i=>i<6?`2026-10-${26+i}`:'2026-11-01';
const slug=t=>String(t).replace(/\W/g,'');
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const tmin=h=>{const m=/^(\d{1,2}):(\d{2})/.exec(h||'');return m?(+m[1])*60+(+m[2]):0};
const dur=m=>{m=Math.max(0,Math.round(m));const h=Math.floor(m/60),r=m%60;return h?`${h} h${r?` ${r} min`:''}`:`${r} min`};
const val=id=>{const e=document.getElementById(id);return e?e.value:''};
const pj=o=>JSON.stringify(o);

/* ---------- estado del módulo (vive mientras dura el prototipo) ---------- */
let SEL=HOY;
const DESC=new Set([2]), EXTRA={}, LAST={tot:0}, OTROS=[], RUT={}, ADI={}, APO={}, FOT={}, HORA={3:{i:'08:00',o:'16:30'},0:{i:'08:10',o:'14:00'},1:{i:'08:40',o:'12:30'}};
const mk=(c,r,e,z,m,cli,foto,d)=>OTROS.push({c,r,e,z,m,cli,foto,_d:d});
mk('v12340101wofp-01',1,'E','Miraflores',950,'Rosa Lima',true,0);mk('v12340177wofp-01',1,'E','Surquillo',950,null,false,0);mk('v12340202wofp-01',1,'E','Santiago de Surco',950,null,false,0);
mk('v12340310wofp-01',2,'P','Chorrillos',1300,'Julia Soto',true,0);mk('v12340333wofp-01',2,'E','Miraflores',950,null,false,0);mk('v12340390wofp-01',2,'E','Surquillo',950,null,false,0);
mk('v12341686wofp-01',1,'E','Miraflores',950,'Pedro Ávila',true,1);mk('v12341702wofp-01',1,'E','Surquillo',950,null,false,1);mk('v12341715wofp-01',1,'N','Chorrillos',1300,null,false,1);
mk('v12341730wofp-01',1,'E','Miraflores',950,'Carmen Díaz',false,1);mk('v12341744wofp-01',1,'E','Santiago de Surco',950,null,false,1);
RUT[0]=[{n:1,h:'08:30',fin:'10:50',pedidos:3,estado:'Finalizado'},{n:2,h:'11:20',fin:'13:05',pedidos:3,estado:'Finalizado'}];
RUT[1]=[{n:1,h:'09:00',fin:'11:15',pedidos:5,estado:'Finalizado'}];
ADI[1]=[{tipo:'Taxi',det:'5.1 km',m:1500}];
const rutas=d=>d===HOY?DATA.rutas:(RUT[d]||(RUT[d]=[]));
const adic=d=>d===HOY?DATA.adicionales:(ADI[d]||(ADI[d]=[]));
const apoy=d=>d===HOY?DATA.apoyos:(APO[d]||(APO[d]=[]));
const fotos=d=>FOT[d]||(FOT[d]=d===HOY?['Resumen de rutas','Órdenes 1','Órdenes 2','Comanda de Claudia']:d<HOY&&!DESC.has(d)?['Resumen de rutas','Órdenes 1']:[]);
const mon=p=>p.e==='N'?0:p.m;
function lista(d){const o=[];DATA.pedidos.forEach((p,i)=>{if(!p._del&&(p._d==null?HOY:p._d)===d)o.push({p,ref:{i}})});OTROS.forEach((p,x)=>{if(!p._del&&p._d===d)o.push({p,ref:{x}})});return o}
function getP(q){q=q||{};if(q.x!=null&&OTROS[q.x])return OTROS[q.x];return DATA.pedidos[q.i]||DATA.pedidos[0]}
function resumen(d){
  const L=lista(d),ex=EXTRA[d]||0,tienda=sum(L,x=>mon(x.p))+ex*950,apo=sum(apoy(d),x=>x.m),adi=sum(adic(d),x=>x.m),n=L.length+ex;
  return {L,ex,n,tienda,apo,adi,tot:tienda+apo+adi,datos:n>0||apo>0||adic(d).length>0||apoy(d).length>0};
}
function estadoDia(d){return DESC.has(d)?'descanso':d>HOY?'futuro':resumen(d).datos?'cargado':'vacio'}
function racha(d){let c=0;for(let i=d;i>=0;i--){if(DESC.has(i)&&i!==d)continue;if(resumen(i).datos)c++;else break}return c}
function grupoZona(p){return p.z?(p.z==='Chorrillos'?1:0):2}
const ZNOM=['Miraflores · Surquillo · Surco','Chorrillos','Sin zona'], ZCOL=['var(--acc)','var(--c-aprender)','var(--ink3)'];

/* ---------- ilustraciones ---------- */
const ilus={
  vacio:()=>`<svg viewBox="0 0 220 112" width="220" height="112" aria-hidden="true"><circle cx="176" cy="26" r="15" fill="var(--sun)"/><rect x="30" y="12" width="56" height="70" rx="9" fill="var(--surf)" stroke="var(--line)" stroke-width="3"/><rect x="48" y="7" width="20" height="10" rx="4" fill="var(--acc)"/><path d="M42 36h32M42 48h32M42 60h20" stroke="var(--line)" stroke-width="4" stroke-linecap="round"/><path d="M10 98h200" stroke="var(--line)" stroke-width="7" stroke-linecap="round"/><path d="M22 98h16M58 98h16M94 98h16M130 98h16M166 98h16" stroke="var(--surf)" stroke-width="3" stroke-linecap="round"/><g class="bob" transform="translate(104 52)"><path d="M3 34l4-13c.8-2.4 3-4 5.6-4h28.8c2.6 0 4.8 1.600 5.600 4l4 13v8c0 1.400-1 2.600-2.600 2.600H41v-4H16v4H5.600C4 44.600 3 43.400 3 42z" fill="#ffc800"/><path d="M3 34l4-13c.8-2.400 3-4 5.600-4h28.800c2.600 0 4.800 1.600 5.600 4l4 13M3 34h48" fill="none" stroke="#0a2260" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="38" r="4" fill="#0a2260"/><circle cx="40" cy="38" r="4" fill="#0a2260"/></g></svg>`,
  luna:()=>`<svg viewBox="0 0 160 110" width="160" height="110" aria-hidden="true"><circle cx="80" cy="55" r="44" fill="var(--surf2)"/><path d="M104 70A32 32 0 0166 24a32 32 0 1038 46z" fill="var(--sun)" class="bob"/><path d="M28 28l.01 0M130 22l.01 0M138 74l.01 0M22 78l.01 0" stroke="var(--ink3)" stroke-width="6" stroke-linecap="round"/></svg>`,
  futuro:()=>`<svg viewBox="0 0 160 110" width="160" height="110" aria-hidden="true"><rect x="32" y="18" width="96" height="80" rx="12" fill="var(--surf)" stroke="var(--line)" stroke-width="3"/><path d="M32 42h96" stroke="var(--line)" stroke-width="3"/><path d="M54 12v14M106 12v14" stroke="var(--ink3)" stroke-width="5" stroke-linecap="round"/><circle cx="80" cy="70" r="17" fill="var(--acc-soft)"/><path d="M80 59v11l7 4" stroke="var(--acc)" stroke-width="4" fill="none" stroke-linecap="round" class="bob"/></svg>`,
  nube:()=>`<svg viewBox="0 0 64 48" width="56" height="42" aria-hidden="true"><path d="M16 38a10 10 0 010-20 14 14 0 0127-3 9 9 0 011 23z" fill="var(--acc-soft)" stroke="var(--acc)" stroke-width="3" stroke-linejoin="round"/><path d="M32 33V21M27 26l5-5 5 5" stroke="var(--acc)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" class="bob"/></svg>`,
  foto:(i,w,h)=>{const c=['var(--acc-soft)','var(--ok-soft)','var(--warn-soft)','var(--surf2)'][i%4];return `<svg viewBox="0 0 200 250" width="${w||200}" height="${h||250}" aria-hidden="true" style="max-width:100%;border-radius:14px"><rect width="200" height="250" fill="${c}"/><g transform="rotate(${(i%3-1)*3} 100 125)"><rect x="22" y="18" width="156" height="214" rx="10" fill="var(--surf)" stroke="var(--line)" stroke-width="2"/><rect x="34" y="30" width="70" height="10" rx="3" fill="var(--ink2)"/><rect x="34" y="48" width="42" height="7" rx="3" fill="var(--ink3)"/>${[72,94,116,138].map((y,k)=>`<rect x="34" y="${y}" width="${132-k*10}" height="8" rx="3" fill="var(--line)"/><rect x="34" y="${y+11}" width="${70-k*6}" height="6" rx="3" fill="var(--surf2)"/>`).join('')}<path d="M36 186h8M48 186h3M55 186h6M65 186h3M72 186h10M86 186h4M94 186h8M106 186h3M113 186h7M124 186h4M132 186h10M146 186h3M153 186h8" stroke="var(--ink)" stroke-width="14" opacity=".75"/><rect x="34" y="208" width="60" height="9" rx="3" fill="var(--c-foto)"/></g></svg>`}
};

/* ---------- estilos propios ---------- */
App.css(`
@keyframes ini-pulso{0%{transform:scale(.92);opacity:.9}100%{transform:scale(1.22);opacity:0}}
@keyframes ini-drive{from{left:-56px}to{left:100%}}
@keyframes ini-gr{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes ini-sube{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
.ini-cab{display:flex;align-items:flex-start;gap:8px;margin:2px 2px 12px;flex-wrap:wrap}
.ini-cab>div:first-child{flex:1;min-width:190px}
.ini-fecha{font-size:25px;line-height:1.08}
.ini-cab-b{display:flex;gap:8px;align-items:center}
.ini-volver{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:99px;background:var(--sun);color:var(--sun-ink);font-weight:800;box-shadow:0 3px 0 rgba(0,0,0,.16)}
.ini-volver:active{transform:translateY(2px)}
.ini-volver .ic{width:18px;height:18px}
.ini-icb{width:44px;height:44px;border-radius:50%;background:var(--surf);display:grid;place-items:center;flex:none;transition:transform .12s}
.ini-icb:active{transform:scale(.9)}
.ini-tira{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px}
.ini-dia{position:relative;min-height:66px;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:var(--surf);color:var(--ink2);transition:transform .15s,box-shadow .15s}
.ini-dia small{font-size:11px;font-weight:800;opacity:.85} .ini-dia b{font:600 19px/1 var(--f-display)}
.ini-dia .ini-mk{height:14px;display:grid;place-items:center} .ini-dia .ini-mk .ic{width:14px;height:14px}
.ini-pt{width:7px;height:7px;border-radius:50%;background:currentColor;animation:ini-sube .35s both}
.ini-dia.cargado{background:var(--ok);color:#fff}
.ini-dia.descanso{background:var(--surf2);color:var(--ink2)}
.ini-dia.vacio{border:2px dashed var(--line)}
.ini-dia.futuro{opacity:.5}
.ini-dia.hoy{background:var(--acc);color:var(--acc-ink)}
.ini-dia.hoy::after{content:"";position:absolute;inset:-4px;border-radius:28px;border:3px solid var(--acc);animation:ini-pulso 1.7s ease-out infinite;pointer-events:none}
.ini-dia[aria-pressed=true]{transform:translateY(-4px);box-shadow:0 0 0 3px var(--bg),0 0 0 6px var(--ink)}
.ini-sub{display:flex;align-items:center;gap:8px;margin:8px 2px 12px}
.ini-sub small{flex:1;color:var(--ink3);font-weight:800}
.ini-lic{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:20px;background:var(--warn-soft);color:var(--warn);margin-bottom:12px}
.ini-lic>div{display:flex;gap:10px;align-items:center} .ini-lic b{display:block;line-height:1.15} .ini-lic small{font-weight:700;display:block}
.ini-lic .fig{width:42px;height:42px;border-radius:14px;background:var(--c-licencia);color:#fff;display:grid;place-items:center;flex:none}
.ini-hero{position:relative;border-radius:26px;padding:16px 16px 12px;background:var(--acc);color:var(--acc-ink);margin-bottom:6px;overflow:hidden;box-shadow:0 8px 0 rgba(0,0,0,.14)}
.ini-hero::before{content:"";position:absolute;right:-50px;top:-50px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.12)}
.ini-ht{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:800;position:relative}
.ini-ch{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:99px;font-size:13px;font-weight:800;background:color-mix(in srgb,currentColor 18%,transparent)}
.ini-ch .ic{width:15px;height:15px}
.ini-ch.rec{background:var(--sun);color:var(--sun-ink);animation:pop .4s both}
.ini-tot{display:block;font:600 46px/1.05 var(--f-display);margin:6px 0 2px;position:relative}
.ini-hero p{font-weight:800;opacity:.92;position:relative}
.ini-road{position:relative;height:36px;margin:10px -16px 0;border-bottom:4px dashed color-mix(in srgb,currentColor 45%,transparent);overflow:hidden}
.ini-car{position:absolute;bottom:2px;left:-56px;animation:ini-drive 7s linear infinite}
.ini-anillo{background:var(--surf);color:var(--ink);border-radius:20px;padding:14px 12px 10px;margin:12px -4px 0}
.ini-anillo .ini-c b{display:block;font:600 22px/1 var(--f-display)} .ini-anillo .ini-c small{font-weight:800;color:var(--ink2);font-size:12px}
.ini-leg{display:flex;flex-direction:column;gap:2px;margin-top:10px}
.ini-lg{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 10px;border-radius:14px;width:100%;transition:background .15s}
.ini-lg:active{background:var(--surf2)} .ini-lg i{width:14px;height:14px;border-radius:5px;flex:none}
.ini-lg b{flex:1;font-weight:800} .ini-lg span{font-family:var(--f-display);font-weight:600}
.ini-lg .ic{width:16px;height:16px;color:var(--ink3)}
.ini-lg.cero{opacity:.55}
.ini-ck .ic{width:16px;height:16px;color:var(--ok);vertical-align:-2px}
.ini-vacio{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:10px 0 4px}
.ini-vacio h3{font-size:22px} .ini-vacio p{color:var(--ink2);max-width:28ch}
.ini-vacio .btn{max-width:340px}
.ini-ped{display:flex;align-items:center;gap:10px;width:100%;padding:10px;border-radius:16px;text-align:left;min-height:60px;transition:transform .12s;background:var(--surf2)}
.ini-ped:active{transform:scale(.98)}
.ini-ped.ok{background:var(--ok-soft)} .ini-ped.warn{background:var(--warn-soft)} .ini-ped.nd{background:var(--surf2)}
.ini-pe{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:none;color:#fff;background:var(--ink3)}
.ini-ped.ok .ini-pe{background:var(--ok)} .ini-ped.warn .ini-pe{background:var(--warn)}
.ini-pe .ic{width:18px;height:18px}
.ini-pm{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.ini-pm b{font-size:13.5px;line-height:1.15;word-break:break-all} .ini-pm b.ini-sc{color:var(--warn);word-break:normal}
.ini-pp{display:flex;flex-wrap:wrap;gap:4px} .ini-pi{display:flex;gap:6px;color:var(--ink2)} .ini-pi .ic{width:15px;height:15px}
.ini-ped>.num{white-space:nowrap;font-size:15px}
.ini-zona{display:grid;gap:4px;padding:8px 2px}
.ini-zona>div{display:flex;justify-content:space-between;gap:8px;font-weight:800}
.ini-zona .barra{height:14px}
.ini-ruta{background:var(--surf2);border-radius:16px;padding:10px 12px}
.ini-rh{display:flex;align-items:center;gap:10px}
.ini-rh>div{flex:1;min-width:0} .ini-rh b{display:block;line-height:1.15} .ini-rh small{color:var(--ink2);font-weight:700}
.ini-rn{width:36px;height:36px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;font:600 18px var(--f-display);flex:none}
.ini-x{width:44px;height:44px;border-radius:50%;background:var(--surf);display:grid;place-items:center;color:var(--bad);flex:none}
.ini-x .ic{width:18px;height:18px}
.ini-via{display:flex;align-items:center;margin:10px 4px 2px}
.ini-st{width:12px;height:12px;border-radius:50%;background:var(--acc);flex:none;animation:ini-sube .4s both}
.ini-st.a,.ini-st.z{width:28px;height:28px;display:grid;place-items:center;color:var(--acc-ink)} .ini-st.a .ic,.ini-st.z .ic{width:15px;height:15px}
.ini-st.z{background:var(--ok);color:#fff}
.ini-ln{flex:1;height:4px;border-radius:2px;background:var(--acc);opacity:.35;transform-origin:left;animation:ini-gr .5s both;min-width:6px}
.ini-pie{display:grid;gap:8px;margin-top:4px}
.ini-hor{display:grid;gap:10px;background:var(--surf2);border-radius:16px;padding:12px}
.ini-hor .g{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ini-cmp{display:grid;gap:6px}
.ini-cmp>div{display:grid;grid-template-columns:92px 1fr auto;align-items:center;gap:8px;font-size:13px;font-weight:800}
.ini-resp{display:flex;gap:12px;align-items:center;background:var(--surf);border-radius:20px;padding:12px;margin-top:12px}
.ini-resp>div{flex:1;min-width:0} .ini-resp b{display:block;line-height:1.15} .ini-resp small{color:var(--ink2);font-weight:700}
.ini-resp .btn{margin-top:8px}
.ini-line{display:flex;justify-content:space-between;gap:10px;padding:6px 2px;font-weight:700} .ini-line b{font-family:var(--f-display);font-weight:600;white-space:nowrap}
.ini-form{border-radius:22px;padding:14px;display:flex;flex-direction:column;gap:12px;background:var(--surf)}
.ini-fh{display:flex;align-items:center;gap:10px} .ini-fh .fig{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;color:#fff}
.ini-fh b{font:600 18px var(--f-display)}
.ini-est{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ini-est button{min-height:52px;border-radius:16px;color:#fff;font-weight:800;font-size:14px;line-height:1.1;padding:4px 6px;text-align:center;transition:transform .12s;border:3px solid transparent;box-shadow:0 4px 0 rgba(0,0,0,.16)}
.ini-est button:active{transform:translateY(2px)}
.ini-est button[aria-pressed=true]{border-color:var(--ink);transform:translateY(-2px)}
.ini-fl{display:flex;align-items:center;gap:10px;background:var(--surf2);border-radius:14px;padding:8px 10px}
.ini-fl svg{border-radius:8px;flex:none} .ini-fl b{flex:1;font-size:13px}
.ini-big{font:600 40px/1 var(--f-display)}
.ini-zt{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ini-zt .tile{min-height:124px} .ini-zt .tile b{font-size:15px} .ini-zt .tile .m{font:600 24px var(--f-display);display:block;margin-top:2px}
.ini-zt .tile[aria-pressed=true]::after{content:"✓";position:absolute;right:10px;top:10px;width:26px;height:26px;border-radius:50%;background:#fff;color:var(--ink);display:grid;place-items:center;animation:pop .3s both}
.ini-monto{display:flex;align-items:center;justify-content:space-between;background:var(--acc-soft);border-radius:18px;padding:12px 16px;color:var(--acc)}
.ini-monto small{font-weight:800;display:block;color:var(--ink2)}
.ini-radar{display:block;margin:auto}
.ini-visor{position:relative;border-radius:18px;background:var(--surf2);overflow:hidden;display:grid;place-items:center;padding:12px;min-height:300px}
.ini-visor .z{transition:transform .3s;transform-origin:50% 40%}
.ini-visor.zoom .z{transform:scale(1.7)}
.ini-nav{display:flex;align-items:center;gap:10px} .ini-nav .btn{width:56px;min-height:52px;padding:0} .ini-nav div{flex:1;text-align:center;font-weight:800}
.ini-lbl2{font:600 17px var(--f-display);margin:2px 2px 0}
`);

/* ---------- helpers de composición ---------- */
const acx=(ctx,o)=>UI.ac(Object.assign({open:!!(ctx.s.op&&ctx.s.op[o.id])},o));
const chipsDia=(sel)=>`<div class="chips">${NOM3.slice(0,HOY+1).map((n,i)=>UI.chip(fechaC(i),i===sel,`data-one data-d="${i}"`)).join('')}</div>`;
const diaSel=()=>{const b=document.querySelector('#hoja [data-d][aria-pressed="true"]');return b?+b.dataset.d:SEL};
function terminar(d,msg){SEL=d;App.confetti();App.go('inicio');App.toast(msg)}
function seguir(el,ctx,id){const t=el.querySelector('[data-acid="'+id+'"]');if(t&&t.scrollIntoView)t.scrollIntoView({block:'center',behavior:'smooth'})}

/* ---------- DetalleDelDia ---------- */
function filaPed(x,d){
  const p=x.p,est=p.e,cls=est==='E'?'ok':est==='P'?'warn':'nd',ic=est==='E'?'check':est==='P'?'warn':'x';
  const r=p.r!=null?rutas(d).find(q=>q.n===p.r):null;
  const rp=r?UI.pill(`Ruta ${r.n} · ${r.h}`,'acc','route'):p.r!=null?UI.pill(`Ruta ${p.r}`,'acc','route'):UI.pill('Sin ruta · toca para asignar','warn');
  const code=/^pendiente/.test(p.c)?`<b class="ini-sc">Pedido sin código · toca para completar</b>`:`<b class="mono">${esc(p.c)}</b>`;
  return `<button type="button" class="ini-ped ${cls}" data-sheet="pedido" data-p='${pj(x.ref)}'><span class="ini-pe">${I(ic)}</span><span class="ini-pm">${code}<span class="ini-pp">${UI.pill(DATA.estado[est][0],DATA.estado[est][1])}${rp}${p.z?UI.pill(esc(p.z),'','pin'):''}${p.mano?UI.pill('a mano'):''}</span><span class="ini-pi">${p.cli?I('user'):''}${p.foto?I('foto'):''}</span></span><span class="num">${fmt.sol(mon(p))}</span></button>`;
}
function detalle(ctx,d,R){
  const s=ctx.s,tab=s.dtab||'ped',rs=rutas(d),L=R.L;
  let h=UI.seg('dtab',[['ped','Pedidos',R.n],['zona','Por zona'],['rut','Rutas',rs.length]],tab);
  if(tab==='ped'){
    const mostrar=s.todos?L:L.slice(0,5);
    h+=mostrar.map(x=>filaPed(x,d)).join('');
    if(R.ex)h+=UI.aviso(`${R.ex} pedido${R.ex>1?'s':''} más, anotado${R.ex>1?'s':''} solo por cantidad`,'');
    if(L.length>5)h+=`<button type="button" class="btn sec sm" style="width:100%" data-act="vertodos">${I(s.todos?'chev':'list')}${s.todos?'Ver menos':`Ver los ${R.n} pedidos`}</button>`;
    if(!L.length&&!R.ex)h+=UI.aviso('Todavía no hay pedidos este día','');
  }else if(tab==='zona'){
    const g=[0,1,2].map(k=>({k,n:L.filter(x=>grupoZona(x.p)===k).length,m:sum(L.filter(x=>grupoZona(x.p)===k),x=>mon(x.p))})).filter(x=>x.n);
    const mx=Math.max(1,...g.map(x=>x.m));
    h+=g.map(x=>`<div class="ini-zona"><div><span>${ZNOM[x.k]} · ${x.n}</span><span class="num">${fmt.sol(x.m)}</span></div><div class="barra"><i style="width:${Math.max(6,x.m/mx*100)}%;background:${ZCOL[x.k]}"></i></div></div>`).join('')||UI.aviso('Sin pedidos para agrupar','');
  }else{
    h+=rs.map(r=>{
      const n=L.filter(x=>x.p.r===r.n).length;
      if(s.confR===r.n)return `<div class="ini-ruta">${UI.aviso(`¿Quitar la ruta ${r.n}? Sus pedidos no se borran.`,'warn')}<div class="grid2" style="margin-top:8px"><button type="button" class="btn bad sm" style="width:100%" data-act="rutok">${I('trash')}Quitar</button><button type="button" class="btn sec sm" style="width:100%" data-act="rutno">Dejarla</button></div></div>`;
      return `<div class="ini-ruta"><div class="ini-rh"><span class="ini-rn">${r.n}</span><div><b>Ruta ${r.n} · ${r.h} – ${r.fin}</b><small>${n} pedido${n===1?'':'s'}</small></div><button type="button" class="ini-x" data-act="rutq" data-n="${r.n}" aria-label="Quitar ruta ${r.n}">${I('x')}</button></div><div class="ini-via"><span class="ini-st a">${I('store')}</span>${Array.from({length:n},()=>`<span class="ini-ln"></span><span class="ini-st"></span>`).join('')}<span class="ini-ln"></span><span class="ini-st z">${I('flag')}</span></div></div>`}).join('')||UI.aviso('Este día no tiene rutas','');
    h+=`<button type="button" class="btn sec sm" style="width:100%" data-sheet="rutas-hoja">${I('plus')}Añadir ruta</button>`;
  }
  /* pie de tres botones */
  const hr=HORA[d]||(HORA[d]={i:'08:00',o:'16:30'});
  let hor='';
  if(s.op&&s.op.horario){
    const ini=rs.length?Math.min(...rs.map(r=>tmin(r.h))):0,fin=rs.length?Math.max(...rs.map(r=>tmin(r.fin))):0,pe=tmin(hr.o)-tmin(hr.i),pd=fin-ini,mxx=Math.max(pe,pd,1);
    hor=`<div class="ini-hor"><div class="g"><div><label class="lbl" for="ini-hin">Entrada</label><input id="ini-hin" class="inp" type="time" value="${hr.i}"></div><div><label class="lbl" for="ini-hout">Salida</label><input id="ini-hout" class="inp" type="time" value="${hr.o}"></div></div>
    <button type="button" class="btn sm" style="width:100%;background:var(--c-historial)" data-act="guardahor">${I('check')}Guardar horario</button>
    ${rs.length&&pe>0?`<div class="ini-cmp"><div><span>En tienda</span><div class="barra"><i style="width:${pe/mxx*100}%;background:var(--c-historial)"></i></div><span>${dur(pe)}</span></div><div><span>Pedidos</span><div class="barra"><i style="width:${pd/mxx*100}%;background:var(--acc)"></i></div><span>${dur(pd)}</span></div></div>${pd>pe?UI.aviso('Tus pedidos duran más que tu horario. Revisa la entrada o la salida.','warn'):UI.aviso(`Estuviste ${dur(pe-pd)} en tienda sin salir a reparto.`,'ok')}`:UI.aviso('Pon el horario y las rutas del día para comparar.','')}</div>`;
  }
  h+=`<div class="ini-pie"><button type="button" class="btn" style="background:var(--c-foto)" data-sheet="visor-foto">${I('foto')}Capturas y fotos del día</button><button type="button" class="btn" style="background:var(--c-historial)" data-act="hor">${I('clock')}Horario en tienda</button>${hor}`;
  h+=s.confBorrar?`<div class="ini-ruta">${UI.aviso('¿Borrar todo este día? Pedidos, rutas, adicionales y apoyo se quitan.','bad')}<div class="grid2" style="margin-top:8px"><button type="button" class="btn bad sm" style="width:100%" data-act="borrarok">${I('trash')}Sí, borrar</button><button type="button" class="btn sec sm" style="width:100%" data-act="borrarno">No</button></div></div>`:`<button type="button" class="btn bad" data-act="borrar">${I('trash')}Borrar este día</button>`;
  return h+'</div>';
}

/* ---------- pantalla INICIO ---------- */
App.screen('inicio',{titulo:'Hoy',icono:'home',tab:'inicio',
  cambios:['«Volver a hoy» y el calendario son botones, no enlaces; lo de «mantén presionado» se cambió por un botón ⋯ visible','Tira de 7 días de color: verde cargado, luna descanso, anillo que late en hoy','Todo el resumen en una tarjeta viva con anillo; tocar una leyenda abre su fila','Sin botón + flotante: «Cargar» ya está en la barra de abajo','Día vacío con dibujo y tres botones grandes en vez de texto suelto'],
  render(ctx){
    const s=ctx.s;s.op=s.op||{};
    const fr=!(s._last&&Date.now()-s._last<1500);s._last=Date.now();
    const rc=n=>fr?`rise d${n}`:'';
    const d=SEL,es=estadoDia(d),R=resumen(d),esHoy=d===HOY;
    const nCar=[0,1,2,3,4,5,6].filter(i=>i<=HOY&&!DESC.has(i)&&resumen(i).datos).length;
    let h=`<div class="ini-cab ${rc(1)}"><div><h2 class="ini-fecha">${fechaL(d)}</h2><p class="muted">${DATA.hoy.semana} · ${nCar} de 7 días</p></div><div class="ini-cab-b">${esHoy?'':`<button type="button" class="ini-volver" data-act="hoy">${I('history')}Volver a hoy</button>`}<button type="button" class="ini-icb" data-toast="Calendario: elige otro día en la tira" aria-label="Calendario">${I('cal')}</button></div></div>`;
    h+=`<div class="ini-tira ${rc(2)}" role="group" aria-label="Días de la semana">${DATA.hoy.dias.map((x,i)=>{const e=estadoDia(i);return `<button type="button" class="ini-dia ${e} ${i===HOY?'hoy':''}" aria-pressed="${i===d}" data-act="dia" data-i="${i}" aria-label="${fechaL(i)}"><small>${x.d}</small><b>${x.n}</b><span class="ini-mk">${e==='descanso'?I('moon'):(e==='cargado'||(i===HOY&&resumen(i).datos)?'<i class="ini-pt"></i>':'')}</span></button>`}).join('')}</div>`;
    h+=`<div class="ini-sub ${rc(2)}"><small>${esHoy?'Hoy':fechaC(d)} · toca un día para verlo</small><button type="button" class="ini-icb" data-sheet="dia" data-p='{"i":${d}}' aria-label="Opciones de este día">${I('dots')}</button></div>`;
    if(App.state.licencia==='vencida')h+=`<div class="ini-lic ${rc(3)}"><div><span class="fig">${I('key')}</span><div><b>Tu prueba terminó</b><small>Puedes ver todo; para cargar, activa tu licencia</small></div></div>${UI.btn({t:'Activar mi licencia',i:'key',c:'var(--c-licencia)',cls:'sm',a:'data-go="ajustes" data-p=\'{"abre":"licencia"}\' style="width:100%"'})}</div>`;

    if(es==='descanso'){
      h+=`<div class="ini-vacio ${rc(3)}">${ilus.luna()}<h3>Día de descanso</h3><p>Hoy no se cuenta. Descansar también es trabajo.</p><button type="button" class="btn sec" data-act="quitardesc">${I('refresh')}Quitar el descanso</button></div>`;
    }else if(es==='futuro'){
      h+=`<div class="ini-vacio ${rc(3)}">${ilus.futuro()}<h3>Ese día todavía no llega</h3><p>Cuando llegue, aquí vas a cargar tus pedidos.</p><button type="button" class="btn" data-act="hoy">${I('history')}Volver a hoy</button></div>`;
    }else if(es==='vacio'){
      h+=`<div class="ini-vacio ${rc(3)}">${ilus.vacio()}<h3>${esHoy?'Hoy: sin cargar':'Este día: sin cargar'}</h3><p>Sube el resumen o toma una foto de la comanda.</p>
        <button type="button" class="btn" data-sheet="cargar">${I('cargar')}Cargar resumen del día</button>
        <button type="button" class="btn" style="background:var(--c-comanda)" data-sheet="comandas">${I('camara')}Tomar foto de una comanda</button>
        <button type="button" class="btn ghost" data-act="desc">${I('moon')}No trabajé este día</button></div>`;
    }else{
      const rec=R.tot>=15000,rr=racha(d),from=fr?0:LAST.tot;
      const fu=[{k:'tienda',n:'Mi tienda',m:R.tienda,c:'var(--acc)'},{k:'apoyo',n:'Apoyo',m:R.apo,c:'var(--c-apoyo)'},{k:'adic',n:'Adicionales',m:R.adi,c:'var(--c-adic)'}];
      h+=`<section class="ini-hero ${rc(3)}"><div class="ini-ht"><span>${esHoy?'Hoy cargaste':'Ese día cargaste'}</span>${rec?`<span class="ini-ch rec">${I('star')}¡Récord!</span>`:''}${rr>=2?`<span class="ini-ch">${I('fire')}${rr} días</span>`:''}</div>
        <b class="ini-tot" data-count="${R.tot}" data-from="${from}">${fmt.sol(from)}</b><p>${R.n} pedido${R.n===1?'':'s'} · ${rutas(d).length} ruta${rutas(d).length===1?'':'s'}</p>
        <div class="ini-road"><span class="ini-car">${CAR(46)}</span></div>
        <div class="ini-anillo">${UI.ring(fu.filter(x=>x.m>0).map(x=>({m:x.m,c:x.c})),`<div class="ini-c"><b>${fmt.sol(R.tot)}</b><small>Total del día</small></div>`,164,20)}
        <div class="ini-leg">${fu.map(x=>`<button type="button" class="ini-lg ${x.m?'':'cero'}" data-act="leg" data-k="${x.k}"><i style="background:${x.c}"></i><b>${x.n}</b><span>${x.m?fmt.sol(x.m):'—'}</span>${I('fwd')}</button>`).join('')}</div></div></section>`;
      h+=`<h3 class="titulo-s ${rc(4)}">¿Qué hiciste ${esHoy?'hoy':'ese día'}?</h3><div class="${rc(4)}">`;
      const nCli=R.L.filter(x=>x.p.cli).length,tr=sum(rutas(d),r=>Math.max(0,tmin(r.fin)-tmin(r.h)));
      h+=acx(ctx,{id:'tienda',k:'tienda',t:'Pedidos de mi tienda',s:R.n?`${R.n} pedidos · ${rutas(d).length} rutas${tr?` · ${dur(tr)} en ruta`:''}${nCli?` · ${nCli} con cliente`:''}`:'Toca para anotarlos',der:R.n?`${fmt.sol(R.tienda)} <span class="ini-ck">${I('check')}</span>`:'',body:R.n?detalle(ctx,d,R):`${UI.aviso('Aún no anotaste pedidos de tu tienda este día.','')}<button type="button" class="btn" data-sheet="subirmas">${I('plus')}Anotar pedidos</button>`});
      const ap=apoy(d);
      h+=acx(ctx,{id:'apoyo',k:'apoyo',t:'Apoyé a otra tienda',s:ap.length?ap.map(a=>`${a.tienda} · ${a.det}`).join(' · '):'Toca para anotarlo',der:ap.length?`${fmt.sol(R.apo)} <span class="ini-ck">${I('check')}</span>`:'',body:`${ap.map(a=>`<div class="ini-line"><span>${esc(a.tienda)}<br><small class="tiny">${esc(a.det)}</small></span><b>${fmt.sol(a.m)}</b></div>`).join('')}<button type="button" class="btn sm" style="background:var(--c-apoyo);width:100%" data-sheet="apoyo">${I('plus')}${ap.length?'Agregar otro apoyo':'Anotar apoyo'}</button>`});
      const ad=adic(d),tipos=[...new Set(ad.map(a=>a.tipo))];
      tipos.forEach(t=>{const it=ad.filter(a=>a.tipo===t),k=t==='Taxi'?'taxi':'adicional';
        h+=acx(ctx,{id:'adic-'+slug(t),k,t:t==='Taxi'?'Hice taxi':t,s:it.map(a=>a.det).join(' · '),claro:k==='taxi',der:`${fmt.sol(sum(it,a=>a.m))} <span class="ini-ck">${I('check')}</span>`,body:`${it.map(a=>`<div class="ini-line"><span>${esc(a.det)}</span><b>${fmt.sol(a.m)}</b></div>`).join('')}<button type="button" class="btn sm" style="width:100%;background:${ACC[k].c}${k==='taxi'?';color:var(--sun-ink)':''}" data-sheet="adicional" data-p='{"tipo":"${t}"}'>${I('plus')}Agregar otro de ${t}</button>`})});
      if(!tipos.length)h+=`<div style="margin-top:10px">${UI.fila({k:'adicional',t:'Agregar un adicional',s:'Taxi, Expo Vino…',a:'data-sheet="adicional"'})}</div>`;
      h+='</div>';
      if(!s.noresp)h+=`<div class="ini-resp ${rc(5)}">${ilus.nube()}<div><b>Todavía no has hecho ningún respaldo</b><small>Guarda tus datos para no perderlos.</small><button type="button" class="btn sm" style="width:100%" data-go="ajustes" data-p='{"abre":"respaldo"}'>${I('nube')}Respaldar ahora</button></div><button type="button" class="ini-icb" style="background:var(--surf2)" data-act="respx" aria-label="Ocultar aviso">${I('x')}</button></div>`;
    }
    return h;
  },
  mount(el,ctx){
    const s=ctx.s;
    el.querySelectorAll('[data-acid]').forEach(a=>{const id=a.dataset.acid,hd=a.querySelector('.ac-h');if(hd)hd.addEventListener('click',()=>setTimeout(()=>{s.op[id]=a.classList.contains('open')},0))});
    el.querySelectorAll('[data-count]').forEach(b=>{UI.count(b,+b.dataset.count,fmt.sol,+b.dataset.from||0);LAST.tot=+b.dataset.count});
    if(s.ir){const id=s.ir;s.ir=null;setTimeout(()=>seguir(el,ctx,id),60)}
  },
  acts:{
    dia(el,ev,ctx){const i=+el.dataset.i;if(isNaN(i))return false;SEL=i;ctx.s.confR=null;ctx.s.confBorrar=false;ctx.s.todos=false},
    hoy(el,ev,ctx){SEL=HOY;ctx.s.confR=null;ctx.s.confBorrar=false;ctx.s.todos=false},
    leg(el,ev,ctx){const k=el.dataset.k;let id=k;if(k==='adic'){const t=adic(SEL)[0];if(!t){App.toast('Aún no hay adicionales este día');return false}id='adic-'+slug(t.tipo)}
      ctx.s.op=ctx.s.op||{};ctx.s.op[id]=true;ctx.s.ir=id},
    vertodos(el,ev,ctx){ctx.s.todos=!ctx.s.todos},
    rutq(el,ev,ctx){ctx.s.confR=+el.dataset.n},
    rutno(el,ev,ctx){ctx.s.confR=null},
    rutok(el,ev,ctx){const n=ctx.s.confR,a=rutas(SEL),k=a.findIndex(r=>r.n===n);if(k>=0)a.splice(k,1);lista(SEL).forEach(x=>{if(x.p.r===n)x.p.r=null});ctx.s.confR=null;App.toast('Ruta quitada. Sus pedidos siguen aquí')},
    hor(el,ev,ctx){ctx.s.op=ctx.s.op||{};ctx.s.op.horario=!ctx.s.op.horario},
    guardahor(el,ev,ctx){const a=val('ini-hin'),b=val('ini-hout');if(a&&b)HORA[SEL]={i:a,o:b};App.toast('Horario guardado')},
    borrar(el,ev,ctx){ctx.s.confBorrar=true},
    borrarno(el,ev,ctx){ctx.s.confBorrar=false},
    borrarok(el,ev,ctx){lista(SEL).forEach(x=>{x.p._del=true});rutas(SEL).length=0;adic(SEL).length=0;apoy(SEL).length=0;EXTRA[SEL]=0;FOT[SEL]=[];if(SEL===HOY)App.state.pedidos=0;ctx.s.confBorrar=false;App.toast('Día borrado','warn')},
    desc(el,ev,ctx){DESC.add(SEL);App.toast('Día de descanso marcado')},
    quitardesc(el,ev,ctx){DESC.delete(SEL);App.toast('Descanso quitado')},
    respx(el,ev,ctx){ctx.s.noresp=true}
  }
});

/* ---------- hoja CARGAR ---------- */
App.sheet('cargar',{k:'comanda',titulo:'Cargar',sub:'¿Qué vas a cargar?',
  cambios:['Cuatro tarjetas grandes de color, cada una con su figura, en vez de una lista de texto','La fecha va arriba, una sola vez','Cada tarjeta lleva directo a lo que sigue: sin pasos de más'],
  render(ctx){
    const fr=!ctx.s._f;ctx.s._f=true;const rc=n=>fr?`rise d${n}`:'';
    return `<div class="${rc(1)}"><label class="lbl" for="ini-fch">Elegir el día</label><input id="ini-fch" class="inp" type="date" value="${isoDia(SEL)}" max="${isoDia(HOY)}"><small class="tiny">${fechaL(SEL)}</small></div>
    <div class="grid2">${UI.tile({k:'foto',t:'Capturas de la tienda',s:'Rutas y Órdenes',d:'d2',a:'data-act="capturas"'})}${UI.tile({k:'comanda',t:'Comandas',s:'Foto de la hoja',d:'d3',a:'data-sheet="comandas"'})}${UI.tile({k:'adicional',t:'Adicional',s:'Taxi, Expo Vino…',d:'d4',a:'data-sheet="adicional"'})}${UI.tile({k:'apoyo',t:'Apoyo',s:'Cubrí otra tienda',d:'d5',a:'data-sheet="apoyo"'})}</div>
    <small class="tiny" style="text-align:center">Las fotos se leen aquí mismo, en tu celular.</small>`;
  },
  mount(h,ctx){const f=h.querySelector('#ini-fch');if(f)f.addEventListener('change',()=>{const i=DATA.hoy.dias.findIndex((x,k)=>isoDia(k)===f.value);if(i>=0&&i<=HOY){SEL=i;App.toast('Cargarás en '+fechaL(i))}else App.toast('Elige un día de esta semana','warn')})},
  acts:{capturas(){if(App.sheets.cargando)App.openSheet('cargando');else App.toast('Capturas: se lee la imagen en tu celular (demostración)');return false}}
});

/* ---------- hoja MÁS ---------- */
App.sheet('mas',{neutro:true,titulo:'Más',icono:'dots',sub:'Todo lo demás',
  cambios:['Cinco filas con su color y figura; ya no es una lista de texto','Cada una lleva a su pantalla con un solo toque'],
  render(){
    const f=[{k:'buscar',s:'Un pedido, cliente o teléfono',go:'buscar'},{k:'historial',s:'Tus días anteriores',go:'historial'},{k:'aprender',t:'Tutoriales',s:'Aprende en pasos cortos',go:'tutoriales'},{k:'ajustes',s:'Tienda, tarifa, respaldo',go:'ajustes'},{c:'var(--c-licencia)',i:'info',t:'Acerca de',s:'Versión y contacto',go:'acerca'}];
    return f.map((x,i)=>`<div class="rise d${i+1}">${UI.fila({k:x.k,c:x.c,i:x.i,t:x.t||ACC[x.k].n,s:x.s,a:`data-go="${x.go}"`})}</div>`).join('');
  }
});

/* ---------- hoja SUBIR MÁS (anotar pedidos) ---------- */
const FOTOS0=['v12344810wofp-01','v12344822wofp-01','v12344835wofp-01'];
App.sheet('subirmas',{k:'tienda',titulo:'Pedidos de mi tienda',sub:()=>fechaL(SEL),
  cambios:['Cuatro formas de anotar como mosaicos de color; al elegir una, las otras se esconden','Cada forma tiene su formulario con el borde de su color','«Otras formas de anotar» es un botón arriba, no un enlace','Guardar siempre termina igual: confeti, aviso y vuelves a Inicio con todo al día'],
  render(ctx){
    const s=ctx.s;s.tab=s.tab||'ped';const fr=!s._f;s._f=true;const rc=n=>fr?`rise d${n}`:'';
    let h=UI.seg('tab',[['ped','Pedidos'],['rut','Rutas'],['adi','Adicionales']],s.tab);
    if(s.tab==='ped'){
      if(!s.modo)h+=`<div class="grid2">${['comanda','cantidad','mano','foto'].map((k,i)=>UI.tile({k,d:'d'+(i+1),a:`data-act="modo" data-m="${k}"`})).join('')}</div>`;
      else{
        const a=ACC[s.modo];
        h+=`<button type="button" class="btn sec sm" style="width:100%" data-act="otras">${I('back')}Otras formas de anotar</button>`;
        h+=`<div class="ini-form pop" style="border:4px solid ${a.c}"><div class="ini-fh"><span class="fig" style="background:${a.c}">${I(a.i)}</span><div><b>${a.n}</b><small class="tiny" style="display:block">${a.s}</small></div></div>`;
        if(s.modo==='comanda')h+=`<div style="text-align:center">${ilus.foto(0,110,138)}</div><p class="muted" style="text-align:center">Saca una foto de la hoja y la app lee los datos.</p><button type="button" class="btn" style="background:var(--c-comanda)" data-sheet="comandas">${I('camara')}Abrir la cámara</button>`;
        if(s.modo==='cantidad')h+=`<label class="lbl">¿Cuántos pedidos hiciste?</label>${UI.stepper('ini-cant',4)}<label class="lbl">¿De qué día?</label>${chipsDia(SEL)}<button type="button" class="btn ok" data-act="gcant">${I('check')}Guardar</button>`;
        if(s.modo==='mano'){
          const rs=rutas(SEL);
          h+=`<div><label class="lbl" for="ini-cod">Código del pedido</label><input id="ini-cod" class="inp mono" placeholder="v12341686wofp-01" autocomplete="off"></div>
          <div><label class="lbl">Ruta</label><div class="chips">${UI.chip('Sin ruta',!rs.length,'data-one data-r=""')}${rs.map((r,i)=>UI.chip(`Ruta ${r.n} · ${r.h}`,i===rs.length-1,`data-one data-r="${r.n}"`)).join('')}</div></div>
          <div><label class="lbl">¿Cómo salió?</label><div class="ini-est">${['E','P','N'].map((e,i)=>`<button type="button" style="background:${['var(--ok)','var(--c-mano)','var(--ink3)'][i]}" aria-pressed="${i===0}" data-one data-e="${e}">${DATA.estado[e][0]}</button>`).join('')}</div></div>
          <div><label class="lbl">¿De qué día?</label>${chipsDia(SEL)}</div>
          <button type="button" class="btn" style="background:var(--c-mano)" data-act="gmano">${I('check')}Guardar pedido</button>`;
        }
        if(s.modo==='foto'){
          const f=s.fotos||(s.fotos=FOTOS0.slice());
          h+=`<div><label class="lbl">¿De qué día son las fotos?</label>${chipsDia(SEL)}</div><button type="button" class="btn sec sm" style="width:100%" data-toast="Elige las capturas de Órdenes">${I('foto')}Elegir fotos</button>
          ${f.map((c,i)=>`<div class="ini-fl">${ilus.foto(i,34,42)}<b class="mono">${c}</b><button type="button" class="chip" data-act="fq" data-k="${i}">${I('x')}Quitar</button></div>`).join('')||UI.aviso('No quedan pedidos en la lista','')}
          <button type="button" class="btn ${f.length?'':'dis'}" style="background:var(--c-foto)" data-act="gfoto">${I('check')}Guardar ${f.length} pedido${f.length===1?'':'s'}</button>`;
        }
        h+='</div>';
      }
    }else if(s.tab==='rut'){
      h+=`<div class="${rc(1)}">${UI.fila({c:'var(--acc)',i:'route',t:'Añadir una ruta',s:'Número, salida y regreso',a:'data-sheet="rutas-hoja"'})}</div><div class="${rc(2)}">${UI.fila({k:'foto',t:'Leer rutas de una foto',s:'Captura de Rutas',a:'data-toast="Leyendo rutas de la foto…"'})}</div><div class="${rc(3)}">${UI.fila({c:'var(--c-historial)',i:'clock',t:'Reordenar por hora',s:'Pone las rutas en orden',a:'data-act="reord"'})}</div>`;
    }else{
      h+=`<h4 class="ini-lbl2">Adicionales y apoyo</h4><div class="${rc(1)}">${UI.fila({k:'adicional',t:'Adicional',s:'Taxi, movilidad, Expo Vino…',a:'data-sheet="adicional"'})}</div><div class="${rc(2)}">${UI.fila({k:'apoyo',t:'Apoyo a otra tienda',s:'Por hora o por tramos',a:'data-sheet="apoyo"'})}</div>`;
    }
    return h;
  },
  acts:{
    modo(el,ev,ctx){ctx.s.modo=el.dataset.m},
    otras(el,ev,ctx){ctx.s.modo=null},
    fq(el,ev,ctx){ctx.s.fotos.splice(+el.dataset.k,1)},
    reord(){rutas(SEL).sort((a,b)=>tmin(a.h)-tmin(b.h));App.toast('Rutas en orden por hora')},
    gcant(){const o=document.getElementById('ini-cant'),n=o?+o.textContent||0:0;if(n<1){App.toast('Pon al menos 1 pedido','warn');return false}
      const d=diaSel();EXTRA[d]=(EXTRA[d]||0)+n;App.state.pedidos+=n;terminar(d,`¡Guardado! +${n} pedidos`);return false},
    gmano(){const c=val('ini-cod').trim(),d=diaSel();if(!c){App.toast('Escribe el código del pedido','warn');return false}
      if(lista(d).some(x=>x.p.c===c)){App.toast('Ya existe ese código ese día','warn');return false}
      const rb=document.querySelector('#hoja [data-r][aria-pressed="true"]'),eb=document.querySelector('#hoja [data-e][aria-pressed="true"]');
      const p={c,r:rb&&rb.dataset.r?+rb.dataset.r:null,e:eb?eb.dataset.e:'E',z:null,m:1000,cli:null,foto:false,mano:true,_d:d};
      (d===HOY?DATA.pedidos:OTROS).push(p);App.state.pedidos++;terminar(d,'¡Pedido guardado!');return false},
    gfoto(el,ev,ctx){const f=ctx.s.fotos||[];if(!f.length)return false;const d=diaSel();
      f.forEach(c=>{if(!lista(d).some(x=>x.p.c===c))(d===HOY?DATA.pedidos:OTROS).push({c,r:null,e:'E',z:null,m:1000,cli:null,foto:true,_d:d})});
      App.state.pedidos+=f.length;terminar(d,`¡Guardado! +${f.length} pedidos`);return false}
  }
});

/* ---------- hoja DÍA ---------- */
App.sheet('dia',{k:'tienda',
  titulo:c=>fechaL(c.p.i==null?SEL:+c.p.i),sub:c=>({cargado:'Con carga',vacio:'Sin cargar',descanso:'Descanso',futuro:'Todavía no llega'})[estadoDia(c.p.i==null?SEL:+c.p.i)],
  cambios:['Ya no hace falta mantener presionado: el botón ⋯ abre esta hoja','Dos botones grandes: descansar o ir a ese día'],
  render(ctx){
    const i=ctx.p.i==null?SEL:+ctx.p.i,e=estadoDia(i),R=resumen(i);
    return `<div class="card rise" style="display:flex;gap:12px;align-items:center">${UI.kpi(R.n,'pedidos')}${UI.kpi(fmt.sol(R.tot),'total')}${UI.kpi(rutas(i).length,'rutas')}</div>
    <div class="rise d1">${e==='descanso'?UI.btn({t:'Quitar el descanso',i:'refresh',c:'var(--c-ajustes)',a:'data-act="desc"'}):UI.btn({t:'Marcar descanso',i:'moon',c:'var(--c-ajustes)',a:'data-act="desc"'})}</div>
    <div class="rise d2">${UI.btn({t:'Ir a este día',i:'fwd',a:'data-act="ir"'})}</div>`;
  },
  pie:()=>UI.btn({t:'Cerrar',cls:'sec',a:'data-close'}),
  acts:{
    desc(el,ev,ctx){const i=ctx.p.i==null?SEL:+ctx.p.i;if(DESC.has(i)){DESC.delete(i);App.toast('Descanso quitado')}else{DESC.add(i);App.toast('Día de descanso marcado')}App.closeSheet();App.draw(false);return false},
    ir(el,ev,ctx){SEL=ctx.p.i==null?SEL:+ctx.p.i;App.closeSheet();App.go('inicio');return false}
  }
});

/* ---------- hoja PEDIDO ---------- */
function avisoLetra(ctx){
  const p=getP(ctx.p),pd=p._d==null?HOY:p._d,d=ctx.s.dsel!=null?ctx.s.dsel:pd,l=(ctx.s.letra||'').trim().toLowerCase(),code=p.c+l;
  if(/^pendiente/.test(p.c))return '';
  return lista(d).some(x=>x.p!==p&&x.p.c===code)?UI.aviso(`Ya existe ${esc(code)} ese día. Ponle una letra distinta (a, b…).`,'warn'):'';
}
const KM={0:4.1,1:9.6};
function radar(p){
  const km=p.km,a=((p.c.length*47+(p.r||0)*61)%360)*Math.PI/180;
  return `<svg class="ini-radar" viewBox="0 0 220 220" width="220" height="220" aria-label="Distancia desde la tienda">${[100,75,50,25].map((r,i)=>`<circle cx="110" cy="110" r="${r}" fill="${['var(--surf2)','var(--acc-soft)','var(--surf2)','var(--acc-soft)'][i]}" stroke="var(--line)" stroke-width="1.500"/>`).join('')}<path d="M110 10v200M10 110h200" stroke="var(--line)" stroke-width="1"/>${['12','8','5','3'].map((t,i)=>`<text x="${110+[100,75,50,25][i]*0.72+2}" y="${110-[100,75,50,25][i]*0.72-2}" font-size="10" font-weight="800" fill="var(--ink3)">${t} km</text>`).join('')}<circle cx="110" cy="110" r="9" fill="var(--acc)"/><path d="M106 110h8M110 106v8" stroke="#fff" stroke-width="2"/>${km!=null?`<g style="animation:ini-sube .5s both;transform-origin:${110+Math.cos(a)*Math.min(km,12)/12*100}px ${110+Math.sin(a)*Math.min(km,12)/12*100}px"><circle cx="${110+Math.cos(a)*Math.min(km,12)/12*100}" cy="${110+Math.sin(a)*Math.min(km,12)/12*100}" r="9" fill="var(--c-aprender)" stroke="#fff" stroke-width="3"/></g>`:''}</svg>`;
}
App.sheet('pedido',{k:'tienda',
  titulo:c=>{const p=getP(c.p);return /^pendiente/.test(p.c)?'Pedido sin código':esc(p.c)},
  sub:c=>{const p=getP(c.p),r=p.r!=null?rutas(p._d==null?HOY:p._d).find(q=>q.n===p.r):null;return r?`Ruta ${r.n} · ${r.h}`:'Sin ruta'},
  cambios:['La zona de entrega va arriba, en botones grandes con su precio','Ruta y estado son chips y botones de color, no listas desplegables','Aviso al momento si el código ya existe ese día','Borrar pide confirmar ahí mismo, sin ventanas'],
  render(ctx){
    const s=ctx.s,p=getP(ctx.p),pd=p._d==null?HOY:p._d;s.tab=s.tab||'pedido';const fr=!s._f;s._f=true;const rc=n=>fr?`rise d${n}`:'';
    let h=UI.seg('tab',[['pedido','Pedido'],['cliente',p.cli?'Cliente ●':'Cliente'],['dist',p.km!=null?'Distancia ●':'Distancia'],['evid',p.foto?'Evidencia ●':'Evidencia']],s.tab);
    if(s.tab==='pedido'){
      const zi=DATA.zonasAurora.findIndex(z=>z.m===p.m),from=s._pm!=null?s._pm:p.m,dsel=s.dsel!=null?s.dsel:pd,rs=rutas(pd);
      h+=`<h4 class="ini-lbl2 ${rc(1)}">¿En qué zona fue la entrega?</h4><div class="ini-zt ${rc(1)}">${DATA.zonasAurora.map((z,k)=>`<button type="button" class="tile" style="background:${ZCOL[k]}" aria-pressed="${zi===k}" data-act="zona" data-k="${k}"><span class="brillo"></span><span class="fig">${I('pin')}</span><span><b>${z.n}</b><span class="m">${fmt.sol(z.m)}</span></span></button>`).join('')}</div>
      <div class="ini-monto ${rc(2)}"><div><small>Este pedido paga</small><b class="ini-big" data-count="${mon(p)}" data-from="${from}">${fmt.sol(from)}</b></div>${I('coins')}</div>
      <div class="${rc(3)}"><label class="lbl">Ruta</label><div class="chips">${UI.chip('Sin ruta',p.r==null,'data-act="ruta" data-r=""')}${rs.map(r=>UI.chip(`Ruta ${r.n} · ${r.h}`,p.r===r.n,`data-act="ruta" data-r="${r.n}"`)).join('')}</div></div>
      <div class="${rc(3)}"><label class="lbl">Estado</label><div class="ini-est">${['E','P','N'].map((e,i)=>`<button type="button" style="background:${['var(--ok)','var(--c-mano)','var(--ink3)'][i]}" aria-pressed="${p.e===e}" data-act="est" data-e="${e}">${DATA.estado[e][0]}</button>`).join('')}</div></div>
      <div class="${rc(4)}"><label class="lbl">Día del pedido</label><div class="chips">${NOM3.slice(0,HOY+1).map((n,i)=>UI.chip(fechaC(i),i===dsel,`data-act="dsel" data-d="${i}"`)).join('')}</div></div>
      <div class="${rc(4)}"><label class="lbl" for="ini-letra">Letra (si el código se repite)</label><input id="ini-letra" class="inp" maxlength="2" placeholder="a" value="${esc(s.letra||'')}" autocomplete="off"></div>
      <div id="ini-av">${avisoLetra(ctx)}</div>
      <button type="button" class="btn sec" data-act="pasar">${I('fwd')}Pasar a ese día</button>
      ${s.confB?`<div class="ini-ruta">${UI.aviso('¿Borrar este pedido? No se puede deshacer.','bad')}<div class="grid2" style="margin-top:8px"><button type="button" class="btn bad sm" style="width:100%" data-act="borrarok">${I('trash')}Sí, borrar</button><button type="button" class="btn sec sm" style="width:100%" data-act="borrarno">No</button></div></div>`:`<button type="button" class="btn bad" data-act="borrar">${I('trash')}Borrar este pedido</button>`}`;
    }else if(s.tab==='cliente'){
      h+=`<div class="${rc(1)}"><label class="lbl" for="ini-cn">Nombre</label><input id="ini-cn" class="inp" value="${esc(p.cli||'')}" placeholder="Nombre del cliente"></div>
      <div class="${rc(2)}"><label class="lbl" for="ini-ct">Teléfono</label><input id="ini-ct" class="inp" inputmode="tel" value="${esc(p.tel||'')}" placeholder="9xx xxx xxx"></div>
      <div class="${rc(3)}"><label class="lbl" for="ini-cd">Dirección</label><input id="ini-cd" class="inp" value="${esc(p.dir||'')}" placeholder="Calle y número"></div>
      <button type="button" class="btn ok" data-act="gcli">${I('check')}Guardar cliente</button>
      <div class="grid2"><button type="button" class="btn" style="background:var(--c-cantidad)" data-toast="Llamando…">${I('phone')}Llamar</button><button type="button" class="btn" style="background:var(--c-apoyo)" data-toast="Abriendo WhatsApp…">${I('send')}WhatsApp</button></div>
      ${p.cli?`<button type="button" class="btn sec sm" style="width:100%" data-act="qcli">${I('trash')}Quitar los datos del cliente</button>`:''}`;
    }else if(s.tab==='dist'){
      h+=`<div class="${rc(1)}">${radar(p)}</div><div class="card ${rc(2)}" style="text-align:center"><b class="ini-big">${p.km!=null?p.km.toFixed(1)+' km':'—'}</b><small class="tiny" style="display:block">${p.km!=null?'En línea recta desde la tienda':'La dirección todavía no está ubicada'}</small></div>
      <button type="button" class="btn" style="background:var(--c-buscar)" data-act="ubicar">${I('pin')}Ubicar la dirección</button>
      <div><label class="lbl" for="ini-km">O escribe los kilómetros</label><input id="ini-km" class="inp" type="number" step="0.1" inputmode="decimal" placeholder="4.5"></div>
      <button type="button" class="btn sec sm" style="width:100%" data-act="gkm">${I('check')}Usar estos km</button>`;
    }else{
      h+=p.foto?`<div style="text-align:center" class="${rc(1)}">${ilus.foto(2,170,212)}</div><div class="grid2"><button type="button" class="btn" style="background:var(--c-foto)" data-sheet="visor-foto">${I('eye')}Ver</button><button type="button" class="btn sec" data-act="refoto">${I('camara')}Reemplazar</button></div><button type="button" class="btn bad sm" style="width:100%" data-act="qfoto">${I('trash')}Quitar la foto</button>`
        :`<div class="ini-vacio ${rc(1)}">${ilus.foto(1,120,150)}<h3>Sin foto</h3><p>Guarda la foto de la entrega como prueba.</p><button type="button" class="btn" style="background:var(--c-foto)" data-act="refoto">${I('camara')}Tomar o elegir foto</button></div>`;
    }
    return h;
  },
  pie:()=>UI.btn({t:'Listo',i:'check',a:'data-close'}),
  mount(h,ctx){
    h.querySelectorAll('[data-count]').forEach(b=>{UI.count(b,+b.dataset.count,fmt.sol,+b.dataset.from||0)});ctx.s._pm=null;
    const l=h.querySelector('#ini-letra');if(l)l.addEventListener('input',()=>{ctx.s.letra=l.value;const av=h.querySelector('#ini-av');if(av)av.innerHTML=avisoLetra(ctx)});
  },
  acts:{
    zona(el,ev,ctx){const p=getP(ctx.p),k=+el.dataset.k,z=DATA.zonasAurora[k];if(!z)return false;ctx.s._pm=mon(p);p.m=z.m;p.z=k===1?'Chorrillos':(['Miraflores','Surquillo','Santiago de Surco'].includes(p.z)?p.z:'Miraflores')},
    ruta(el,ev,ctx){const p=getP(ctx.p);p.r=el.dataset.r?+el.dataset.r:null},
    est(el,ev,ctx){const p=getP(ctx.p);ctx.s._pm=mon(p);p.e=el.dataset.e||p.e},
    dsel(el,ev,ctx){ctx.s.letra=val('ini-letra');ctx.s.dsel=+el.dataset.d},
    pasar(el,ev,ctx){const p=getP(ctx.p),pd=p._d==null?HOY:p._d,d=ctx.s.dsel!=null?ctx.s.dsel:pd,l=val('ini-letra').trim().toLowerCase();ctx.s.letra=l;
      if(d===pd&&!l){App.toast('Ya está en ese día');return false}
      if(!/^pendiente/.test(p.c)&&lista(d).some(x=>x.p!==p&&x.p.c===p.c+l)){App.toast('Ese código ya existe ese día','warn');return false}
      p._d=d;if(l&&!/^pendiente/.test(p.c))p.c=p.c+l;ctx.s.letra='';App.toast('Pasó a '+fechaL(d))},
    borrar(el,ev,ctx){ctx.s.confB=true},
    borrarno(el,ev,ctx){ctx.s.confB=false},
    borrarok(el,ev,ctx){const p=getP(ctx.p);p._del=true;App.state.pedidos=Math.max(0,App.state.pedidos-1);App.closeSheet();App.draw(false);App.toast('Pedido borrado','warn');return false},
    gcli(el,ev,ctx){const p=getP(ctx.p);p.cli=val('ini-cn').trim()||null;p.tel=val('ini-ct').trim();p.dir=val('ini-cd').trim();App.toast('Cliente guardado')},
    qcli(el,ev,ctx){const p=getP(ctx.p);p.cli=null;p.tel='';p.dir='';App.toast('Datos del cliente quitados')},
    ubicar(el,ev,ctx){const p=getP(ctx.p);p.km=KM[grupoZona(p)]||6.3;App.toast('Dirección ubicada')},
    gkm(el,ev,ctx){const p=getP(ctx.p),v=parseFloat(val('ini-km'));if(!(v>0)){App.toast('Escribe los kilómetros','warn');return false}p.km=v;App.toast('Kilómetros guardados')},
    refoto(el,ev,ctx){getP(ctx.p).foto=true;App.toast('Foto guardada')},
    qfoto(el,ev,ctx){getP(ctx.p).foto=false;App.toast('Foto quitada')}
  }
});

/* ---------- hoja VISOR DE FOTOS ---------- */
App.sheet('visor-foto',{k:'foto',full:true,titulo:'Capturas y fotos',
  sub:c=>{const f=fotos(SEL);return f.length?`${fechaC(SEL)} · ${(c.s.n||0)+1} de ${f.length}`:fechaC(SEL)},
  cambios:['Foto grande con flechas y botón para acercar','Borrar pide confirmar dentro de la misma hoja'],
  render(ctx){
    const f=fotos(SEL),s=ctx.s;s.n=Math.min(s.n||0,Math.max(f.length-1,0));
    if(!f.length)return `<div class="ini-vacio">${ilus.foto(1,120,150)}<h3>No hay fotos este día</h3><p>Las capturas y fotos que subas aparecen aquí.</p></div>`;
    return `<div class="ini-visor ${s.zoom?'zoom':''}"><div class="z" key="${s.n}">${ilus.foto(s.n,230,288)}</div></div>
    <div class="ini-nav"><button type="button" class="btn sec" data-act="prev" aria-label="Anterior">${I('back')}</button><div>${esc(f[s.n])}</div><button type="button" class="btn sec" data-act="next" aria-label="Siguiente">${I('fwd')}</button></div>
    ${s.conf?UI.aviso('¿Borrar esta foto? No se puede deshacer.','bad'):''}`;
  },
  pie(ctx){const f=fotos(SEL);if(!f.length)return UI.btn({t:'Cerrar',cls:'sec',a:'data-close'});
    return ctx.s.conf?`<button type="button" class="btn bad" data-act="bok">${I('trash')}Sí, borrar</button><button type="button" class="btn sec" data-act="bno">No</button>`
      :`<button type="button" class="btn bad" data-act="bq">${I('trash')}Borrar</button><button type="button" class="btn sec" data-act="zoom">${I('search')}${ctx.s.zoom?'Alejar':'Acercar'}</button>`},
  acts:{
    prev(el,ev,ctx){const n=fotos(SEL).length;ctx.s.n=((ctx.s.n||0)-1+n)%Math.max(n,1);ctx.s.conf=false},
    next(el,ev,ctx){const n=fotos(SEL).length;ctx.s.n=((ctx.s.n||0)+1)%Math.max(n,1);ctx.s.conf=false},
    zoom(el,ev,ctx){ctx.s.zoom=!ctx.s.zoom},
    bq(el,ev,ctx){ctx.s.conf=true},
    bno(el,ev,ctx){ctx.s.conf=false},
    bok(el,ev,ctx){fotos(SEL).splice(ctx.s.n||0,1);ctx.s.conf=false;App.toast('Foto borrada','warn')}
  }
});

/* ---------- hoja RUTAS ---------- */
App.sheet('rutas-hoja',{c:'var(--acc)',color:'var(--acc)',icono:'route',titulo:'Añadir ruta',sub:()=>fechaL(SEL),
  cambios:['Tres datos y listo: número, salida y regreso','El número ya viene puesto con el que sigue'],
  render(ctx){
    const n=Math.max(0,...rutas(SEL).map(r=>r.n))+1;
    return `<div class="rise"><label class="lbl">Número de ruta</label>${UI.stepper('ini-rn',n)}</div>
    <div class="grid2 rise d1"><div><label class="lbl" for="ini-rs">Salida</label><input id="ini-rs" class="inp" type="time" value="17:00"></div><div><label class="lbl" for="ini-rr">Regreso</label><input id="ini-rr" class="inp" type="time" value="18:30"></div></div>
    ${UI.aviso('Si no sabes la hora de regreso, pon la última que recuerdes.','')}`;
  },
  pie:()=>UI.btn({t:'Guardar ruta',i:'check',cls:'ok',a:'data-act="guardar"'}),
  acts:{guardar(){
    const o=document.getElementById('ini-rn'),n=o?+o.textContent||0:0,a=rutas(SEL);
    if(n<1){App.toast('Pon el número de ruta','warn');return false}
    if(a.some(r=>r.n===n)){App.toast('Esa ruta ya existe ese día','warn');return false}
    a.push({n,h:val('ini-rs')||'17:00',fin:val('ini-rr')||'18:30',pedidos:0,estado:'Finalizado'});a.sort((x,y)=>tmin(x.h)-tmin(y.h));
    App.closeSheet();App.draw(false);App.confetti();App.toast('¡Ruta guardada!');return false}}
});
})();
