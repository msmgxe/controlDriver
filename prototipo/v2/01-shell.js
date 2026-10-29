/* =====================================================================
   ARMAZÓN COMÚN del prototipo v2. Todas las pantallas lo usan.
   Globales: App, UI, I, DATA, fmt, ACC. Los módulos de pantallas se
   añaden DESPUÉS de este archivo y solo registran pantallas/hojas.
   ===================================================================== */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const reducir=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- formato ---------- */
const fmt={
  sol:(c)=>'S/ '+(c/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),
  n:(x)=>String(Math.round(x))
};

/* ---------- iconos (trazo, 24x24) ---------- */
const ICONS={
  home:'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  cargar:'M12 16V4M7 9l5-5 5 5M4 20h16',
  wallet:'M3 8a3 3 0 013-3h12a2 2 0 012 2v12a2 2 0 01-2 2H6a3 3 0 01-3-3zM3 9h17M16 14h2',
  bars:'M5 20V12M12 20V5M19 20v-5',
  dots:'M5 12h.01M12 12h.01M19 12h.01',
  comanda:'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  cantidad:'M9 4L7 20M17 4l-2 16M4 9h16M3 15h16',
  mano:'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4',
  foto:'M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 18l5-5 4 4 3-3 4 4',
  adic:'M9 3h6M10 3v5c0 2-3 3-3 6v5a2 2 0 002 2h6a2 2 0 002-2v-5c0-3-3-4-3-6V3M7 14h10',
  apoyo:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  taxi:'M3 15l2-6c.3-1 1.2-1.6 2.2-1.6h9.6c1 0 1.9.6 2.2 1.6l2 6v4h-2v-1.5H5V19H3zM9 5h6M5 15h14',
  camara:'M4 8h3l2-3h6l2 3h3v11H4zM12 11.5a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z',
  pin:'M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21zM12 7.5a2 2 0 100 4 2 2 0 000-4z',
  check:'M5 12.5l4.5 4.5L19 7.5',
  x:'M6 6l12 12M18 6L6 18',
  back:'M15 5l-7 7 7 7',
  fwd:'M9 5l7 7-7 7',
  chev:'M6 9l6 6 6-6',
  plus:'M12 5v14M5 12h14',
  minus:'M5 12h14',
  search:'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  cal:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  moon:'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  clock:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  user:'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  phone:'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z',
  lock:'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3M12 15v2',
  shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  gear:'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2l.4 2.7h4l.4-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  book:'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 21V5M8 7h7',
  info:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.01',
  trash:'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  edit:'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4',
  map:'M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  route:'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h6a3 3 0 000-6h-4a3 3 0 010-6h6',
  fire:'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z',
  flag:'M5 21V4M5 4h11l-2 4 2 4H5',
  warn:'M12 3l10 18H2zM12 10v5M12 18v.01',
  wifioff:'M3 3l18 18M8.5 8.8A10 10 0 003 13M12 18.5v.01M7 14a7 7 0 013-1.7M16 14a7 7 0 00-2-1.4M21 13a10 10 0 00-8.5-5.3',
  download:'M12 4v12M7 11l5 5 5-5M4 20h16',
  share:'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  copy:'M9 9h11v11H9zM5 15V5h10',
  key:'M14 10a4 4 0 11-2 3.4L4 21v-3H2v-3h3v-2l4-4',
  finger:'M6 11a6 6 0 0112 0v2M9 21c0-4 0-6 3-6s3 2 3 6M12 11v4M4 14v-3M20 12v3M7 20c0-3 .5-5 2-6',
  bell:'M6 17h12l-1.5-2V10a4.5 4.5 0 00-9 0v5zM10 20h4',
  palette:'M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-6-4-11-8-11zM8 11h.01M11 7.5h.01M15.5 8.5h.01',
  store:'M4 9l1-5h14l1 5M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M10 20v-6h4v6',
  car:'M4 16l2-6c.3-1 1.2-1.6 2.2-1.6h7.6c1 0 1.9.6 2.2 1.6l2 6v3h-2v-1H6v1H4zM4 16h16',
  bike:'M6 19a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18 19a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM6 15.5l4-7h5l3 7M10 8.5L8.5 6H7M13 5h3',
  star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1-4.4-4.3 6.1-.9z',
  filter:'M4 5h16l-6 8v6l-4-2v-4z',
  doc:'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  send:'M4 12l16-8-6 16-3-7z',
  history:'M4 12a8 8 0 108-8 8 8 0 00-6 2.7M4 5v4h4M12 8v4l3 2',
  refresh:'M20 11a8 8 0 00-14-4M4 5v4h4M4 13a8 8 0 0014 4M20 19v-4h-4',
  list:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  hash:'M9 4L7 20M17 4l-2 16M4 9h16M3 15h16',
  bolt:'M13 3L5 14h6l-1 7 8-11h-6z',
  gift:'M4 11h16v9H4zM3 8h18v3H3zM12 8v12M12 8c-3 0-5-1-4-3s4 0 4 3zm0 0c3 0 5-1 4-3s-4 0-4 3z',
  coins:'M12 5c4 0 7 1 7 2.5S16 10 12 10 5 9 5 7.5 8 5 12 5zM5 7.5v4C5 13 8 14 12 14s7-1 7-2.5v-4M5 11.5v4C5 17 8 18 12 18s7-1 7-2.5v-4',
  bag:'M5 8h14l-1 12H6zM9 8a3 3 0 016 0',
  dna:'M12 3v18M5 7h14M5 12h14M5 17h14',
  nube:'M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.5A3.3 3.3 0 0117 18z'
};
function I(n,cls=''){return `<svg class="ic ${cls}" aria-hidden="true" viewBox="0 0 24 24"><path d="${ICONS[n]||ICONS.info}"/></svg>`}
const CAR=(w=46)=>`<svg class="carro" width="${w}" height="${Math.round(w*0.65)}" viewBox="0 0 46 30" aria-hidden="true"><path d="M5 20l3-9c.6-1.8 2.3-3 4.2-3h21.6c1.9 0 3.6 1.2 4.2 3l3 9v6c0 1-.8 2-2 2h-3v-3H10v3H7c-1.2 0-2-1-2-2z" fill="#ffc800"/><path d="M5 20l3-9c.6-1.8 2.3-3 4.2-3h21.6c1.9 0 3.6 1.2 4.2 3l3 9M5 20h36" fill="none" stroke="#0a2260" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="22" r="3" fill="#0a2260"/><circle cx="34" cy="22" r="3" fill="#0a2260"/></svg>`;

/* ---------- el lenguaje de color: una acción = un color + una figura ---------- */
const ACC={
  comanda:{n:'Leer una comanda',s:'Foto de la hoja',c:'var(--c-comanda)',i:'comanda'},
  cantidad:{n:'Cuántos hice',s:'Solo la cantidad',c:'var(--c-cantidad)',i:'cantidad'},
  mano:{n:'A mano',s:'Escribo el código',c:'var(--c-mano)',i:'mano'},
  foto:{n:'Lista de fotos',s:'Capturas de Órdenes',c:'var(--c-foto)',i:'foto'},
  adicional:{n:'Adicional',s:'Taxi, Expo Vino…',c:'var(--c-adic)',i:'adic'},
  taxi:{n:'Taxi',s:'Una carrera',c:'var(--c-taxi)',i:'taxi',claro:true},
  apoyo:{n:'Apoyo a otra tienda',s:'Cubrí otra tienda',c:'var(--c-apoyo)',i:'apoyo'},
  tienda:{n:'Pedidos de mi tienda',s:'Los de siempre',c:'var(--acc)',i:'store'},
  pagos:{n:'Pagos',s:'',c:'var(--c-pagos)',i:'wallet'}, stats:{n:'Estadísticas',s:'',c:'var(--c-stats)',i:'bars'},
  buscar:{n:'Buscar',s:'',c:'var(--c-buscar)',i:'search'}, historial:{n:'Historial',s:'',c:'var(--c-historial)',i:'history'},
  ajustes:{n:'Ajustes',s:'',c:'var(--c-ajustes)',i:'gear'}, aprender:{n:'Tutoriales',s:'',c:'var(--c-aprender)',i:'book'},
  licencia:{n:'Licencia',s:'',c:'var(--c-licencia)',i:'key'}
};

/* ---------- datos de ejemplo compartidos ---------- */
const DATA={
  usuario:'Marco',
  hoy:{larga:'Jueves 29 de octubre',semana:'Sem. 26 oct – 1 nov',dias:[
    {d:'L',n:26,e:'cargado'},{d:'M',n:27,e:'cargado'},{d:'M',n:28,e:'descanso'},{d:'J',n:29,e:'hoy'},{d:'V',n:30,e:'futuro'},{d:'S',n:31,e:'futuro'},{d:'D',n:1,e:'futuro'}]},
  tienda:'Wong Aurora',
  rutas:[{n:1,h:'08:15',fin:'10:40',pedidos:4,estado:'Finalizado'},{n:2,h:'11:00',fin:'12:50',pedidos:3,estado:'Finalizado'},{n:3,h:'14:10',fin:'16:05',pedidos:3,estado:'Finalizado'}],
  /* estado: E=Entregado, P=Entrega parcial, N=No entregado */
  pedidos:[
    {c:'v12341686wofp-01',r:1,e:'E',z:'Miraflores',m:950,cli:'Claudia Castro',foto:true},
    {c:'v12342501wofp-01',r:1,e:'E',z:'Surquillo',m:950,cli:'Milagros Valdivia',foto:true},
    {c:'v12343471wofp-01',r:1,e:'E',z:'Santiago de Surco',m:950,cli:null,foto:false},
    {c:'v12343131wofp-01',r:1,e:'P',z:'Chorrillos',m:1300,cli:'Elsa Tizón',foto:true},
    {c:'v12341688wofp-01',r:2,e:'E',z:'Miraflores',m:950,cli:null,foto:false},
    {c:'v12343554wofp-01',r:2,e:'E',z:'Surquillo',m:950,cli:'Luis Paredes',foto:false},
    {c:'v12343600wofp-01',r:2,e:'N',z:'Chorrillos',m:1300,cli:null,foto:false},
    {c:'v12343938wofp-01',r:3,e:'E',z:'Miraflores',m:950,cli:'Ana Rojas',foto:true},
    {c:'v12344804wofp-01',r:3,e:'E',z:'Surquillo',m:950,cli:null,foto:false},
    {c:'pendiente-1',r:null,e:'E',z:null,m:1000,cli:null,foto:false}
  ],
  adicionales:[{tipo:'Expo Vino',det:'San Borja × 5',m:4250},{tipo:'Taxi',det:'8.2 km',m:2200}],
  apoyos:[{tienda:'Wong - Limatambo',det:'4 h · S/ 18.00 por hora',m:7200}],
  zonasAurora:[{n:'Miraflores, Surquillo, Surco',m:950},{n:'Chorrillos',m:1300}],
  tramosAldabas:[{n:'0 a 3 km',m:1000},{n:'3 a 8 km',m:1150},{n:'8 a 10 km',m:1300},{n:'10 a 11 km',m:1450},{n:'11 a 12 km',m:1600}],
  expoZonas:[['Santiago de Surco',850],['Miraflores',850],['San Borja',850],['La Molina',900],['San Isidro',900],['Surquillo',900],['Barranco',900],['Santa Anita',900],['San Luis',900],['Lince',1000],['Jesús María',1000],['Pueblo Libre',1050],['San Miguel',1100],['Chorrillos',1100],['La Victoria',1100],['Ate',1100],['Magdalena del Mar',1200],['San Juan de Miraflores',1200],['Cercado de Lima',1300],['Breña',1300],['Villa María del Triunfo',1300]],
  tiendas:['Wong - Aldabas','Wong Aurora','Wong - Limatambo','Wong - Gardenias'],
  estado:{E:['Entregado','ok'],P:['Parcial','warn'],N:['No entregado','']},
  semana:{rango:'26 oct – 1 nov',total:80800,fuentes:[
    {k:'tienda',n:'Wong Aurora',s:'21 pedidos',m:26300,c:'var(--acc)',i:'store'},
    {k:'apoyo',n:'Apoyo · Limatambo',s:'10 horas',m:18000,c:'var(--c-apoyo)',i:'apoyo'},
    {k:'expo',n:'Expo Vino',s:'27 pedidos',m:25500,c:'var(--c-adic)',i:'adic'},
    {k:'taxi',n:'Taxi',s:'2 carreras',m:11000,c:'var(--c-taxi)',i:'taxi',claro:true}]}
};

/* ---------- utilidades de interfaz (devuelven HTML) ---------- */
const UI={
  /* botón. o:{t,i,c(color),cls,a(atributos)} */
  btn(o){const st=o.c?`style="background:${o.c}${o.claro?';color:var(--sun-ink)':''}"`:'';return `<button type="button" class="btn ${o.cls||''}" ${st} ${o.a||''}>${o.i?I(o.i):''}${o.t}</button>`},
  /* fila con figura de color. o:{t,s,i,k(clave ACC) | c,der,a,flecha} */
  fila(o){const a=o.k?ACC[o.k]:{};const c=o.c||a.c||'var(--acc)',ic=o.i||a.i||'info',claro=o.claro||a.claro;
    return `<button type="button" class="fila ${o.cls||''}" ${o.a||''}><span class="fig ${claro?'claro':''}" style="background:${c}">${I(ic)}</span><span><b>${o.t}</b>${o.s?`<small>${o.s}</small>`:''}</span>${o.der?`<span class="der">${o.der}</span>`:''}${o.flecha!==false&&!o.der?I('fwd','flecha'):''}</button>`},
  /* mosaico. o:{k,t,s,a} */
  tile(o){const a=ACC[o.k]||{};return `<button type="button" class="tile ${a.claro?'claro':''} rise ${o.d||''}" style="background:${a.c}" ${o.a||''}><span class="brillo"></span><span class="fig">${I(a.i)}</span><span><b>${o.t||a.n}</b><small>${o.s||a.s}</small></span></button>`},
  chip(t,sel,a='',c){return `<button type="button" class="chip ${c?'col':''}" ${c?`style="background:${c}"`:''} aria-pressed="${!!sel}" ${a}>${t}</button>`},
  /* pestañas. items:[[valor,texto,n?]] ; clave de estado ctx.s[k] */
  seg(k,items,act){return `<div class="seg" role="tablist">${items.map(([v,t,n])=>`<button type="button" role="tab" aria-selected="${act===v}" data-tab="${k}" data-v="${v}">${t}${n!=null?`<span class="n">${n}</span>`:''}</button>`).join('')}</div>`},
  pill(t,tono='',i){return `<span class="pill ${tono}">${i?I(i):''}${t}</span>`},
  aviso(t,tono='',i){return `<div class="aviso ${tono}">${I(i||(tono==='warn'||tono==='bad'?'warn':tono==='ok'?'check':'info'))}<div>${t}</div></div>`},
  kpi(v,l,tono=''){return `<div class="kpi ${tono}"><b>${v}</b><small>${l}</small></div>`},
  /* acordeón. o:{id,t,s,k|c,i,der,open,body} */
  ac(o){const a=o.k?ACC[o.k]:{};const c=o.c||a.c||'var(--acc)',ic=o.i||a.i||'info';
    return `<div class="ac ${o.open?'open':''}" data-acid="${o.id||''}"><button type="button" class="ac-h" data-open aria-expanded="${!!o.open}"><span class="fig ${(o.claro||a.claro)?'claro':''}" style="background:${c}">${I(ic)}</span><span><b>${o.t}</b>${o.s?`<small>${o.s}</small>`:''}</span>${o.der?`<span class="der">${o.der}</span>`:''}${I('chev','chev')}</button><div class="ac-b"><div><div class="in">${o.body||''}</div></div></div></div>`},
  /* interruptor. a: atributos (data-act…) */
  sw(on,a=''){return `<button type="button" class="sw" role="switch" aria-checked="${!!on}" ${a}></button>`},
  stepper(id,v,min=1){return `<div class="stepper"><button type="button" data-step="-1" data-for="${id}" aria-label="Menos">−</button><output id="${id}">${v}</output><button type="button" data-step="1" data-for="${id}" aria-label="Más">+</button></div>`},
  /* anillo con segmentos [{m,c}] ; centro HTML */
  ring(seg,centro,size=170,w=20){const R=(size-w)/2-2,C=2*Math.PI*R,tot=seg.reduce((s,x)=>s+x.m,0)||1;let acc=0;
    return `<div style="position:relative;width:${size}px;height:${size}px;margin:auto"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="transform:rotate(-90deg)"><circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke-width="${w}" style="stroke:var(--surf2)"/>${seg.map(x=>{const l=x.m/tot*C,o=-acc;acc+=l;return `<circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke-width="${w}" stroke-linecap="butt" style="stroke:${x.c};stroke-dasharray:${Math.max(l-3,0)} ${C};stroke-dashoffset:${o};transition:stroke-dasharray .6s"/>`}).join('')}</svg><div style="position:absolute;inset:0;display:grid;place-content:center;text-align:center">${centro}</div></div>`},
  /* barras verticales. d:[{l,v,c}] */
  bars(d,h=110){const mx=Math.max(...d.map(x=>x.v),1);return `<div style="display:flex;align-items:flex-end;gap:6px;height:${h}px">${d.map(x=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px"><i style="display:block;width:100%;border-radius:6px 6px 3px 3px;height:${Math.max(x.v/mx*100*.8,x.v?6:2)}%;background:${x.c||'var(--acc)'}"></i><small class="tiny">${x.l}</small></div>`).join('')}</div>`},
  /* cabecera de pantalla con título grande y subtítulo */
  titulo(t,s=''){return `<div style="margin:2px 2px 12px"><h2 style="font-size:26px;line-height:1.1">${t}</h2>${s?`<p class="muted">${s}</p>`:''}</div>`},
  /* contador animado */
  count(el,to,f=fmt.sol,from=0){if(reducir){el.textContent=f(to);return}const t0=performance.now(),d=650;(function s(t){const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);el.textContent=f(from+(to-from)*e);if(k<1)requestAnimationFrame(s)})(t0)}
};

/* ---------- el motor ---------- */
const App={
  state:{tema:'claro',cara:'mapa',pedidos:10,licencia:'vencida'},
  screens:{}, sheets:{}, sstate:{}, stack:[], sheetCtx:null, css_:'',
  screen(id,def){this.screens[id]=Object.assign({grupo:'Principales',id},def)},
  sheet(id,def){this.sheets[id]=Object.assign({grupo:'Hojas',id},def)},
  css(t){const s=document.createElement('style');s.textContent=t;document.head.appendChild(s)},
  cur(){return this.stack[this.stack.length-1]},
  /* navegación */
  go(id,p={}){this.stack=[{id,p}];this.closeSheet();this.draw(true)},
  push(id,p={}){this.stack.push({id,p});this.closeSheet();this.draw(true)},
  back(){if(this.stack.length>1){this.stack.pop();this.draw(true)}},
  ctxOf(e){const d=this.screens[e.id];this.sstate[e.id]=this.sstate[e.id]||{};return {p:e.p||{},s:this.sstate[e.id],app:this,data:DATA,def:d}},
  draw(top){
    const e=this.cur(),d=this.screens[e.id];
    if(!d){this.toast('Esta pantalla no está en el prototipo');return}
    const ctx=this.ctxOf(e),sc=$('#screen'),y=sc.scrollTop;
    sc.innerHTML=d.render(ctx);sc.scrollTop=top?0:y;
    if(d.mount)d.mount(sc,ctx);
    $('#appbar').innerHTML=`${this.stack.length>1?`<button type="button" class="atras" data-back aria-label="Atrás">${I('back')}</button>`:`<button type="button" data-go="inicio" style="display:flex;align-items:center;gap:8px">${CAR(38)}<span>Control Driver</span></button>`}<span class="pildora">${I(d.icono||'home')}${d.titulo||''}</span>`;
    $$('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===d.tab));
    $$('#indice button').forEach(b=>b.setAttribute('aria-current',b.dataset.i===e.id));
    $('#cambios').innerHTML=d.cambios&&d.cambios.length?`<h3>Qué cambia en «${d.titulo}»</h3><ul>${d.cambios.map(x=>`<li>${x}</li>`).join('')}</ul>`:'';
  },
  refresh(){const sh=$('#hoja');if(this.sheetCtx&&sh.classList.contains('on'))this.drawSheet(true);this.draw(false)},
  /* hojas */
  openSheet(id,p={}){
    const d=this.sheets[id];if(!d){this.toast('Esta hoja no está en el prototipo');return}
    this.sheetCtx={id,p,s:{},app:this,data:DATA,def:d};this.drawSheet(false);
    $('#hoja').classList.add('on');$('#capa').classList.add('on');
    $('#hoja').classList.toggle('full',!!d.full);
  },
  drawSheet(keep){
    const c=this.sheetCtx,d=c.def,h=$('#hoja'),bodyEl=$('.hoja-cuerpo',h),y=keep&&bodyEl?bodyEl.scrollTop:0;
    const col=d.neutro?'':`background:${typeof d.color==='string'?d.color:(ACC[d.k]||{}).c||'var(--acc)'}`;
    const claro=d.claro||(ACC[d.k]||{}).claro;
    const ic=d.icono||(ACC[d.k]||{}).i||'info';
    const titulo=typeof d.titulo==='function'?d.titulo(c):d.titulo, sub=typeof d.sub==='function'?d.sub(c):d.sub||'';
    h.innerHTML=`<div class="hoja-cab ${claro?'claro':''} ${d.neutro?'neutro':''}" style="${col}"><span class="ico">${I(ic)}</span><div><h3>${titulo}</h3>${sub?`<small>${sub}</small>`:''}</div><button type="button" class="x" data-close aria-label="Cerrar">${I('x')}</button></div><div class="hoja-cuerpo">${d.render(c)}</div>${d.pie?`<div class="hoja-pie">${d.pie(c)}</div>`:''}`;
    $('.hoja-cuerpo',h).scrollTop=y;
    if(d.mount)d.mount(h,c);
  },
  closeSheet(){this.sheetCtx=null;$('#hoja').classList.remove('on');$('#capa').classList.remove('on')},
  toast(t,tono){const e=$('#toast');e.textContent=t;e.style.background=tono==='warn'?'var(--warn)':tono==='bad'?'var(--bad)':'var(--ok)';e.classList.add('on');clearTimeout(this._t);this._t=setTimeout(()=>e.classList.remove('on'),2000)},
  confetti(){if(reducir)return;const ph=$('#phone'),cols=['#1f5cff','#ffc800','#12a150','#a3274f','#7a3ff2','#07727c'];
    for(let i=0;i<30;i++){const s=document.createElement('i');s.className='conf';s.style.background=cols[i%6];s.style.setProperty('--dx',(Math.random()*340-170)+'px');s.style.setProperty('--dy',(Math.random()*-260-40)+'px');s.style.setProperty('--r',(Math.random()*720-360)+'deg');ph.appendChild(s);setTimeout(()=>s.remove(),1200)}},
  /* demo: aplicar un acto (data-act) a pantalla u hoja */
  act(el,ev){
    const name=el.dataset.act;let ctx,def;
    if(this.sheetCtx&&el.closest('#hoja')){ctx=this.sheetCtx;def=ctx.def}else{ctx=this.ctxOf(this.cur());def=ctx.def}
    const f=def&&def.acts&&def.acts[name];if(!f){this.toast('Acción de demostración: '+name);return}
    const r=f(el,ev,ctx);if(r!==false)this.refresh();
  },
  start(){
    /* indice de pantallas */
    const grupos={};[...Object.values(this.screens),...Object.values(this.sheets)].forEach(d=>{(grupos[d.grupo]=grupos[d.grupo]||[]).push(d)});
    $('#indice').innerHTML=Object.entries(grupos).map(([g,l])=>`<b>${g}</b>`+l.map(d=>`<button type="button" data-i="${d.id}" data-${this.screens[d.id]===d?'go':'sheet'}="${d.id}">${d.titulo&&typeof d.titulo==='string'?d.titulo:d.id}</button>`).join('')).join('');
    this.go('inicio');
  }
};

/* ---------- eventos delegados (un solo lugar) ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-go],[data-push],[data-back],[data-sheet],[data-close],[data-toast],[data-confetti],[data-act],[data-tab],[data-open],[data-one],[data-tog],[data-step],[data-sw]');
  if(!t||!t.closest('#phone,#indice,#recorridos'))return;
  const P=()=>{try{return JSON.parse(t.dataset.p||'{}')}catch(_){return{}}};
  if(t.dataset.go){App.go(t.dataset.go,P())}
  else if(t.dataset.push){App.push(t.dataset.push,P())}
  else if(t.hasAttribute('data-back')){App.back()}
  else if(t.dataset.sheet){App.openSheet(t.dataset.sheet,P())}
  else if(t.hasAttribute('data-close')){App.closeSheet()}
  if(t.dataset.toast)App.toast(t.dataset.toast);
  if(t.hasAttribute('data-confetti'))App.confetti();
  if(t.hasAttribute('data-open')){const a=t.closest('.ac');a.classList.toggle('open');t.setAttribute('aria-expanded',a.classList.contains('open'))}
  if(t.hasAttribute('data-one')){$$('[data-one]',t.parentElement).forEach(b=>b.setAttribute('aria-pressed',b===t))}
  if(t.hasAttribute('data-tog')){t.setAttribute('aria-pressed',t.getAttribute('aria-pressed')!=='true')}
  if(t.hasAttribute('data-sw')){t.setAttribute('aria-checked',t.getAttribute('aria-checked')!=='true')}
  if(t.dataset.step){const o=document.getElementById(t.dataset.for);if(o)o.textContent=Math.max(0,(+o.textContent||0)+ +t.dataset.step)}
  if(t.dataset.tab){const c=t.closest('#hoja')&&App.sheetCtx?App.sheetCtx:App.ctxOf(App.cur());c.s[t.dataset.tab]=t.dataset.v;App.refresh()}
  if(t.dataset.act&&!t.dataset.tab)App.act(t,e);
});
$('#capa').addEventListener('click',()=>App.closeSheet());

/* ---------- navegación inferior, tema, caras ---------- */
$('#nav').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const t=b.dataset.tab;
  if(t==='cargar')App.openSheet('cargar');else if(t==='mas')App.openSheet('mas');else App.go(t)});
$('#tema').addEventListener('click',()=>{const d=document.documentElement,osc=d.getAttribute('data-theme')==='dark';d.setAttribute('data-theme',osc?'light':'dark');$('#tema').textContent=osc?'Oscuro':'Claro'});
$('#caras').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('#caras button').forEach(x=>x.setAttribute('aria-pressed',x===b));if(b.dataset.c==='mapa')document.documentElement.removeAttribute('data-cara');else document.documentElement.setAttribute('data-cara',b.dataset.c)});
