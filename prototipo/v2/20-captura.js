/* =====================================================================
   20-captura.js — CAPTURA Y REGISTRO AVANZADO
   comandas · comanda-revisar · adicional · apoyo · detalle-bloque ·
   cargando · revision (+ revision-pedido) · compartir
   Prefijo CSS: cap-
   ===================================================================== */
(function(){
  const H=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const sol=fmt.sol;
  const pad=n=>String(n).padStart(2,'0');
  const hhmm=()=>{const d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes())};
  const mins=m=>pad(Math.floor(m/60)%24)+':'+pad(m%60);
  const horasTxt=m=>{const h=Math.floor(m/60),r=m%60;return h+' h'+(r?' '+r+' min':'')};
  const TR=DATA.tramosAldabas;               /* 5 tramos */
  const parseSol=v=>Math.round((parseFloat(String(v).replace(',','.'))||0)*100);

  /* ---------- utilidades de formulario ---------- */
  function fv(s,k,d){return s.f&&s.f[k]!=null?s.f[k]:d}
  function bind(root,s){$$('[data-f]',root).forEach(e=>e.addEventListener('input',()=>{(s.f=s.f||{})[e.dataset.f]=e.value}))}
  function memAc(root,s){s.ab=s.ab||{};$$('.ac-h',root).forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{const a=b.closest('.ac');if(a)s.ab[a.dataset.acid]=a.classList.contains('open')},0)))}
  function contar(root,s,id,to,f){const el=root.querySelector('#'+id);if(!el)return;const from=s.prev||0;if(from===to){el.textContent=f(to)}else UI.count(el,to,f,from);s.prev=to}
  function recolor(h,c,claro){const cab=h&&h.querySelector('.hoja-cab');if(!cab)return;cab.style.background=c;cab.classList.toggle('claro',!!claro)}
  function guardado(msg){App.confetti();App.toast(msg||'¡Guardado!')}
  function confirmar(texto,siAct,noAct){return `<div class="aviso bad cap-conf">${I('warn')}<div>${texto}<div class="cap-conf-b"><button type="button" class="btn sm bad" data-act="${siAct}">Sí, quitar</button><button type="button" class="btn sm sec" data-act="${noAct}">No, dejarlo</button></div></div></div>`}

  /* ---------- CSS ---------- */
  App.css(`
  .cap-bigs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .cap-big{position:relative;min-height:172px;border-radius:24px;padding:12px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;box-shadow:0 6px 0 rgba(0,0,0,.2);border:4px solid transparent;transition:transform .15s,border-color .2s}
  .cap-big:active{transform:translateY(4px);box-shadow:0 2px 0 rgba(0,0,0,.2)}
  .cap-big.cam{background:var(--c-comanda)} .cap-big.gal{background:var(--c-foto)}
  .cap-big[aria-pressed=true]{border-color:var(--ink);transform:translateY(-2px)}
  .cap-big b{font:600 20px/1.1 var(--f-display)} .cap-big small{opacity:.92;font-weight:700}
  .cap-ck{position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;background:#fff;color:#0a2260;display:none;place-items:center;font-weight:800}
  .cap-big[aria-pressed=true] .cap-ck{display:grid;animation:pop .3s}
  .cap-lens{transform-box:fill-box;transform-origin:center;animation:capLens 1.8s ease-in-out infinite}
  .cap-flash{animation:capFlash 1.8s steps(1) infinite}
  @keyframes capLens{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
  @keyframes capFlash{0%,70%{opacity:.2}75%,100%{opacity:1}}
  .cap-sol{transform-box:fill-box;transform-origin:center;animation:bob 2.4s ease-in-out infinite}
  .cap-tips{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .cap-tip{background:var(--surf2);border-radius:18px;padding:10px;display:flex;flex-direction:column;gap:6px}
  .cap-tip svg{width:100%;height:60px} .cap-tip b{font:600 15px/1.15 var(--f-display)} .cap-tip small{color:var(--ink2);font-weight:700;font-size:12.5px;line-height:1.25}
  .cap-lect{background:var(--surf2);border-radius:20px;padding:12px;display:flex;flex-direction:column;gap:8px}
  .cap-foto{position:relative;height:150px;border-radius:14px;background:var(--surf);overflow:hidden;display:grid;place-items:center}
  .cap-foto svg{height:138px}
  .cap-scan{position:absolute;left:0;right:0;top:0;height:4px;background:var(--c-comanda);box-shadow:0 0 14px 6px var(--c-comanda);opacity:.85;animation:capScan 1.3s ease-in-out infinite alternate}
  @keyframes capScan{from{top:0}to{top:calc(100% - 4px)}}
  .cap-lt{display:flex;justify-content:space-between;align-items:center;font-weight:800}
  .cap-lt span{font-family:var(--f-display)}
  .cap-row{display:flex;align-items:center;gap:12px;width:100%;padding:10px;border-radius:18px;background:var(--surf2);text-align:left;min-height:72px;transition:transform .12s}
  .cap-row:active{transform:scale(.98)} .cap-row + .cap-row{margin-top:8px}
  .cap-row b{display:block;line-height:1.15} .cap-row small{display:block;color:var(--ink2);font-weight:700}
  .cap-row .pill{margin-left:auto;flex:none}
  .cap-th{width:44px;height:56px;flex:none}
  .cap-pend{background:var(--warn-soft);color:var(--warn);border-radius:16px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
  .cap-pend.ok{background:var(--ok-soft);color:var(--ok)}
  .cap-pend-t{display:flex;align-items:center;gap:8px;font-weight:800}
  .cap-pend .barra{background:rgba(0,0,0,.12)} .cap-pend .barra i{background:currentColor}
  .cap-conf-b{display:flex;gap:8px;margin-top:8px}
  .cap-conf-b .btn{flex:1}
  .cap-pie{display:flex;flex-direction:column;gap:8px;width:100%} .cap-pie-r{display:flex;gap:8px} .cap-pie-r .btn{flex:1}
  .cap-dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .cap-opc{position:relative;min-height:112px;border-radius:20px;border:3px solid var(--line);background:var(--surf);padding:12px;display:flex;flex-direction:column;gap:4px;text-align:left;transition:transform .12s,border-color .15s,background .15s}
  .cap-opc:active{transform:scale(.97)}
  .cap-opc .fg{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;color:#fff;margin-bottom:2px}
  .cap-opc b{font:600 16px/1.1 var(--f-display)} .cap-opc small{color:var(--ink2);font-weight:700;font-size:12.5px;line-height:1.2}
  .cap-opc[aria-pressed=true]{border-color:var(--acc);background:var(--acc-soft)}
  .cap-opc[aria-pressed=true]::after{content:"✓";position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;font-size:14px;animation:pop .3s}
  .cap-prev{border-radius:18px;background:var(--surf2);padding:12px;text-align:center}
  .cap-prev code{display:block;font:600 34px var(--f-display);letter-spacing:.04em;color:var(--c-comanda)}
  .cap-prev code em{font-style:normal;color:var(--sun-ink);background:var(--sun);border-radius:8px;padding:0 6px;margin-left:2px}
  .cap-ruta{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:99px;background:var(--c-comanda);color:#fff;font-weight:800}
  .cap-fld{display:flex;flex-direction:column;gap:6px}
  .cap-fld-h{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .cap-fld-h .lbl{margin:0}
  .inp.dud{border-color:var(--warn)} .inp.no{border-color:var(--bad)}
  .cap-mapa{border-radius:18px;overflow:hidden;background:var(--surf2);position:relative}
  .cap-mapa svg{display:block;width:100%;height:auto}
  .cap-ruta-l{stroke-dasharray:420;stroke-dashoffset:420;animation:trazo 1.2s .2s forwards}
  .cap-drop{transform-box:fill-box;transform-origin:50% 100%;animation:capDrop .6s cubic-bezier(.3,1.6,.5,1) both}
  @keyframes capDrop{from{transform:translateY(-40px) scale(.4);opacity:0}to{transform:none;opacity:1}}
  .cap-kmbox{display:flex;align-items:center;gap:12px;background:var(--surf2);border-radius:16px;padding:10px 14px}
  .cap-kmbox b{font:600 30px var(--f-display)}
  .cap-trs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .cap-tr{position:relative;min-height:66px;border-radius:16px;border:3px solid var(--line);background:var(--surf);padding:8px 10px;display:flex;flex-direction:column;text-align:left;transition:transform .12s,border-color .15s,background .15s}
  .cap-tr:active{transform:scale(.97)} .cap-tr b{font-weight:800;line-height:1.1} .cap-tr small{color:var(--ink2);font-weight:700;font-size:12px} .cap-tr em{font:600 16px var(--f-display);font-style:normal;margin-top:2px}
  .cap-tr[aria-pressed=true]{border-color:var(--acc);background:var(--acc-soft)}
  .cap-tr[aria-pressed=true]::after{content:"✓";position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;font-size:13px;animation:pop .3s}
  .cap-tipos{display:flex;flex-wrap:wrap;gap:8px}
  .cap-tipos .chip{min-height:46px;font-size:15px}
  .cap-nuevo{display:flex;gap:8px} .cap-nuevo .inp{flex:1}
  .cap-marca{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .cap-mk{border-radius:20px;padding:12px;min-height:116px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;box-shadow:0 5px 0 rgba(0,0,0,.18);transition:transform .12s;background:var(--surf2)}
  .cap-mk:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.18)}
  .cap-mk:disabled{opacity:.5;box-shadow:none}
  .cap-mk.go{background:var(--ok);color:#fff} .cap-mk.stop{background:var(--bad);color:#fff}
  .cap-mk.done{background:var(--surf2);color:var(--ink);box-shadow:none}
  .cap-mk b{font:600 18px/1.1 var(--f-display)} .cap-mk small{font-weight:700;opacity:.92}
  .cap-mk .fg{width:40px;height:40px;border-radius:14px;background:rgba(255,255,255,.25);display:grid;place-items:center}
  .cap-mk.done .fg{background:var(--ok);color:#fff}
  .cap-live{animation:latido 1.4s infinite}
  .cap-via{position:relative;height:44px;border-radius:14px;background:var(--surf2);overflow:hidden}
  .cap-via::before{content:"";position:absolute;left:0;right:0;top:50%;height:0;border-top:4px dashed var(--line)}
  .cap-via .carro{position:absolute;top:6px;left:0;animation:capDrive 3s linear infinite}
  @keyframes capDrive{from{left:-50px}to{left:100%}}
  .cap-zonas{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .cap-z{position:relative;min-height:62px;border-radius:16px;padding:8px 10px;color:#fff;background:var(--zc);display:flex;flex-direction:column;justify-content:center;text-align:left;box-shadow:0 4px 0 rgba(0,0,0,.2);transition:transform .1s}
  .cap-z:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.2)}
  .cap-z b{font-weight:800;font-size:13.5px;line-height:1.1;padding-right:26px} .cap-z small{font:600 14px var(--f-display);opacity:.95}
  .cap-z[data-n="0"]{opacity:.9}
  .cap-bad{position:absolute;top:-6px;right:-4px;min-width:28px;height:28px;padding:0 6px;border-radius:99px;background:#fff;color:#0a2260;font:600 15px/28px var(--f-display);font-style:normal;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.3)}
  .cap-tot{display:flex;align-items:center;gap:10px;background:var(--acc-soft);border-radius:18px;padding:10px 12px}
  .cap-tot b{font:600 24px/1.1 var(--f-display);flex:1}
  .cap-leg{display:flex;flex-wrap:wrap;gap:6px}
  .cap-leg span{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;color:var(--ink2)}
  .cap-leg i{width:12px;height:12px;border-radius:4px;display:block}
  .cap-evr{display:flex;align-items:center;gap:8px} .cap-evr span{flex:1;font-weight:800;font-size:14px} .cap-evr .inp{width:104px;min-height:44px;font-size:15px;text-align:right}
  .cap-modo{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .cap-md{min-height:64px;border-radius:18px;border:3px solid var(--c-apoyo);color:var(--c-apoyo);background:var(--surf);display:flex;align-items:center;justify-content:center;gap:8px;font:600 17px var(--f-display);transition:transform .12s,background .15s}
  .cap-md:active{transform:scale(.96)} .cap-md[aria-pressed=true]{background:var(--c-apoyo);color:#fff;box-shadow:0 5px 0 rgba(0,0,0,.2)}
  .cap-hr{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .cap-hr>div{background:var(--surf2);border-radius:18px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px}
  .cap-hr output{font:600 30px var(--f-display)}
  .cap-hr .bt{display:flex;gap:10px} .cap-hr .bt button{width:48px;height:44px;border-radius:14px;background:var(--surf);font:600 24px var(--f-display);text-align:center}
  .cap-hr .bt button:active{transform:scale(.9)}
  .cap-res{border-radius:20px;background:var(--c-apoyo);color:#fff;padding:14px;text-align:center}
  .cap-res b{display:block;font:600 36px/1.1 var(--f-display)} .cap-res small{font-weight:700;opacity:.92}
  .cap-ped{display:flex;align-items:center;gap:8px;background:var(--surf2);border-radius:16px;padding:8px 10px}
  .cap-ped+.cap-ped{margin-top:8px}
  .cap-ped .n{width:30px;height:30px;border-radius:50%;background:var(--c-apoyo);color:#fff;display:grid;place-items:center;font:600 15px var(--f-display);flex:none}
  .cap-ped .tr{flex:1;min-height:44px;border-radius:12px;background:var(--surf);font-weight:800;padding:0 10px;display:flex;align-items:center;justify-content:space-between;gap:6px;text-align:left}
  .cap-ped .xx{width:40px;height:44px;border-radius:12px;background:var(--bad-soft);color:var(--bad);display:grid;place-items:center}
  .cap-km{display:flex;align-items:center;gap:4px} .cap-km button{width:34px;height:44px;border-radius:10px;background:var(--surf);font:600 20px var(--f-display);text-align:center} .cap-km output{min-width:48px;text-align:center;font-weight:800;font-size:14px}
  .cap-monto{border-radius:24px;padding:20px 14px;text-align:center;color:#fff;background:var(--adc,var(--c-adic));position:relative;overflow:hidden}
  .cap-monto.claro{color:var(--sun-ink)}
  .cap-monto b{display:block;font:600 46px/1.05 var(--f-display)} .cap-monto small{font-weight:800;opacity:.9}
  .cap-dato{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;background:var(--surf2)}
  .cap-dato+.cap-dato{margin-top:8px}
  .cap-dato .ic{color:var(--ink2)} .cap-dato span{flex:1;color:var(--ink2);font-weight:700} .cap-dato b{font-weight:800;text-align:right}
  .cap-ruta-c{position:relative;height:74px;border-radius:18px;background:var(--surf2);overflow:hidden}
  .cap-ruta-c::before{content:"";position:absolute;left:10px;right:10px;top:54px;border-top:5px dashed var(--line)}
  .cap-ruta-c .carro{position:absolute;top:22px;left:0;transition:left .25s linear}
  .cap-pct{display:flex;justify-content:space-between;font-weight:800}
  .cap-vacio{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:30px 10px}
  .cap-vacio svg{width:150px;height:auto} .cap-vacio h2{font-size:24px}
  .cap-fecha{display:flex;align-items:center;gap:10px;border-radius:18px;background:var(--c-comanda);color:#fff;padding:12px 14px}
  .cap-fecha b{display:block;font:600 19px/1.1 var(--f-display)} .cap-fecha small{opacity:.9;font-weight:700}
  .cap-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .cap-rt{display:flex;align-items:center;gap:10px;padding:10px;border-radius:16px;background:var(--surf2)}
  .cap-rt+.cap-rt{margin-top:8px}
  .cap-rt .n{width:34px;height:34px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;font:600 16px var(--f-display);flex:none}
  .cap-rt b{display:block;line-height:1.15} .cap-rt small{display:block;color:var(--ink2);font-weight:700}
  .cap-fila-sw{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:800}
  .cap-sim{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 8px;text-align:center}
  .cap-sim svg{width:190px;height:auto}
  .cap-orb{transform-box:fill-box;transform-origin:center;animation:capOrb 1.6s ease-in-out infinite}
  .cap-orb.b{animation-delay:.25s} .cap-orb.c{animation-delay:.5s}
  @keyframes capOrb{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-12px);opacity:1}}
  .cap-fly{transform-box:fill-box;transform-origin:center;animation:capFly 1.8s ease-in infinite}
  @keyframes capFly{0%{transform:translate(-26px,-10px) scale(1.15);opacity:0}25%{opacity:1}100%{transform:translate(8px,24px) scale(.6);opacity:.2}}
  `);

  /* ---------- ilustraciones ---------- */
  const papel=(w,h,estado)=>{
    const rows=[0,1,2,3,4,5].map(k=>`<rect x="14" y="${16+k*13}" width="${k%3===2?34:58}" height="5" rx="2.5" fill="${estado==='fallo'?'#d9a5a0':'#c3cde8'}"/>`).join('');
    return `<svg viewBox="0 0 84 94" width="${w}" height="${h}" aria-hidden="true"><g transform="rotate(-3 42 47)"><rect x="6" y="4" width="72" height="86" rx="6" fill="#fff" stroke="#c3cde8" stroke-width="2"/>${rows}<rect x="56" y="62" width="14" height="14" rx="3" fill="#1f5cff" opacity=".85"/></g></svg>`};
  const thumb=(i,est)=>{
    const lines=[0,1,2,3].map(k=>`<rect x="9" y="${12+k*8}" width="${k%2?16:22}" height="3.5" rx="1.7" fill="${est==='fallo'?'#d9a5a0':'#c3cde8'}"/>`).join('');
    const marca=est==='fallo'?`<circle cx="30" cy="42" r="8" fill="#c42b21"/><path d="M30 38v5M30 46v.01" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`:est==='guardada'?`<circle cx="30" cy="42" r="8" fill="#0c7d3c"/><path d="M26 42l3 3 5-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`:'';
    return `<svg class="cap-th" viewBox="0 0 40 52" aria-hidden="true"><rect x="2" y="2" width="34" height="48" rx="5" fill="#fff" stroke="#c3cde8" stroke-width="2"/>${lines}${marca}</svg>`};
  const camSvg=`<svg viewBox="0 0 80 60" width="82" height="62" aria-hidden="true"><rect x="6" y="14" width="68" height="42" rx="10" fill="#fff" opacity=".95"/><path d="M26 14l4-8h20l4 8z" fill="#fff" opacity=".95"/><circle cx="40" cy="35" r="15" fill="#0a2260"/><circle class="cap-lens" cx="40" cy="35" r="9" fill="#1f5cff"/><circle cx="36" cy="31" r="3" fill="#fff" opacity=".8"/><circle class="cap-flash" cx="64" cy="22" r="3.5" fill="#ffc800"/></svg>`;
  const galSvg=`<svg viewBox="0 0 80 60" width="82" height="62" aria-hidden="true"><rect x="8" y="6" width="64" height="46" rx="9" fill="#fff" opacity=".95"/><circle class="cap-sol" cx="56" cy="20" r="6" fill="#ffc800"/><path d="M8 44l18-18 14 14 10-9 22 21v0a9 9 0 01-9 6H17a9 9 0 01-9-9z" fill="#7a3ff2" opacity=".85"/><rect x="14" y="12" width="64" height="46" rx="9" fill="none" stroke="#fff" stroke-width="3" opacity=".5" transform="translate(-6 0)"/></svg>`;
  const tipLuz=`<svg viewBox="0 0 120 60" aria-hidden="true"><circle class="cap-sol" cx="30" cy="30" r="13" fill="#ffc800"/>${[0,45,90,135,180,225,270,315].map(a=>`<path d="M30 8v-5" stroke="#ffc800" stroke-width="3" stroke-linecap="round" transform="rotate(${a} 30 30)"/>`).join('')}<rect x="62" y="8" width="44" height="46" rx="5" fill="#fff" stroke="#c3cde8" stroke-width="2"/><rect x="68" y="16" width="30" height="4" rx="2" fill="#c3cde8"/><rect x="68" y="26" width="24" height="4" rx="2" fill="#c3cde8"/><rect x="68" y="36" width="30" height="4" rx="2" fill="#c3cde8"/></svg>`;
  const tipPlana=`<svg viewBox="0 0 120 60" aria-hidden="true"><rect x="10" y="6" width="84" height="50" rx="5" fill="#fff" stroke="#c3cde8" stroke-width="2"/><rect x="18" y="14" width="40" height="4" rx="2" fill="#c3cde8"/><rect x="18" y="24" width="52" height="4" rx="2" fill="#c3cde8"/><rect x="74" y="6" width="20" height="50" rx="0" fill="#1f5cff" opacity=".18"/><path d="M104 20l-8 10 8 10" stroke="#1f5cff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="76" y="35" font-size="9" font-weight="800" fill="#1f5cff">der.</text></svg>`;
  const tipDos=`<svg viewBox="0 0 120 60" aria-hidden="true"><rect x="8" y="8" width="44" height="46" rx="5" fill="#fff" stroke="#c3cde8" stroke-width="2"/><rect x="68" y="8" width="44" height="46" rx="5" fill="#fff" stroke="#c3cde8" stroke-width="2"/><path d="M14 20h30M14 30h24M74 20h30M74 30h24" stroke="#c3cde8" stroke-width="4" stroke-linecap="round"/><path d="M60 8v46" stroke="#a3274f" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/></svg>`;
  const tipVer=`<svg viewBox="0 0 120 60" aria-hidden="true"><path d="M10 30s18-22 50-22 50 22 50 22-18 22-50 22S10 30 10 30z" fill="#fff" stroke="#c3cde8" stroke-width="2"/><circle cx="60" cy="30" r="13" fill="#0c7d3c"/><path d="M53 30l5 5 9-10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const mapaSvg=(ubic,nuevo)=>`<svg viewBox="0 0 300 150" aria-hidden="true"><rect width="300" height="150" fill="none"/>
    <path d="M0 40h300M0 100h300M60 0v150M170 0v150M250 0v150" stroke="var(--line)" stroke-width="9" opacity=".9"/>
    <rect x="72" y="50" width="86" height="40" rx="6" fill="var(--ok-soft)"/><rect x="182" y="8" width="56" height="24" rx="6" fill="var(--acc-soft)"/><rect x="182" y="108" width="56" height="30" rx="6" fill="var(--warn-soft)"/>
    <circle cx="150" cy="75" r="64" fill="none" stroke="var(--acc)" stroke-width="2" stroke-dasharray="5 6" opacity=".5"/>
    ${ubic?`<path class="cap-ruta-l" d="M60 100V40H170V100H250" fill="none" stroke="var(--acc)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`:''}
    <g transform="translate(60 100)"><circle r="13" fill="var(--acc)"/><path d="M-5 -3l5 -4l5 4v6h-10z" fill="#fff"/></g>
    ${ubic?`<g class="${nuevo?'cap-drop':''}" transform="translate(250 100)"><path d="M0 4C-12 -8 -12 -22 0 -22s12 14 0 26z" fill="var(--bad)"/><circle cy="-13" r="4.5" fill="#fff"/></g>`:'<text x="250" y="104" text-anchor="middle" font-size="22" opacity=".4">?</text>'}</svg>`;

  /* =========================================================
     COMANDAS (lista simulada compartida entre hojas)
     ========================================================= */
  const CM=[
    {nombre:'Claudia Castro Vega',tel:'987 654 321',dir:'Av. Larco 1234, dpto. 502, Miraflores',desp:'7106635',hora:'17:00–18:00',conf:{nombre:'ok',tel:'ok',dir:'dud'},zona:'Miraflores',km:2.4,tr:0},
    {nombre:'Luis Paredes Soto',tel:'9?? 555 014',dir:'Jr. Tarata 220, Miraflores',desp:'7106638',hora:'17:00–18:00',conf:{nombre:'ok',tel:'dud',dir:'ok'},zona:'Miraflores',km:4.6,tr:1},
    {nombre:'',tel:'',dir:'',desp:'',hora:'17:00–18:00',conf:{nombre:'no',tel:'no',dir:'no'},zona:'',km:null,tr:null,
      alt:{nombre:'Elsa Tizón Ramos',tel:'955 120 774',dir:'Calle Los Olivos 88, Chorrillos',desp:'7106641',conf:{nombre:'ok',tel:'ok',dir:'ok'},zona:'Chorrillos',km:9.1,tr:2}}
  ];
  const CAP={items:[]};
  function ensure(){if(!CAP.items.length)CAP.items=[{est:'lista'},{est:'revisar'},{est:'fallo'}]}
  function getC(i){ensure();const b=CM[i]||CM[0],it=CAP.items[i]||{};return (it.releida&&b.alt)?Object.assign({},b,b.alt):b}
  const vis=()=>CAP.items.map((it,i)=>({it,i})).filter(x=>!x.it.quitada);
  function stats(){const v=vis();const g=v.filter(x=>x.it.est==='guardada').length,l=v.filter(x=>x.it.est==='lista').length,p=v.filter(x=>x.it.est==='revisar'||x.it.est==='fallo').length;return {total:v.length,g,l,p,sin:v.length-g}}
  const chipEst={lista:['Lista','ok','check'],revisar:['Revisar','warn','warn'],fallo:['No se leyó','bad','x'],guardada:['Guardada','acc','check']};

  App.sheet('comandas',{
    titulo:'Comandas',sub:'Fotos de las hojas de entrega',k:'comanda',full:true,
    render(c){
      ensure();const s=c.s;
      if(!s.init){s.init=1;s.fase=(c.p.retomar!=null)?'captura':(CAP.items.some(x=>!x.quitada)&&CAP.items.length?'lista':'captura');if(c.p.retomar!=null)s.retomar=+c.p.retomar}
      if(s.fase==='lista')return listaV(c);
      return capturaV(c);
    },
    pie(c){
      const s=c.s;
      if(s.fase==='lista'){const st=stats();
        const prin=st.p>0?`<button type="button" class="btn" data-act="principal">${I('check')}Revisar y guardar</button>`:st.l>0?`<button type="button" class="btn ok" data-act="principal">${I('check')}Guardar ${st.l} ${st.l===1?'lista':'listas'}</button>`:`<button type="button" class="btn ok" data-close>${I('check')}Listo</button>`;
        return `<div class="cap-pie"><div class="cap-pie-r"><button type="button" class="btn sm sec" style="width:auto" data-act="elegir" data-v="cam">${I('camara')}Cámara</button><button type="button" class="btn sm sec" style="width:auto" data-act="elegir" data-v="gal">${I('foto')}Galería</button></div>${prin}</div>`}
      return `<button type="button" class="btn dis" disabled>${s.leyendo?'Leyendo la hoja…':'Elige cómo traer la foto'}</button>`;
    },
    acts:{
      elegir(el,ev,c){const s=c.s;if(s.leyendo)return false;s.sel=el.dataset.v;s.leyendo=true;s.prog=0;s.fase='captura';s.salir=false},
      salir(el,ev,c){const st=stats();if(st.sin>0){c.s.salir=true}else{App.closeSheet();return false}},
      seguir(el,ev,c){c.s.salir=false},
      principal(el,ev,c){const st=stats();
        if(st.p>0){const f=vis().find(x=>x.it.est==='revisar'||x.it.est==='fallo');App.openSheet('comanda-revisar',{i:f.i});return false}
        CAP.items.forEach(it=>{if(!it.quitada&&it.est==='lista')it.est='guardada'});guardado('¡Comandas guardadas!')}
    },
    mount(h,c){
      const s=c.s;
      if(s.leyendo&&!s.timer){
        s.timer=setInterval(()=>{
          if(App.sheetCtx!==c){clearInterval(s.timer);s.timer=0;return}
          s.prog=Math.min(100,(s.prog||0)+7+Math.random()*5);
          const b=document.getElementById('capProg'),p=document.getElementById('capPct'),t=document.getElementById('capTxt');
          if(b)b.style.width=s.prog+'%';if(p)p.textContent=Math.round(s.prog)+'%';
          if(t)t.textContent=s.prog<35?'Buscando la hoja…':s.prog<70?'Leyendo nombre y dirección…':'Revisando los números…';
          if(s.prog>=100){
            clearInterval(s.timer);s.timer=0;s.leyendo=false;s.salir=false;
            if(s.retomar!=null){const i=s.retomar;s.retomar=null;CAP.items[i].releida=true;CAP.items[i].est='revisar';s.fase='lista';App.toast('¡Se leyó mejor!');App.openSheet('comanda-revisar',{i});return}
            if(!CAP.items.length)ensure();else App.toast('Foto añadida a la lista');
            s.fase='lista';App.refresh();
          }
        },90);
      }
    },
    cambios:['Dos botones enormes de color (cámara y galería) en lugar de texto; el elegido queda marcado con ✓','Consejos como 4 tarjetitas con figura, no un párrafo','Mientras lee se ve un escáner y una barra de avance; después, una fila por comanda con su miniatura y su estado en color','«N sin guardar» es una barra: se ve de un vistazo cuánto falta']
  });

  function capturaV(c){
    const s=c.s,sel=s.sel;
    const nom=s.retomar!=null?(CM[s.retomar].alt?CM[s.retomar].alt.nombre:'esta comanda'):'';
    return `
      ${s.retomar!=null?UI.aviso('Vuelve a tomar la comanda que no se leyó. Acércate más y con buena luz.','warn','camara'):''}
      <div class="cap-bigs rise">
        <button type="button" class="cap-big cam" data-act="elegir" data-v="cam" aria-pressed="${sel==='cam'}"><span class="cap-ck">✓</span>${camSvg}<b>Tomar foto</b><small>Con la cámara</small></button>
        <button type="button" class="cap-big gal" data-act="elegir" data-v="gal" aria-pressed="${sel==='gal'}"><span class="cap-ck">✓</span>${galSvg}<b>Elegir de la galería</b><small>Una foto que ya tienes</small></button>
      </div>
      ${s.leyendo?`<div class="cap-lect rise">
          <div class="cap-foto">${papel(120,138)}<i class="cap-scan"></i></div>
          <div class="cap-lt"><b id="capTxt">Buscando la hoja…</b><span id="capPct">${Math.round(s.prog||0)}%</span></div>
          <div class="barra"><i id="capProg" style="width:${s.prog||0}%;background:var(--c-comanda)"></i></div>
          <small class="tiny">${I('shield').replace('class="ic ','class="ic ')}Se lee aquí mismo en tu celular. No se guarda nada todavía.</small>
        </div>`
      :`<div class="titulo-s" style="margin-top:2px">Para que salga bien</div>
        <div class="cap-tips">
          <div class="cap-tip rise d1">${tipLuz}<b>Buena luz</b><small>Sin sombras sobre la hoja.</small></div>
          <div class="cap-tip rise d2">${tipPlana}<b>Hoja plana</b><small>Que se vea el lado derecho.</small></div>
          <div class="cap-tip rise d3">${tipDos}<b>Una hoja por foto</b><small>Dos hojas se leen por separado.</small></div>
          <div class="cap-tip rise d4">${tipVer}<b>Tú decides</b><small>Nada se guarda sin que lo veas.</small></div>
        </div>`}`;
  }

  function listaV(c){
    const s=c.s,st=stats(),v=vis();
    const pct=st.total?Math.round(st.g/st.total*100):0;
    return `
      <div class="cap-pend ${st.sin===0?'ok':''} rise">
        <div class="cap-pend-t">${I(st.sin?'warn':'check')}<span style="flex:1">${st.sin?`${st.sin} sin guardar`:'Todo guardado'}</span><button type="button" class="chip sm" style="min-height:36px;color:var(--ink)" data-act="salir">${I('x')}Salir</button></div>
        <div class="barra"><i style="width:${pct}%"></i></div>
        <small style="font-weight:800">${st.g} de ${st.total} guardadas</small>
      </div>
      ${s.salir?`<div class="aviso warn rise">${I('warn')}<div>Tienes ${st.sin} sin guardar. Si sales ahora se pierden.<div class="cap-conf-b"><button type="button" class="btn sm sec" data-act="seguir">Seguir aquí</button><button type="button" class="btn sm bad" data-close>Salir igual</button></div></div></div>`:''}
      <div>${v.map((x,k)=>{const b=getC(x.i),e=chipEst[x.it.est];return `<button type="button" class="cap-row rise d${Math.min(k+1,6)}" data-sheet="comanda-revisar" data-p='{"i":${x.i}}'>${thumb(x.i,x.it.est)}<span><b>${H(b.nombre||'Sin nombre')}</b><small>${b.desp?'Despacho '+b.desp+' · ':''}${x.i===0?'Ya cargado':'Pedido nuevo'}</small></span>${UI.pill(e[0],e[1],e[2])}</button>`}).join('')}</div>
      ${!v.length?`<div class="cap-vacio">${papel(90,100)}<b>No hay comandas en la lista</b></div>`:''}`;
  }

  /* =========================================================
     REVISAR UNA COMANDA
     ========================================================= */
  App.sheet('comanda-revisar',{
    titulo:c=>{const b=getC(+c.p.i||0);return b.nombre?H(b.nombre):'Comanda sin leer'},
    sub:c=>`Comanda ${(+c.p.i||0)+1} de ${CM.length}`,k:'comanda',full:true,
    render(c){
      const i=+c.p.i||0,s=c.s,b=getC(i),it=CAP.items[i]||{};
      if(!s.init){s.init=1;s.tab='pedido';s.modo='completar';s.ruta=4;s.dia='hoy';s.q=false;s.tarifa=b.tr!=null?'t'+b.tr:'';s.ubic=b.km!=null&&b.conf.dir!=='no'}
      const cuerpo=s.tab==='cliente'?clienteV(c,b,i):s.tab==='entrega'?entregaV(c,b,i):pedidoV(c,b,i);
      return `${UI.seg('tab',[['pedido','Pedido'],['cliente','Cliente'],['entrega','Entrega']],s.tab)}
        ${cuerpo}
        <div class="sep"></div>
        ${s.q?confirmar('¿Quitar esta comanda de la lista? Los pedidos ya guardados no se borran.','quitar','noquitar'):`<button type="button" class="btn bad" data-act="pedirquitar">${I('trash')}Quitar esta comanda</button>`}`;
    },
    pie(c){return `<div class="cap-pie-r" style="width:100%"><button type="button" class="btn sec" data-act="lista">${I('back')}Volver a la lista</button><button type="button" class="btn" data-act="guardar">${I('check')}Guardar y siguiente</button></div>`},
    acts:{
      modo(el,ev,c){c.s.modo=el.dataset.v},
      letra(el,ev,c){(c.s.f=c.s.f||{}).letra=el.dataset.v},
      ruta(el,ev,c){c.s.ruta=+el.dataset.v},
      dia(el,ev,c){c.s.dia=el.dataset.v},
      tarifa(el,ev,c){c.s.tarifa=el.dataset.v},
      ubicar(el,ev,c){c.s.ubic=true;c.s.pinNew=true;const b=getC(+c.p.i||0);if(b.tr!=null)c.s.tarifa='t'+b.tr;else if(!c.s.tarifa)c.s.tarifa='t0'},
      retomar(el,ev,c){App.openSheet('comandas',{retomar:+c.p.i||0});return false},
      pedirquitar(el,ev,c){c.s.q=true},
      noquitar(el,ev,c){c.s.q=false},
      quitar(el,ev,c){const i=+c.p.i||0;if(CAP.items[i])CAP.items[i].quitada=true;App.toast('Comanda quitada');App.openSheet('comandas');return false},
      lista(el,ev,c){App.openSheet('comandas');return false},
      guardar(el,ev,c){
        const i=+c.p.i||0,b=getC(i);
        if(b.conf.nombre==='no'&&!(c.s.f&&c.s.f.nombre)){App.toast('No se leyó: vuelve a tomarla o escribe el nombre','warn');return false}
        CAP.items[i].est='guardada';guardado('¡Comanda guardada!');
        const nx=CAP.items.map((it,k)=>({it,k})).find(x=>x.k!==i&&!x.it.quitada&&x.it.est!=='guardada');
        if(nx)App.openSheet('comanda-revisar',{i:nx.k});else App.openSheet('comandas');
        return false}
    },
    mount(h,c){
      const s=c.s;bind(h,s);
      const l=h.querySelector('input[data-f="letra"]'),d=h.querySelector('input[data-f="desp"]'),pv=h.querySelector('#capPrev');
      const upd=()=>{if(pv){const b=getC(+c.p.i||0);pv.innerHTML=H(fv(s,'desp',b.desp)||'—')+'<em>'+H(fv(s,'letra','b'))+'</em>'}};
      if(l)l.addEventListener('input',upd);if(d)d.addEventListener('input',upd);
      if(s.pinNew)s.pinNew=false;
      const kmEl=h.querySelector('#capKm');if(kmEl&&s.kmAnim){UI.count(kmEl,s.kmAnim,v=>v.toFixed(1)+' km');s.kmAnim=0}
    },
    cambios:['Pestañas Pedido · Cliente · Entrega: una cosa por vez en vez de un formulario largo','«Completar el que ya está» y «Es otro pedido» son dos botones grandes; el código nuevo se ve en vivo','Cada dato dice si se leyó bien (verde, ámbar, rojo) y lo rojo ofrece «Volver a tomarla»','Quitar pide confirmación ahí mismo, sin ventanas aparte']
  });

  function pedidoV(c,b,i){
    const s=c.s,desp=fv(s,'desp',b.desp),letra=fv(s,'letra','b');
    return `
      <div><span class="lbl">¿Qué hacemos con esta comanda?</span>
        <div class="cap-dos">
          <button type="button" class="cap-opc" data-act="modo" data-v="completar" aria-pressed="${s.modo==='completar'}"><span class="fg" style="background:var(--c-cantidad)">${I('check')}</span><b>Completar el que ya está</b><small>Le pone los datos a un pedido sin nombre</small></button>
          <button type="button" class="cap-opc" data-act="modo" data-v="otro" aria-pressed="${s.modo==='otro'}"><span class="fg" style="background:var(--c-mano)">${I('plus')}</span><b>Es otro pedido</b><small>Mismo despacho, otra entrega</small></button>
        </div></div>
      ${s.modo==='otro'?`<div class="cap-fld rise"><span class="lbl">Letra del pedido</span>
          <div style="display:flex;gap:8px;align-items:center"><input class="inp" style="width:90px;text-align:center" maxlength="2" data-f="letra" value="${H(letra)}" aria-label="Letra"><button type="button" class="chip sun" data-act="letra" data-v="b">${I('star')}b · sugerida</button></div>
          <div class="cap-prev"><small class="tiny">Así quedará el código</small><code id="capPrev">${H(desp||'—')}<em>${H(letra)}</em></code></div></div>`:''}
      <div class="cap-fld"><span class="lbl">Número de despacho</span><input class="inp mono" inputmode="numeric" data-f="desp" value="${H(desp)}" placeholder="7106635"></div>
      <div class="cap-fld"><span class="lbl">Ruta sugerida por el horario ${H(b.hora)}</span>
        <div class="chips"><span class="cap-ruta">${I('route')}Ruta 4 · ${H(b.hora)}</span></div>
        <div class="chips">${[1,2,3,4].map(n=>UI.chip('Ruta '+n,s.ruta===n,`data-act="ruta" data-v="${n}"`,n===4?'var(--c-comanda)':'')).join('')}</div></div>
      <div class="cap-fld"><span class="lbl">Día</span>
        <div class="chips">${[['hoy','Hoy'],['ayer','Ayer'],['ante','Anteayer']].map(([v,t])=>UI.chip(t,s.dia===v,`data-act="dia" data-v="${v}"`)).join('')}</div></div>`;
  }

  function campo(s,key,label,b,i){
    const cf=b.conf[key],val=fv(s,key,b[key]||'');
    const chip=cf==='ok'?UI.pill('Legible','ok','check'):cf==='dud'?UI.pill('Dudoso','warn','warn'):UI.pill('No se leyó','bad','x');
    return `<div class="cap-fld"><div class="cap-fld-h"><span class="lbl">${label}</span>${chip}</div>
      <input class="inp ${cf==='dud'?'dud':cf==='no'?'no':''}" data-f="${key}" value="${H(val)}" ${cf==='no'?'placeholder="Escríbelo"':''} ${key==='tel'?'inputmode="tel"':''}></div>`;
  }
  function clienteV(c,b,i){
    const s=c.s,algun=Object.values(b.conf).includes('no');
    return `${campo(s,'nombre','Nombre',b,i)}${campo(s,'tel','Teléfono',b,i)}${campo(s,'dir','Dirección',b,i)}
      ${algun?`<button type="button" class="btn sun" data-act="retomar">${I('camara')}Volver a tomarla</button>`:''}
      ${b.conf.tel==='dud'||b.conf.dir==='dud'?UI.aviso('Lo ámbar se ve dudoso en la foto. Revísalo antes de guardar.','warn'):''}`;
  }
  function entregaV(c,b,i){
    const s=c.s,hay=b.km!=null;
    if(s.ubic&&hay&&!s.kmShown){s.kmShown=1;s.kmAnim=b.km}
    return `<div class="cap-mapa">${mapaSvg(s.ubic&&hay,s.pinNew)}</div>
      <div class="cap-kmbox">${I('pin')}<div style="flex:1"><small class="tiny">${H(b.dir||'Sin dirección')}</small><b id="capKm">${s.ubic&&hay?b.km.toFixed(1)+' km':'— km'}</b></div><button type="button" class="btn sm" data-act="ubicar">${I('map')}${s.ubic&&hay?'Ubicar otra vez':'Ubicar la dirección'}</button></div>
      <div class="cap-fld"><span class="lbl">Tramo de distancia</span>
        <div class="cap-trs">${TR.map((t,k)=>`<button type="button" class="cap-tr" data-act="tarifa" data-v="t${k}" aria-pressed="${s.tarifa==='t'+k}"><b>Tramo ${k+1}</b><small>${t.n}</small><em>${sol(t.m)}</em></button>`).join('')}</div></div>
      <div class="cap-fld"><span class="lbl">O la zona de Aurora</span>
        <div class="cap-trs">${DATA.zonasAurora.map((z,k)=>`<button type="button" class="cap-tr" data-act="tarifa" data-v="z${k}" aria-pressed="${s.tarifa==='z'+k}"><b>${H(z.n)}</b><em>${sol(z.m)}</em></button>`).join('')}</div></div>`;
  }

  /* =========================================================
     ADICIONAL
     ========================================================= */
  const TIPOS=[{n:'Taxi',c:'var(--c-taxi)',claro:true,k:'taxi'},{n:'Expo Vino',c:'var(--c-adic)',zonas:true,k:'adic'},{n:'Movilidad',c:'var(--c-apoyo)',k:'apoyo'}];
  const EV=DATA.expoZonas.map(z=>[z[0],z[1]]);
  const banda=m=>m<=850?'var(--c-cantidad)':m<=900?'var(--c-apoyo)':m<=1050?'var(--c-buscar)':m<=1200?'var(--c-stats)':'var(--c-adic)';
  const bandas=[['Hasta 8.50','var(--c-cantidad)'],['9.00','var(--c-apoyo)'],['10.00 – 10.50','var(--c-buscar)'],['11.00 – 12.00','var(--c-stats)'],['Más de 12','var(--c-adic)']];
  const tipoDe=n=>TIPOS.find(t=>t.n===n)||TIPOS[1];
  function evTotales(s){const z=s.z||{};let n=0,m=0;Object.keys(z).forEach(k=>{n+=z[k];m+=z[k]*(EV[k]?EV[k][1]:0)});return {n,m}}
  function parseTabla(txt){
    const out=[];String(txt||'').split(/\r?\n/).forEach(l=>{const m=l.trim().match(/^(.*?)[\s:\-–\t]+(?:S\/\.?\s*)?(\d+(?:[.,]\d{1,2})?)\s*$/i);if(m&&m[1].trim())out.push([m[1].trim(),parseSol(m[2])])});return out}

  App.sheet('adicional',{
    titulo:c=>'Adicional · '+H((c.s.tipo||c.p.tipo||'Expo Vino')),sub:'Taxi, Expo Vino, movilidad…',k:'adicional',
    render(c){
      const s=c.s;
      if(!s.init){s.init=1;s.tipo=TIPOS.some(t=>t.n===c.p.tipo)?c.p.tipo:'Expo Vino';s.z={};s.hist=[];s.dia='Vie'}
      const t=tipoDe(s.tipo);
      const tipos=`<div><span class="lbl">Tipo de adicional</span><div class="cap-tipos">${TIPOS.map(x=>UI.chip(x.n,s.tipo===x.n,`data-act="tipo" data-v="${H(x.n)}"`,x.claro?'':x.c).replace('class="chip col"',x.claro?'class="chip sun"':'class="chip col"')).join('')}${UI.chip(I('plus')+'Nuevo tipo',s.nuevo,'data-act="nuevo"')}</div>
        ${s.nuevo?`<div class="cap-nuevo rise" style="margin-top:8px"><input class="inp" data-f="nuevoN" placeholder="Nombre del tipo" value="${H(fv(s,'nuevoN',''))}"><button type="button" class="btn sm" data-act="crear">Crear</button></div>`:''}</div>`;
      let cuerpo='';
      if(t.n==='Taxi')cuerpo=taxiV(c);else if(t.zonas)cuerpo=expoV(c);else cuerpo=movV(c);
      return tipos+cuerpo;
    },
    pie(c){const s=c.s,t=tipoDe(s.tipo||c.p.tipo||'Expo Vino');
      return `<button type="button" class="btn ${t.zonas?'ok':''}" ${t.n==='Taxi'?'style="background:var(--c-taxi);color:var(--sun-ink)"':''} data-act="guardar">${I('check')}${t.zonas?'Guardar reparto':'Guardar adicional'}</button>`},
    acts:{
      tipo(el,ev,c){c.s.tipo=el.dataset.v;c.s.prev=0},
      nuevo(el,ev,c){c.s.nuevo=!c.s.nuevo},
      crear(el,ev,c){const n=(fv(c.s,'nuevoN','')||'').trim();if(!n){App.toast('Escribe el nombre del tipo','warn');return false}
        if(!TIPOS.some(t=>t.n.toLowerCase()===n.toLowerCase()))TIPOS.push({n,c:'var(--c-licencia)',k:'adic'});
        const real=TIPOS.find(t=>t.n.toLowerCase()===n.toLowerCase());c.s.tipo=real.n;c.s.nuevo=false;if(c.s.f)c.s.f.nuevoN='';App.toast('Tipo «'+real.n+'» creado')},
      ini(el,ev,c){c.s.ini=hhmm()},
      fin(el,ev,c){if(!c.s.ini){App.toast('Primero marca el inicio','warn');return false}c.s.fin=hhmm();c.s.km=8.2;c.s.kmNew=true;(c.s.f=c.s.f||{}).monto='22.00'},
      reiniciar(el,ev,c){c.s.ini=c.s.fin=null;c.s.km=0},
      zona(el,ev,c){const k=+el.dataset.i;c.s.z[k]=(c.s.z[k]||0)+1;c.s.hist.push(k);c.s.last=k;c.s.bump=true},
      deshacer(el,ev,c){const k=c.s.hist.pop();if(k==null){App.toast('No hay nada que deshacer','warn');return false}c.s.z[k]=Math.max(0,(c.s.z[k]||1)-1);c.s.last=null},
      tarifas(el,ev,c){c.s.tar=!c.s.tar},
      cargar(el,ev,c){const l=parseTabla(fv(c.s,'pega',''));if(!l.length){App.toast('No encontré líneas como «Zona 8.50»','warn');return false}
        EV.length=0;l.forEach(x=>EV.push(x));c.s.z={};c.s.hist=[];c.s.prev=0;App.toast(l.length+' zonas cargadas')},
      guardar(el,ev,c){const t=tipoDe(c.s.tipo);
        if(t.zonas&&!evTotales(c.s).n){App.toast('Toca las zonas donde repartiste','warn');return false}
        if(t.n==='Taxi'&&!c.s.fin){App.toast('Marca el inicio y el fin de la carrera','warn');return false}
        guardado(t.zonas?'¡Reparto guardado!':'¡Adicional guardado!');App.closeSheet();return false}
    },
    mount(h,c){
      const s=c.s,t=tipoDe(s.tipo||c.p.tipo||'Expo Vino');
      recolor(h,t.c,t.claro);bind(h,s);
      if(t.zonas){const tt=evTotales(s);contar(h,s,'capEvTot',tt.m,v=>tt.n+' '+(tt.n===1?'pedido':'pedidos')+' · '+sol(v))}
      $$('input[data-evi]',h).forEach(e=>e.addEventListener('input',()=>{const k=+e.dataset.evi;if(EV[k])EV[k][1]=parseSol(e.value)}));
      const kmEl=h.querySelector('#capTaxKm');if(kmEl&&s.kmNew){s.kmNew=false;UI.count(kmEl,s.km,v=>v.toFixed(1)+' km')}
      s.bump=false;
    },
    cambios:['El tipo de adicional son chips de color; la hoja toma el color del tipo','Expo Vino: se toca la zona cada vez que repartes un pedido (sin teclear números); el total sube con animación','Taxi: dos botones, «Marcar inicio» y «Marcar fin», con estado visible','Las tarifas se pegan como tabla («Zona 8.50») y se corrigen fila por fila']
  });

  function taxiV(c){
    const s=c.s,live=s.ini&&!s.fin;
    return `<div class="cap-marca">
        <button type="button" class="cap-mk ${s.ini?'done':'go'} ${live?'':''}" data-act="ini" ${s.ini?'':''}><span class="fg">${s.ini?I('check'):I('pin')}</span><b>${s.ini?'Inicio marcado':'Marcar inicio'}</b><small>${s.ini?'a las '+s.ini:'Al subir el cliente'}</small></button>
        <button type="button" class="cap-mk ${s.fin?'done':'stop'} ${live?'cap-live':''}" data-act="fin" ${s.ini?'':'style="opacity:.55"'}><span class="fg">${s.fin?I('check'):I('flag')}</span><b>${s.fin?'Fin marcado':'Marcar fin'}</b><small>${s.fin?'a las '+s.fin:'Al bajar el cliente'}</small></button>
      </div>
      ${live?`<div class="cap-via">${CAR(40)}</div><p class="tiny" style="text-align:center">En carrera desde las ${s.ini}…</p>`:''}
      <div class="grid2"><div class="kpi"><b id="capTaxKm">${s.fin?s.km.toFixed(1)+' km':'— km'}</b><small>Recorrido</small></div>
        <div class="cap-fld"><span class="lbl">Monto (S/)</span><input class="inp" inputmode="decimal" data-f="monto" value="${H(fv(s,'monto',''))}" placeholder="0.00"></div></div>
      ${s.ini?`<button type="button" class="btn sec sm" style="width:auto;align-self:flex-start" data-act="reiniciar">${I('refresh')}Empezar de nuevo</button>`:''}`;
  }

  function expoV(c){
    const s=c.s,tt=evTotales(s);
    return `<div><span class="lbl">Zonas del reparto · toca una por cada pedido</span>
        <div class="cap-zonas">${EV.map((z,k)=>{const n=s.z[k]||0;return `<button type="button" class="cap-z" style="--zc:${banda(z[1])}" data-act="zona" data-i="${k}" data-n="${n}"><b>${H(z[0])}</b><small>${sol(z[1])}</small>${n?`<i class="cap-bad ${s.last===k&&s.bump?'pop':''}">${n}</i>`:''}</button>`}).join('')}</div></div>
      <div class="cap-leg">${bandas.map(b=>`<span><i style="background:${b[1]}"></i>${b[0]}</span>`).join('')}</div>
      <div class="cap-tot"><b id="capEvTot">${tt.n} pedidos · ${sol(tt.m)}</b><button type="button" class="btn sm sec" data-act="deshacer">${I('back')}Deshacer</button></div>
      <div><span class="lbl">¿Qué día fue?</span>${UI.seg('dia',[['Vie','Vie'],['Sáb','Sáb'],['Dom','Dom']],s.dia)}</div>
      <button type="button" class="btn sec" data-act="tarifas">${I('coins')}Tarifas de Expo Vino${I('chev')}</button>
      ${s.tar?`<div class="card rise" style="background:var(--surf2);display:flex;flex-direction:column;gap:10px">
          <span class="lbl" style="margin:0">Pega la tabla (una zona por línea)</span>
          <textarea class="inp" data-f="pega" placeholder="Miraflores 8.50&#10;San Borja 8.50&#10;Ate 11.00">${H(fv(s,'pega',''))}</textarea>
          <button type="button" class="btn" data-act="cargar">${I('download')}Cargar la lista</button>
          <div class="sep"></div>
          ${EV.map((z,k)=>`<div class="cap-evr"><span>${H(z[0])}</span><input class="inp" inputmode="decimal" data-evi="${k}" value="${(z[1]/100).toFixed(2)}" aria-label="Tarifa de ${H(z[0])}"></div>`).join('')}
        </div>`:''}`;
  }

  function movV(c){
    const s=c.s;
    return `<div class="cap-fld"><span class="lbl">Monto (S/)</span><input class="inp" inputmode="decimal" data-f="monto" value="${H(fv(s,'monto',''))}" placeholder="0.00"></div>
      <div class="cap-fld"><span class="lbl">¿De qué fue?</span><input class="inp" data-f="desc" value="${H(fv(s,'desc',''))}" placeholder="Pasaje a la tienda"></div>
      <div class="chips">${['Pasaje','Peaje','Estacionamiento','Gasolina'].map(x=>`<button type="button" class="chip" data-act="desc" data-v="${x}">${x}</button>`).join('')}</div>`;
  }
  /* los chips de motivo rápido de Movilidad */
  App.sheets.adicional.acts.desc=(el,ev,c)=>{(c.s.f=c.s.f||{}).desc=el.dataset.v};

  /* =========================================================
     APOYO
     ========================================================= */
  App.sheet('apoyo',{
    titulo:'Apoyo a otra tienda',sub:'Cubrí a otra tienda',k:'apoyo',
    render(c){
      const s=c.s;
      if(!s.init){s.init=1;s.modo='hora';s.tienda='Wong - Limatambo';s.ent=840;s.sal=1080;s.tarifa=18;s.tr=[{t:0,km:2.1},{t:1,km:4.8}]}
      const tiendas=`<div><span class="lbl">¿A qué tienda apoyaste?</span><div class="chips">${DATA.tiendas.map(t=>UI.chip(I('store')+H(t),s.tienda===t,`data-act="tienda" data-v="${H(t)}"`)).join('')}</div></div>`;
      const modo=`<div class="cap-modo"><button type="button" class="cap-md" data-act="modo" data-v="hora" aria-pressed="${s.modo==='hora'}">${I('clock')}Por hora</button><button type="button" class="cap-md" data-act="modo" data-v="tramos" aria-pressed="${s.modo==='tramos'}">${I('route')}Por tramos</button></div>`;
      return modo+tiendas+(s.modo==='hora'?horaV(s):tramosV(s));
    },
    pie(c){return `<button type="button" class="btn" style="background:var(--c-apoyo)" data-act="guardar">${I('check')}Guardar apoyo</button>`},
    acts:{
      modo(el,ev,c){c.s.modo=el.dataset.v;c.s.prev=0},
      tienda(el,ev,c){c.s.tienda=el.dataset.v},
      ent(el,ev,c){c.s.ent=(c.s.ent+(+el.dataset.d)*30+1440)%1440},
      sal(el,ev,c){c.s.sal=(c.s.sal+(+el.dataset.d)*30+1440)%1440},
      tarifa(el,ev,c){c.s.tarifa=Math.max(0,c.s.tarifa+(+el.dataset.d))},
      motivo(el,ev,c){(c.s.f=c.s.f||{}).motivo=el.dataset.v},
      cicla(el,ev,c){const r=c.s.tr[+el.dataset.i];r.t=(r.t+1)%TR.length},
      km(el,ev,c){const r=c.s.tr[+el.dataset.i];r.km=Math.max(0,Math.round((r.km+(+el.dataset.d)*0.5)*10)/10)},
      quitar(el,ev,c){c.s.tr.splice(+el.dataset.i,1)},
      anadir(el,ev,c){if(c.s.tr.length>=8){App.toast('Ya son muchos pedidos en esta lista','warn');return false}c.s.tr.push({t:0,km:1.5});c.s.nuevoP=c.s.tr.length-1},
      guardar(el,ev,c){if(total(c.s)<=0){App.toast('Todavía no hay nada que sumar','warn');return false}guardado('¡Apoyo guardado!');App.closeSheet();return false}
    },
    mount(h,c){const s=c.s;recolor(h,'var(--c-apoyo)',false);bind(h,s);contar(h,s,'capApTot',total(s),sol);s.nuevoP=null},
    cambios:['«Por hora» y «Por tramos» son dos botones turquesa grandes, no un texto que alterna','Entrada y salida con botones + y − de media hora; las horas se calculan solas','El importe final aparece grande y se anima al cambiar','En tramos, tocar el tramo lo cambia y los km se ajustan con + y −']
  });
  function dur(s){return ((s.sal-s.ent)+1440)%1440||0}
  function total(s){return s.modo==='hora'?Math.round(dur(s)/60*s.tarifa*100):s.tr.reduce((a,r)=>a+TR[r.t].m,0)}
  function horaV(s){
    const bt=(k,v)=>`<div class="bt"><button type="button" data-act="${k}" data-d="-1" aria-label="Media hora menos">−</button><button type="button" data-act="${k}" data-d="1" aria-label="Media hora más">+</button></div>`;
    return `<div class="cap-hr"><div><span class="lbl" style="margin:0">Entrada</span><output>${mins(s.ent)}</output>${bt('ent')}</div><div><span class="lbl" style="margin:0">Salida</span><output>${mins(s.sal)}</output>${bt('sal')}</div></div>
      <div class="aviso">${I('clock')}<div><b>${horasTxt(dur(s))}</b> en esa tienda</div></div>
      <div><span class="lbl">Tarifa por hora</span><div class="stepper"><button type="button" data-act="tarifa" data-d="-1" aria-label="Menos">−</button><output>${s.tarifa.toFixed(2)}</output><button type="button" data-act="tarifa" data-d="1" aria-label="Más">+</button></div></div>
      <div class="cap-fld"><span class="lbl">Motivo</span><input class="inp" data-f="motivo" value="${H(fv(s,'motivo','Cubrí el turno de la tarde'))}"><div class="chips">${['Cubrí el turno','Campaña','Reemplazo'].map(x=>`<button type="button" class="chip" data-act="motivo" data-v="${x}">${x}</button>`).join('')}</div></div>
      <div class="cap-res"><small>Te corresponde</small><b id="capApTot">${sol(total(s))}</b><small>${horasTxt(dur(s))} × S/ ${s.tarifa.toFixed(2)}</small></div>`;
  }
  function tramosV(s){
    return `<div><span class="lbl">Pedidos cubiertos · toca el tramo para cambiarlo</span>
        ${s.tr.map((r,k)=>`<div class="cap-ped ${s.nuevoP===k?'rise':''}"><span class="n">${k+1}</span><button type="button" class="tr" data-act="cicla" data-i="${k}"><span>${TR[r.t].n}</span><b>${sol(TR[r.t].m)}</b></button><div class="cap-km"><button type="button" data-act="km" data-i="${k}" data-d="-1" aria-label="Menos km">−</button><output>${r.km.toFixed(1)} km</output><button type="button" data-act="km" data-i="${k}" data-d="1" aria-label="Más km">+</button></div><button type="button" class="xx" data-act="quitar" data-i="${k}" aria-label="Quitar pedido">${I('x')}</button></div>`).join('')}
        ${!s.tr.length?'<p class="tiny">Añade los pedidos que cubriste.</p>':''}</div>
      <button type="button" class="btn sec" data-act="anadir">${I('plus')}Añadir un pedido</button>
      <div class="cap-res"><small>Total de ${s.tr.length} ${s.tr.length===1?'pedido':'pedidos'}</small><b id="capApTot">${sol(total(s))}</b></div>`;
  }

  /* =========================================================
     DETALLE DE UN BLOQUE
     ========================================================= */
  App.sheet('detalle-bloque',{
    titulo:c=>(+c.p.i>=0&&c.p.tipo==='apoyo')?'Apoyo a otra tienda':H(((DATA.adicionales[+c.p.i||0]||{}).tipo)||'Adicional'),
    sub:'Un registro del día',k:'adicional',
    render(c){
      const s=c.s,ap=c.p.tipo==='apoyo',i=+c.p.i||0;
      const r=ap?(DATA.apoyos[i]||DATA.apoyos[0]):(DATA.adicionales[i]||DATA.adicionales[0]);
      const t=ap?{c:'var(--c-apoyo)'}:tipoDe(r.tipo);
      const filas=ap?[['store','Tienda',r.tienda],['clock','Cómo se paga',r.det],['cal','Día','Jueves 29 de octubre']]:[['adic','Tipo',r.tipo],['list','Detalle',r.det],['cal','Día','Jueves 29 de octubre']];
      return `<div class="cap-monto rise ${t.claro?'claro':''}" style="--adc:${t.c}"><small>${ap?'Apoyo':'Adicional'}</small><b>${sol(r.m)}</b><small>${H(ap?r.tienda:r.tipo)}</small></div>
        <div>${filas.map(f=>`<div class="cap-dato">${I(f[0]==='adic'?'adic':f[0])}<span>${f[1]}</span><b>${H(f[2])}</b></div>`).join('')}</div>
        <button type="button" class="btn" style="background:${ap?'var(--c-apoyo)':'var(--acc)'}" data-act="corregir">${I('edit')}Corregir</button>
        ${s.q?confirmar('¿Quitar este registro? Ya no se sumará al día.','quitar','noquitar'):`<button type="button" class="btn bad" data-act="pedirq">${I('trash')}Quitar</button>`}`;
    },
    acts:{
      corregir(el,ev,c){const ap=c.p.tipo==='apoyo',r=ap?null:(DATA.adicionales[+c.p.i||0]||DATA.adicionales[0]);if(ap)App.openSheet('apoyo');else App.openSheet('adicional',{tipo:r.tipo});return false},
      pedirq(el,ev,c){c.s.q=true},noquitar(el,ev,c){c.s.q=false},
      quitar(el,ev,c){App.toast('Registro quitado');App.closeSheet();return false}
    },
    mount(h,c){
      const ap=c.p.tipo==='apoyo',r=ap?null:(DATA.adicionales[+c.p.i||0]||DATA.adicionales[0]);
      if(ap)recolor(h,'var(--c-apoyo)',false);else{const t=tipoDe(r.tipo);recolor(h,t.c,t.claro)}
    },
    cambios:['El monto va en una tarjeta grande de color; los datos, en filas con figura','Corregir y Quitar son botones; Quitar confirma en la misma hoja']
  });

  /* =========================================================
     CARGANDO
     ========================================================= */
  App.sheet('cargando',{
    titulo:'Cargando',sub:'Un momento',color:'var(--acc)',icono:'cargar',
    render(c){
      const p=Math.round(c.s.prog||0);
      return `<div class="cap-sim rise">
          <svg viewBox="0 0 190 100" aria-hidden="true"><rect x="22" y="30" width="46" height="58" rx="6" fill="#fff" stroke="#c3cde8" stroke-width="2" class="cap-orb"/><rect x="72" y="22" width="46" height="62" rx="6" fill="#fff" stroke="#c3cde8" stroke-width="2" class="cap-orb b"/><rect x="122" y="30" width="46" height="58" rx="6" fill="#fff" stroke="#c3cde8" stroke-width="2" class="cap-orb c"/><path d="M30 46h28M30 56h20M80 38h28M80 48h22M130 46h28M130 56h20" stroke="#c3cde8" stroke-width="4" stroke-linecap="round"/></svg>
          <h2 id="capTit" style="font-size:22px">${p<45?'Preparando las fotos':'Leyendo capturas'}</h2>
        </div>
        <div class="cap-ruta-c"><span class="carro-w">${CAR(44)}</span></div>
        <div class="barra"><i id="capProg" style="width:${p}%;background:var(--acc)"></i></div>
        <div class="cap-pct"><span id="capSub">${p<45?'Paso 1 de 2':'Paso 2 de 2'}</span><span id="capPct">${p}%</span></div>
        ${UI.aviso('Las fotos se leen aquí mismo en tu celular.','','shield')}`;
    },
    mount(h,c){
      const s=c.s,car=h.querySelector('.cap-ruta-c .carro');
      const pos=()=>{if(car){const w=car.parentElement.clientWidth||300;car.style.left=Math.max(4,(w-60)*(s.prog||0)/100)+'px'}};
      pos();
      if(!s.timer){
        s.timer=setInterval(()=>{
          if(App.sheetCtx!==c){clearInterval(s.timer);return}
          s.prog=Math.min(100,(s.prog||0)+4+Math.random()*4);
          const p=Math.round(s.prog),g=id=>document.getElementById(id);
          if(g('capProg'))g('capProg').style.width=p+'%';if(g('capPct'))g('capPct').textContent=p+'%';
          if(g('capTit'))g('capTit').textContent=p<45?'Preparando las fotos':'Leyendo capturas';
          if(g('capSub'))g('capSub').textContent=p<45?'Paso 1 de 2':'Paso 2 de 2';
          const cr=document.querySelector('#hoja .cap-ruta-c .carro');if(cr){const w=cr.parentElement.clientWidth||300;cr.style.left=Math.max(4,(w-60)*p/100)+'px'}
          if(s.prog>=100){clearInterval(s.timer);setTimeout(()=>{if(App.sheetCtx===c){App.go('revision',{});App.toast('¡Listo para revisar!')}},350)}
        },110);
      }
    },
    cambios:['Un carrito avanza por la ruta mientras se leen las fotos: se ve que algo pasa','Dos pasos con nombre claro y un porcentaje, en vez de una rueda sin fin','Al terminar, pasa solo a la revisión']
  });

  /* =========================================================
     REVISIÓN
     ========================================================= */
  const REV={tr:[1,1,1,3,1,1,2,1,1,1],ord:false};
  const trNom=t=>t>5?'Más de 12 km':TR[t-1].n, trMonto=t=>t>5?1800:TR[t-1].m;
  function revPedidos(){return DATA.pedidos.map((p,i)=>Object.assign({i},p,{t:REV.tr[i]||1}))}

  App.screen('revision',{
    titulo:'Revisión',icono:'doc',tab:null,grupo:'Captura',
    render(c){
      const s=c.s;s.ab=s.ab||{};
      if(c.p.vacio)return `<div class="cap-vacio rise"><svg viewBox="0 0 150 110" aria-hidden="true"><rect x="40" y="14" width="70" height="86" rx="8" fill="var(--surf)" stroke="var(--line)" stroke-width="3"/><path d="M54 40h42M54 54h30M54 68h38" stroke="var(--line)" stroke-width="5" stroke-linecap="round"/><circle cx="108" cy="84" r="16" fill="var(--c-comanda)"/><path d="M101 84h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg><h2>No hay ninguna carga en revisión</h2><p class="muted">Cuando leas capturas, aparecerán aquí para que las confirmes.</p><button type="button" class="btn" data-go="inicio">${I('home')}Ir a Hoy</button></div>`;
      const peds=revPedidos(),fuera=peds.filter(p=>p.t>1).length;
      const rutas=(REV.ord?DATA.rutas:[DATA.rutas[2],DATA.rutas[0],DATA.rutas[1]]);
      return `<div class="rise">
        ${UI.aviso('Se combinaron 2 capturas: Rutas y Órdenes.','','info')}
        <div style="height:8px"></div>${UI.aviso('1 foto se descartó porque estaba repetida.','warn')}
        <div style="height:8px"></div>${UI.aviso('Los totales cuadran con la empresa.','ok')}</div>
      <div class="cap-fecha rise d1" style="margin-top:12px">${I('cal')}<div style="flex:1"><small>Jornada</small><b>${H(DATA.hoy.larga)}</b></div><button type="button" class="chip sun" style="min-height:38px" data-toast="Aquí eliges otro día">${I('edit')}Cambiar</button></div>
      <div class="cap-kpis rise d2" style="margin:12px 0">${UI.kpi(peds.length,'Pedidos')}${UI.kpi(DATA.rutas.length,'Rutas')}${UI.kpi(fuera,'Fuera del tramo 1',fuera?'warn':'ok')}</div>
      ${UI.ac({id:'perm',t:'Permanencia en tienda',s:'08:00 – 17:30 · 9 h 30 min',c:'var(--c-apoyo)',i:'clock',open:!!s.ab.perm,body:`
        <div class="cap-fila-sw"><span>Contar permanencia como garantía</span>${UI.sw(s.perm!==false,'data-sw')}</div>
        <div class="cap-dato">${I('clock')}<span>Entrada</span><b>08:00</b></div><div class="cap-dato">${I('clock')}<span>Salida</span><b>17:30</b></div>`})}
      ${UI.ac({id:'rutas',t:'Rutas del día',s:DATA.rutas.length+' rutas',c:'var(--acc)',i:'route',open:!!s.ab.rutas,body:`
        <div>${rutas.map(r=>`<div class="cap-rt ${REV.ord?'':''}"><span class="n">${r.n}</span><div><b>Ruta ${r.n} · ${r.h}</b><small>hasta ${r.fin} · ${r.pedidos} pedidos</small></div></div>`).join('')}</div>
        <button type="button" class="btn sec" data-act="ordenar">${I('refresh')}Reordenar por hora</button>`})}
      ${UI.ac({id:'peds',t:'Pedidos',s:'Toca solo los que pasaron de 3 km',c:'var(--c-comanda)',i:'list',der:peds.length,open:s.ab.peds!==false,body:`
        <div>${peds.map(p=>UI.fila({t:p.c.indexOf('pendiente')===0?'Pedido sin código':p.c,s:'Ruta '+(p.r||'—')+' · '+trNom(p.t),c:p.t>1?'var(--c-mano)':'var(--c-cantidad)',i:p.t>1?'warn':'check',der:sol(trMonto(p.t)),a:`data-sheet="revision-pedido" data-p='{"i":${p.i}}'`})).join('')}</div>`})}
      <div style="height:14px"></div>
      <button type="button" class="btn ok rise d3" data-act="confirmar">${I('check')}Confirmar y guardar</button>`;
    },
    acts:{
      ordenar(el,ev,c){REV.ord=true;App.toast('¡Rutas en orden por hora!')},
      confirmar(el,ev,c){guardado('¡Carga guardada!');App.go('inicio');return false}
    },
    mount(el,c){memAc(el,c.s);const sw=$$('.sw',el)[0];if(sw)sw.addEventListener('click',()=>{c.s.perm=sw.getAttribute('aria-checked')==='true'})},
    cambios:['Lo importante arriba: avisos, día y 3 cifras; el detalle queda en acordeones de color','Solo se tocan los pedidos que pasaron de 3 km, con botones de tramo y su S/','Un único botón verde al final: Confirmar y guardar','Si no hay carga, un dibujo y un botón para volver a Hoy']
  });

  App.sheet('revision-pedido',{
    titulo:c=>{const p=DATA.pedidos[+c.p.i||0];return p&&p.c.indexOf('pendiente')!==0?H(p.c):'Pedido sin código'},
    sub:'¿Hasta dónde fue?',k:'comanda',
    render(c){
      const i=+c.p.i||0,s=c.s;if(s.sel==null)s.sel=REV.tr[i]||1;
      return `<div class="cap-trs">${TR.map((t,k)=>`<button type="button" class="cap-tr" data-act="tr" data-v="${k+1}" aria-pressed="${s.sel===k+1}"><b>Tramo ${k+1}</b><small>${t.n}</small><em>${sol(t.m)}</em></button>`).join('')}
          <button type="button" class="cap-tr" data-act="tr" data-v="6" aria-pressed="${s.sel===6}"><b>Más de 12 km</b><small>Monto aparte</small><em>${sol(1800)}</em></button></div>
        ${s.sel===6?`<div class="cap-fld rise"><span class="lbl">Kilómetros exactos</span><input class="inp" inputmode="decimal" data-f="km" value="${H(fv(s,'km','13.5'))}"></div>`:''}
        ${s.q?confirmar('¿Borrar este pedido de la carga?','borrar','noborrar'):`<button type="button" class="btn bad" data-act="pedirb">${I('trash')}Borrar este pedido</button>`}`;
    },
    pie(c){return `<button type="button" class="btn ok" data-act="listo">${I('check')}Listo</button>`},
    acts:{
      tr(el,ev,c){c.s.sel=+el.dataset.v},
      pedirb(el,ev,c){c.s.q=true},noborrar(el,ev,c){c.s.q=false},
      borrar(el,ev,c){App.toast('Pedido borrado de la carga');App.closeSheet();App.draw(false);return false},
      listo(el,ev,c){REV.tr[+c.p.i||0]=c.s.sel||1;App.toast('Tramo cambiado');App.closeSheet();App.draw(false);return false}
    },
    mount(h,c){bind(h,c.s)},
    cambios:['Tramos 1 a 5 y «Más de 12 km» como botones con su precio, no una lista de opciones','Borrar pide confirmar ahí mismo']
  });

  /* =========================================================
     COMPARTIR (llegan capturas desde la galería)
     ========================================================= */
  App.screen('compartir',{
    titulo:'Compartir',icono:'share',tab:null,grupo:'Captura',
    render(c){
      const s=c.s;
      if(s.vPrev!==s.v||!s.seen||Date.now()-s.seen>4000){s.fase='busca';s.vPrev=s.v}
      if(!s.v)s.v=c.p.nada?'nada':'ok';
      s.vPrev=s.v;
      const sel=`<div style="margin-top:18px"><small class="tiny" style="display:block;text-align:center;margin-bottom:6px">Ver ejemplo</small>${UI.seg('v',[['ok','Llegaron'],['nada','No llegó nada']],s.v)}</div>`;
      if(s.fase==='busca')return `<div class="cap-sim rise"><svg viewBox="0 0 190 120" aria-hidden="true"><rect x="62" y="64" width="66" height="44" rx="10" fill="var(--acc)"/><path d="M62 74l33 18 33-18" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>${[0,1,2].map(k=>`<rect class="cap-fly" style="animation-delay:${k*.5}s" x="${46+k*38}" y="10" width="26" height="34" rx="4" fill="#fff" stroke="#c3cde8" stroke-width="2"/>`).join('')}</svg><h2 style="font-size:22px">Recogiendo las capturas…</h2><div class="barra" style="width:200px"><i style="width:100%;background:var(--c-foto);animation:rise 2s both"></i></div></div>${sel}`;
      if(s.v==='nada')return `<div class="cap-vacio rise"><svg viewBox="0 0 150 110" aria-hidden="true"><rect x="30" y="26" width="90" height="62" rx="10" fill="var(--surf)" stroke="var(--line)" stroke-width="3"/><path d="M30 40l45 28 45-28" fill="none" stroke="var(--line)" stroke-width="3"/><circle cx="116" cy="84" r="17" fill="var(--bad)"/><path d="M110 78l12 12M122 78l-12 12" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg><h2>No llegó ninguna captura</h2><p class="muted">Vuelve a compartirlas desde la galería.</p><button type="button" class="btn" data-act="irhoy">${I('home')}Ir a Hoy</button></div>${sel}`;
      return `<div class="cap-vacio rise"><svg viewBox="0 0 150 110" aria-hidden="true"><circle cx="75" cy="52" r="40" fill="var(--ok)"/><path d="M56 52l14 14 25-28" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" class="cap-ruta-l" style="stroke-dasharray:90;stroke-dashoffset:90;animation-duration:.7s"/></svg><h2>¡Llegaron 3 capturas!</h2><div class="chips" style="justify-content:center">${UI.pill('2 de Órdenes','acc','foto')}${UI.pill('1 de Rutas','acc','route')}</div><button type="button" class="btn ok" data-act="arev">${I('eye')}Revisar lo que se leyó</button></div>${sel}`;
    },
    acts:{
      arev(el,ev,c){c.s.seen=0;App.openSheet('cargando');return false},
      irhoy(el,ev,c){c.s.seen=0;App.go('inicio');return false}
    },
    mount(el,c){
      const s=c.s;s.seen=Date.now();
      if(s.fase==='busca'&&!s.timer){
        s.timer=setTimeout(()=>{s.timer=0;s.fase='listo';const cu=App.cur();if(cu&&cu.id==='compartir'){App.draw(false)}},2300);
      }
    },
    cambios:['Mientras recoge las capturas se ve un sobre y fotos que caen: se entiende que está trabajando','Si no llegó nada, un dibujo claro y un solo botón para volver a Hoy','Si llegaron, un botón grande lleva a revisar']
  });
})();
