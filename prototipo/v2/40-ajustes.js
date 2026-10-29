/* =====================================================================
   40-ajustes.js — Ajustes, Tutoriales, Acerca de y pantallas de sistema
   (bloqueo, legal, sinconexion, error). Prefijo de CSS: .aju-
   ===================================================================== */
(function(){
  const X=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const copiar=t=>{try{navigator.clipboard.writeText(t)}catch(_){}};
  const sol=v=>{const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?'0.00':n.toFixed(2)};

  App.css(`
  .aju-ver{display:flex;align-items:center;gap:12px;padding:14px;border-radius:22px;background:var(--c-licencia);color:#fff;margin-bottom:12px;position:relative;overflow:hidden}
  .aju-ver .fig{width:50px;height:50px;border-radius:16px;background:rgba(255,255,255,.2);display:grid;place-items:center;flex:none}
  .aju-ver b{font:600 18px/1.1 var(--f-display);display:block} .aju-ver small{opacity:.9;font-weight:700;display:block}
  .aju-ver .btn{width:auto;min-height:42px;font-size:14px;padding:0 12px;background:var(--sun);color:var(--sun-ink);box-shadow:0 3px 0 rgba(0,0,0,.25);margin-left:auto;flex:none}
  .aju-ver .girando .ic{animation:girar .8s linear infinite}
  .aju-card{min-height:120px}
  .aju-card .big{position:absolute;right:-8px;bottom:-10px;opacity:.18;pointer-events:none}
  .aju-card .big .ic{width:84px;height:84px;stroke-width:1.6}
  .aju-card small{display:block;margin-top:2px;font-size:12.5px}
  .aju-cab{display:flex;align-items:center;gap:12px;padding:12px;border-radius:20px;color:#fff;margin-bottom:12px}
  .aju-cab.claro{color:var(--sun-ink)}
  .aju-cab .fig{width:46px;height:46px;border-radius:15px;background:rgba(255,255,255,.22);display:grid;place-items:center;flex:none}
  .aju-cab b{font:600 20px/1.1 var(--f-display);display:block} .aju-cab small{font-weight:700;opacity:.92;display:block}
  .aju-cab .atras{margin-left:auto;width:auto;min-height:40px;padding:0 12px;border-radius:14px;background:rgba(255,255,255,.22);font-weight:800;font-size:13px;display:flex;align-items:center;gap:4px;flex:none}
  .aju-cab .atras .ic{width:16px;height:16px}
  .aju-pan{display:flex;flex-direction:column;gap:12px;background:var(--surf);border-radius:20px;padding:14px}
  .aju-caras{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .aju-cara{position:relative;display:flex;flex-direction:column;gap:6px;align-items:center;padding:10px 8px;border-radius:18px;border:3px solid var(--line);background:var(--surf);font-weight:800;transition:transform .12s,border-color .15s}
  .aju-cara:active{transform:scale(.96)}
  .aju-cara[aria-pressed=true]{border-color:var(--acc);background:var(--acc-soft)}
  .aju-cara[aria-pressed=true]::after{content:"✓";position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;font-size:14px;animation:pop .3s}
  .aju-mini{width:62px;height:84px;border-radius:12px;border:2px solid rgba(0,0,0,.15);overflow:hidden;display:flex;flex-direction:column;gap:5px;padding:6px}
  .aju-mini i{display:block;border-radius:4px;height:8px} .aju-mini .h{height:12px;border-radius:5px} .aju-mini .k{height:16px;border-radius:6px}
  .aju-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .aju-big{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 8px;border-radius:20px;border:3px solid var(--line);background:var(--surf);font-weight:800;transition:transform .12s}
  .aju-big:active{transform:scale(.96)} .aju-big .ic{width:42px;height:42px}
  .aju-big[aria-pressed=true]{border-color:var(--acc);background:var(--acc-soft);color:var(--acc)}
  .aju-row{display:flex;align-items:center;gap:10px;justify-content:space-between;min-height:52px}
  .aju-row b{display:block;line-height:1.15} .aju-row small{display:block;color:var(--ink2);font-weight:700}
  .aju-mapa{border-radius:18px;overflow:hidden;background:var(--surf2);border:3px solid var(--line)}
  .aju-mapa svg{display:block;width:100%;height:auto}
  .aju-pulso{transform-box:fill-box;transform-origin:center;animation:aju-pulso 1.6s ease-out infinite}
  @keyframes aju-pulso{0%{transform:scale(.4);opacity:.8}100%{transform:scale(2.2);opacity:0}}
  .aju-zona{display:grid;grid-template-columns:1fr 92px 44px;gap:8px;align-items:center}
  .aju-zona .inp{min-height:48px;font-size:15px;padding:0 10px}
  .aju-zona .del{width:44px;height:44px;border-radius:14px;background:var(--bad-soft);color:var(--bad);display:grid;place-items:center}
  .aju-sol{position:relative} .aju-sol .inp{padding-left:34px;text-align:right}
  .aju-sol::before{content:"S/";position:absolute;left:10px;top:50%;transform:translateY(-50%);font-weight:800;color:var(--ink3);font-size:13px;z-index:1}
  .aju-tabla{width:100%;border-collapse:collapse;font-weight:700} .aju-tabla td{padding:9px 6px;border-bottom:2px solid var(--line)} .aju-tabla td:last-child{text-align:right;font-family:var(--f-display)}
  .aju-pad{display:grid;grid-template-columns:repeat(3,64px);gap:10px;justify-content:center}
  .aju-pad button{height:56px;border-radius:18px;background:var(--surf2);font:600 26px var(--f-display);text-align:center;display:grid;place-items:center;transition:transform .1s}
  .aju-pad button:active{transform:scale(.9)} .aju-pad .acc{background:var(--acc);color:var(--acc-ink)}
  .aju-pin{display:flex;gap:16px;justify-content:center;padding:6px 0}
  .aju-pin i{width:20px;height:20px;border-radius:50%;border:3px solid var(--ink3);background:none;transition:background .15s}
  .aju-pin i.on{background:var(--acc);border-color:var(--acc)} .aju-pin i.new{animation:pop .3s}
  .aju-pin.err i{border-color:var(--bad)}
  .aju-sacude{animation:aju-sacude .45s}
  @keyframes aju-sacude{0%,100%{transform:translateX(0)}20%{transform:translateX(-12px)}40%{transform:translateX(10px)}60%{transform:translateX(-8px)}80%{transform:translateX(5px)}}
  .aju-lic{position:relative;padding:20px 0 4px}
  .aju-pista{display:flex;height:22px;border-radius:11px;overflow:hidden;position:relative;background:var(--surf2)}
  .aju-pista span{display:block;height:100%} .aju-pista .a{flex:4;background:var(--ok)} .aju-pista .b{flex:2;background:var(--warn)} .aju-pista .c{flex:2;background:var(--bad)}
  .aju-cubre{position:absolute;top:0;bottom:0;right:0;background:var(--surf2);width:calc(100% - var(--pos));animation:aju-cubre 1.4s cubic-bezier(.3,1,.4,1) both;opacity:.82}
  @keyframes aju-cubre{from{width:100%}}
  .aju-coche{position:absolute;top:-6px;left:var(--pos);transform:translateX(-50%);animation:aju-coche 1.4s cubic-bezier(.3,1,.4,1) both}
  @keyframes aju-coche{from{left:0}}
  .aju-etq{display:flex;margin-top:6px;font-size:11.5px;font-weight:800;color:var(--ink2)}
  .aju-etq span:nth-child(1){flex:4} .aju-etq span:nth-child(2){flex:2} .aju-etq span:nth-child(3){flex:2;text-align:right}
  .aju-caja{background:var(--surf2);border-radius:14px;padding:12px;font:600 13px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;color:var(--ink);max-height:190px;overflow:auto}
  .aju-txt{color:var(--ink2);font-weight:700;font-size:14px} .aju-txt b{color:var(--ink)}
  .aju-conf{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:16px;background:var(--warn-soft);color:var(--warn);font-weight:800}
  .aju-conf .fila2{display:flex;gap:8px} .aju-conf .btn{min-height:44px;font-size:15px}
  .aju-tut{position:relative;overflow:hidden;min-height:104px;width:100%;border-radius:22px;padding:14px;color:#fff;display:flex;align-items:center;gap:14px;text-align:left;box-shadow:0 6px 0 rgba(0,0,0,.18);transition:transform .15s,box-shadow .15s}
  .aju-tut:active{transform:translateY(4px);box-shadow:0 2px 0 rgba(0,0,0,.18)}
  .aju-tut .fig{width:62px;height:62px;border-radius:20px;background:rgba(255,255,255,.24);display:grid;place-items:center;flex:none}
  .aju-tut .fig .ic{width:34px;height:34px} .aju-tut b{font:600 20px/1.1 var(--f-display);display:block} .aju-tut small{font-weight:700;opacity:.92}
  .aju-tut .c1,.aju-tut .c2{position:absolute;border-radius:50%;background:rgba(255,255,255,.13);pointer-events:none}
  .aju-tut .c1{width:110px;height:110px;right:-30px;top:-34px} .aju-tut .c2{width:60px;height:60px;right:50px;bottom:-30px}
  .aju-tut .ic.chev{margin-left:auto;transition:transform .25s} .aju-tut[aria-expanded=true] .ic.chev{transform:rotate(180deg)}
  .aju-temas{display:flex;flex-direction:column;gap:8px;padding:10px 0 4px}
  .aju-linea{list-style:none;margin:6px 0 0;padding:0;position:relative}
  .aju-linea li{position:relative;padding:0 0 14px 44px;font-weight:700;min-height:34px;animation:rise .4s both}
  .aju-linea li::before{content:"";position:absolute;left:15px;top:30px;bottom:-2px;width:3px;border-radius:2px;background:var(--line)}
  .aju-linea li:last-child::before{display:none}
  .aju-linea li i{position:absolute;left:0;top:0;width:34px;height:34px;border-radius:50%;background:var(--tc);color:#fff;display:grid;place-items:center;font:600 16px var(--f-display);font-style:normal}
  .aju-linea li:nth-child(2){animation-delay:.08s}.aju-linea li:nth-child(3){animation-delay:.16s}.aju-linea li:nth-child(4){animation-delay:.24s}.aju-linea li:nth-child(5){animation-delay:.32s}
  .aju-escena{display:grid;place-items:center;padding:6px 0}
  .aju-via{stroke-dasharray:16 14;animation:aju-via 1s linear infinite}
  @keyframes aju-via{to{stroke-dashoffset:-30}}
  .aju-auto{animation:aju-auto 6s ease-in-out infinite alternate}
  @keyframes aju-auto{from{transform:translateX(-40px)}to{transform:translateX(40px)}}
  .aju-onda{transform-box:fill-box;transform-origin:center;animation:aju-pulso 2s ease-out infinite}
  .aju-onda.d{animation-delay:.9s}
  .aju-nube{animation:bob 3s ease-in-out infinite}
  .aju-wob{transform-box:fill-box;transform-origin:50% 90%;animation:aju-wob 1.8s ease-in-out infinite}
  @keyframes aju-wob{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
  .aju-escudo{transform-box:fill-box;transform-origin:center;animation:bob 2.4s ease-in-out infinite}
  .aju-huella.on .ic{animation:aju-scan .7s ease-in-out infinite alternate;color:var(--ok)}
  @keyframes aju-scan{from{transform:scale(1)}to{transform:scale(1.25)}}
  .aju-check{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:12px;border-radius:18px;border:3px solid var(--line);background:var(--surf);font-weight:800;transition:border-color .15s,background .15s}
  .aju-check .caja{width:36px;height:36px;border-radius:12px;border:3px solid var(--ink3);display:grid;place-items:center;flex:none;color:transparent;transition:all .15s}
  .aju-check .caja .ic{width:22px;height:22px}
  .aju-check[aria-pressed=true]{border-color:var(--ok);background:var(--ok-soft)}
  .aju-check[aria-pressed=true] .caja{background:var(--ok);border-color:var(--ok);color:#fff;animation:pop .3s}
  .aju-cent{text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center}
  .aju-cent h2{font-size:26px;line-height:1.1}
  `);

  /* ---------------- ayudas ---------------- */
  const CARAS=[
    ['mapa','Mapa',['#eef2fb','#1f5cff','#ffffff']],['asfalto','Asfalto',['#0a1130','#6d93ff','#141c44']],
    ['turbo','Turbo',['#f3effd','#6a3fd6','#ffffff']],['menta','Menta',['#eefaf5','#0c8f6a','#ffffff']],
    ['arcilla','Arcilla',['#fbf0e8','#c4552d','#ffffff']],['avispa','Avispa',['#ffffff','#ffc800','#fff6d6']]];
  const mini=c=>`<span class="aju-mini" style="background:${c[0]}"><i class="h" style="background:${c[1]}"></i><i class="k" style="background:${c[2]}"></i><i style="background:${c[1]};opacity:.6;width:60%"></i><i class="k" style="background:${c[2]}"></i></span>`;
  function aplicaCara(id){
    const d=document.documentElement;
    if(id==='asfalto'){d.setAttribute('data-theme','dark');d.removeAttribute('data-cara')}
    else if(id==='mapa'||id==='menta'||id==='turbo'){d.setAttribute('data-theme','light');if(id==='mapa')d.removeAttribute('data-cara');else d.setAttribute('data-cara',id==='turbo'?'violeta':'menta')}
    else return false;
    const t=document.getElementById('tema');if(t)t.textContent=id==='asfalto'?'Claro':'Oscuro';
    const v=id==='turbo'?'violeta':id==='asfalto'?'mapa':id;
    document.querySelectorAll('#caras button[data-c]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===v));
    return true;
  }
  function ini(s){
    if(s.ini)return s;
    Object.assign(s,{ini:1,abre:null,cara:'mapa',metaD:150,metaS:800,sonidos:true,
      tienda:'Wong Aurora',tiendas:DATA.tiendas.slice(),miTienda:true,veh:'auto',addT:false,nuevaT:'',
      ubi:true,ruta:'recta',factor:13,tt:'tienda',modo:'zona',unica:'9.50',
      zonas:DATA.zonasAurora.map(z=>({n:z.n,m:(z.m/100).toFixed(2)})),garantia:true,desde:'2026-10-26',
      tipos:['Taxi','Expo Vino','Movilidad'],tipo:'Expo Vino',addTipo:false,nuevoTipo:'',
      expo:DATA.expoZonas.map(z=>({n:z[0],m:(z[1]/100).toFixed(2)})),todasZ:false,pegar:'',taxiKm:'2.70',movil:'5.00',
      coms:[true,true,false,true,true],fotos:true,
      bq:{pin:'',on:false,huella:false,paso:0},cod:'CD-7K4M-92QX-A81F',lic:'',conf:null,ultimo:'Nunca'});
    return s;
  }
  const NOMBRES={taxi:'Taxi',expo:'Expo Vino'};
  const conf=(s,id,txt,okTxt,okAct,tono)=>s.conf!==id?'':`<div class="aju-conf rise">${txt}<div class="fila2">${UI.btn({t:okTxt,cls:tono||'bad',a:`data-act="${okAct}"`})}${UI.btn({t:'Cancelar',cls:'sec',a:'data-act="noconf"'})}</div></div>`;
  const dots=(pin,err)=>`<div class="aju-pin ${err?'err':''}">${[0,1,2,3].map(i=>`<i class="${i<pin.length?'on':''} ${i===pin.length-1?'new':''}"></i>`).join('')}</div>`;
  const pad=(extra='')=>`<div class="aju-pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" data-act="key" data-d="${n}">${n}</button>`).join('')}<button type="button" aria-label="Borrar" data-act="borrar">${I('back')}</button><button type="button" data-act="key" data-d="0">0</button>${extra||'<span></span>'}</div>`;

  /* ---------------- tarjetas del menú ---------------- */
  const SEC=[
    ['apariencia','Apariencia','palette','var(--c-foto)',s=>CARAS.find(c=>c[0]===s.cara)[1]],
    ['metas','Metas y sonidos','flag','var(--c-cantidad)',s=>`Meta S/ ${s.metaD}`],
    ['tienda','Tienda y tarifa','store','var(--acc)',s=>`${s.tienda} · ${{unica:'tarifa única',km:'por km',zona:'por zona'}[s.modo]}`],
    ['adicionales','Adicionales','adic','var(--c-adic)',s=>`${s.tipos.length} tipos`],
    ['comandas','Comandas y clientes','comanda','var(--c-buscar)',s=>`${s.coms.filter(Boolean).length} de 5 activas`],
    ['bloqueo','Bloqueo','lock','var(--c-ajustes)',s=>s.bq.on?'Con PIN':'Sin PIN'],
    ['licencia','Licencia','key','var(--c-licencia)',s=>App.state.licencia==='activa'?'Activa · 29/11':'Vencida'],
    ['respaldo','Respaldo','nube','var(--c-apoyo)',s=>s.fotos?'Con fotos':'Sin fotos'],
    ['terminos','Términos','doc','var(--c-historial)',s=>'Privacidad'],
    ['ejemplo','Datos de ejemplo','gift','var(--c-mano)',s=>`${App.state.pedidos} pedidos hoy`],
    ['diag','Diagnóstico','info','var(--c-stats)',s=>'Todo en orden']];

  const CUERPO={
    apariencia(s){return `<div class="aju-caras">${CARAS.map(c=>`<button type="button" class="aju-cara" aria-pressed="${s.cara===c[0]}" data-act="cara" data-id="${c[0]}">${mini(c[2])}${c[1]}</button>`).join('')}</div><p class="tiny">Mapa, Asfalto, Turbo y Menta cambian de verdad la cara de este prototipo.</p>`},
    metas(s){return `<div class="aju-row"><b>Meta del día</b></div>${stp('metaD',s.metaD,10,v=>'S/ '+v)}<div class="sep"></div><div class="aju-row"><b>Meta de la semana</b></div>${stp('metaS',s.metaS,50,v=>'S/ '+v)}<div class="sep"></div><div class="aju-row"><span><b>Sonidos y vibración</b><small>Al guardar y al llegar a la meta</small></span>${UI.sw(s.sonidos,'data-act="sw" data-k="sonidos"')}</div>${UI.btn({t:'Guardar metas',i:'check',cls:'ok',a:'data-act="guardaMetas"'})}`},
    tienda(s){
      const tab=UI.seg('tt',[['tienda','Tienda'],['ubi','Ubicación'],['tarifa','Tarifa']],s.tt);
      let b='';
      if(s.tt==='tienda'){
        b=`<div class="chips">${s.tiendas.map(t=>UI.chip(X(t),t===s.tienda,`data-act="selT" data-id="${X(t)}"`)).join('')}${UI.chip(I('plus')+'Agregar',false,'data-act="addT"','var(--c-ajustes)')}</div>`+
          (s.addT?`<div style="display:flex;gap:8px"><input class="inp" data-m="nuevaT" placeholder="Nombre de la tienda" value="${X(s.nuevaT)}">${UI.btn({t:'Listo',cls:'ok sm',a:'data-act="okT"'})}</div>`:'')+
          `<div class="aju-row"><span><b>Usarla como mi tienda</b><small>Los pedidos nuevos van aquí</small></span>${UI.sw(s.miTienda,'data-act="sw" data-k="miTienda"')}</div>`+
          `<div class="aju-two"><button type="button" class="aju-big" aria-pressed="${s.veh==='auto'}" data-act="set" data-k="veh" data-v="auto">${I('car')}Auto</button><button type="button" class="aju-big" aria-pressed="${s.veh==='moto'}" data-act="set" data-k="veh" data-v="moto">${I('bike')}Moto</button></div>`;
      }else if(s.tt==='ubi'){
        b=`<div class="aju-mapa"><svg viewBox="0 0 320 150" role="img" aria-label="Mapa de la tienda"><rect width="320" height="150" style="fill:var(--surf2)"/><path d="M0 100H320M0 40H320M80 0V150M200 0V150M260 0L220 150" style="stroke:var(--surf);stroke-width:12;fill:none"/><path d="M0 70L320 90" style="stroke:var(--surf);stroke-width:7;fill:none"/><rect x="92" y="48" width="96" height="44" rx="6" style="fill:var(--acc-soft)"/>${s.ubi?`<circle class="aju-pulso" cx="160" cy="70" r="14" style="fill:var(--acc)"/><path d="M160 92s16-14 16-28a16 16 0 00-32 0c0 14 16 28 16 28z" style="fill:var(--bad)"/><circle cx="160" cy="64" r="6" fill="#fff"/>`:`<text x="160" y="76" text-anchor="middle" style="fill:var(--ink3);font:800 14px var(--f-body)">Sin ubicación</text>`}</svg></div>`+
          (s.ubi?UI.aviso('Tienda ubicada: '+X(s.tienda),'ok'):UI.aviso('La tienda todavía no tiene ubicación.','warn'))+
          UI.btn({t:'Estoy en la tienda',i:'pin',a:'data-act="aqui"'})+
          `<div class="aju-two"><button type="button" class="aju-big" aria-pressed="${s.ruta==='recta'}" data-act="set" data-k="ruta" data-v="recta">${I('fwd')}Línea recta</button><button type="button" class="aju-big" aria-pressed="${s.ruta==='calles'}" data-act="set" data-k="ruta" data-v="calles">${I('route')}Por calles</button></div>`+
          (s.ruta==='calles'?`<div class="aju-row"><b>Factor de calles</b></div>${stp('factor',s.factor,1,v=>'× '+(v/10).toFixed(1),10,30)}`:'')+
          (s.ubi?UI.btn({t:'Quitar la ubicación',i:'trash',cls:'bad',a:'data-act="quitaUbi"'}):'');
      }else{
        b=`<div class="seg" role="tablist">${[['unica','Única'],['km','Por km'],['zona','Por zona']].map(([v,t])=>`<button type="button" role="tab" style="min-height:52px;font-size:16px" aria-selected="${s.modo===v}" data-act="set" data-k="modo" data-v="${v}">${t}</button>`).join('')}</div>`;
        if(s.modo==='unica')b+=`<label class="lbl">Cuánto pagan por pedido</label><div class="aju-sol"><input class="inp" inputmode="decimal" data-m="unica" value="${X(s.unica)}"></div>`;
        else if(s.modo==='km')b+=`<table class="aju-tabla">${DATA.tramosAldabas.map((t,i)=>`<tr><td><span class="pill acc">${i+1}</span></td><td>${t.n}</td><td>${fmt.sol(t.m)}</td></tr>`).join('')}</table>`;
        else b+=s.zonas.map((z,i)=>`<div class="aju-zona"><input class="inp" data-m="zonas" data-i="${i}" data-f="n" placeholder="Zona" value="${X(z.n)}"><div class="aju-sol"><input class="inp" inputmode="decimal" data-m="zonas" data-i="${i}" data-f="m" value="${X(z.m)}"></div><button type="button" class="del" aria-label="Quitar zona" data-act="zonaDel" data-i="${i}">${I('trash')}</button></div>`).join('')+
          (s.zonas.length<5?UI.btn({t:'+ Añadir zona',cls:'sec',a:'data-act="zonaAdd"'}):'<p class="tiny">Máximo 5 zonas.</p>');
        b+=`<div class="aju-row"><span><b>Esta tienda paga una garantía por permanencia</b></span>${UI.sw(s.garantia,'data-act="sw" data-k="garantia"')}</div>`+
          `<label class="lbl">Aplicar desde</label><input class="inp" type="date" data-m="desde" value="${X(s.desde)}">${UI.btn({t:'Inicio de esta semana',i:'cal',cls:'sec',a:'data-act="semana"'})}`+
          UI.btn({t:'Guardar tarifa',i:'check',cls:'ok',a:'data-act="guardaTarifa"'});
      }
      return tab+b;
    },
    adicionales(s){
      const col={Taxi:'var(--c-taxi)','Expo Vino':'var(--c-adic)',Movilidad:'var(--c-apoyo)'},cc=['var(--c-mano)','var(--c-foto)','var(--c-buscar)'];
      let b=`<div class="chips">${s.tipos.map((t,i)=>UI.chip(X(t),t===s.tipo,`data-act="selTipo" data-id="${X(t)}"`,col[t]||cc[i%3])).join('')}${UI.chip(I('plus')+'Nuevo tipo',false,'data-act="addTipo"','var(--c-ajustes)')}</div>`;
      if(s.addTipo)b+=`<div style="display:flex;gap:8px"><input class="inp" data-m="nuevoTipo" placeholder="Nombre del tipo" value="${X(s.nuevoTipo)}">${UI.btn({t:'Listo',cls:'ok sm',a:'data-act="okTipo"'})}</div>`;
      if(s.tipo==='Expo Vino'){
        const ver=s.todasZ?s.expo:s.expo.slice(0,5);
        b+=`<div class="aju-row"><b>Zonas del reparto</b>${UI.pill(s.expo.length+' zonas','acc')}</div>`+ver.map((z,i)=>`<div class="aju-zona" style="grid-template-columns:1fr 100px"><input class="inp" data-m="expo" data-i="${i}" data-f="n" value="${X(z.n)}"><div class="aju-sol"><input class="inp" inputmode="decimal" data-m="expo" data-i="${i}" data-f="m" value="${X(z.m)}"></div></div>`).join('')+
          UI.btn({t:s.todasZ?'Ver menos':`Ver las ${s.expo.length} zonas`,cls:'sec',i:'chev',a:'data-act="todasZ"'})+
          `<label class="lbl">Pegar tabla de tarifas (zona y monto por línea)</label><textarea class="inp" data-m="pegar" placeholder="San Borja 8.50&#10;La Molina 9.00">${X(s.pegar)}</textarea>`+UI.btn({t:'Leer la tabla pegada',i:'list',cls:'sec',a:'data-act="pegaTabla"'});
      }else if(s.tipo==='Taxi')b+=`<label class="lbl">Tarifa por kilómetro</label><div class="aju-sol"><input class="inp" inputmode="decimal" data-m="taxiKm" value="${X(s.taxiKm)}"></div><p class="tiny">Ejemplo: 8.2 km → ${fmt.sol(Math.round(parseFloat(sol(s.taxiKm))*8.2*100))}</p>`;
      else b+=`<label class="lbl">Monto por viaje de ${X(s.tipo)}</label><div class="aju-sol"><input class="inp" inputmode="decimal" data-m="movil" value="${X(s.movil)}"></div>`;
      return b+UI.btn({t:'Guardar adicionales',i:'check',cls:'ok',a:'data-act="guardaAd"'});
    },
    comandas(s){
      const L=['Guardar el nombre del cliente','Guardar la dirección','Guardar el teléfono','Guardar la foto de la comanda','Incluir clientes en el respaldo'],IC=['user','pin','phone','foto','nube'];
      return L.map((t,i)=>`<div class="aju-row"><span style="display:flex;gap:10px;align-items:center"><span class="fig" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;color:#fff;background:var(--c-buscar)">${I(IC[i])}</span><b>${t}</b></span>${UI.sw(s.coms[i],`data-act="swc" data-i="${i}"`)}</div>`).join('');
    },
    bloqueo(s){
      const b=s.bq;
      return `<p class="aju-txt">${b.on?'<b>El PIN está activo.</b> Se pedirá al abrir la app.':'Elige un PIN de 4 números para proteger los datos de tus clientes.'}</p>`+
        (b.on?'':dots(b.pin,false)+pad()+UI.btn({t:'Activar el PIN',i:'lock',cls:b.pin.length<4?'dis':'',a:'data-act="activaPin"'}))+
        (b.on?UI.btn({t:'Quitar el PIN',i:'trash',cls:'bad',a:'data-act="quitaPin"'}):'')+
        `<div class="aju-row"><span><b>Usar huella</b><small>Entrar sin escribir el PIN</small></span>${UI.sw(b.huella,'data-act="swh"')}</div>`;
    },
    licencia(s){
      const act=App.state.licencia==='activa',pos=act?'20%':'62%';
      return `<div class="aju-row"><span><b>${act?'Licencia activa':'Licencia vencida'}</b><small>${act?'Hasta el 29/11/2026':'Estás en los 7 días de gracia'}</small></span>${UI.pill(act?'Activa':'Gracia',act?'ok':'warn')}</div>`+
        `<div class="aju-lic" style="--pos:${pos}"><div class="aju-pista"><span class="a"></span><span class="b"></span><span class="c"></span><i class="aju-cubre"></i></div><div class="aju-coche">${CAR(40)}</div><div class="aju-etq"><span>Mes pagado</span><span>7 días de gracia</span><span>Solo lectura</span></div></div>`+
        `<label class="lbl">1. El código de este teléfono</label><div class="aju-caja mono" style="font-size:16px;text-align:center">${s.cod}</div>${UI.btn({t:'Copiar el código',i:'copy',cls:'sec',a:'data-act="copiaCod"'})}`+
        `<label class="lbl">2. Pega aquí la licencia</label><textarea class="inp" data-m="lic" placeholder="Pega aquí la licencia que te enviamos">${X(s.lic)}</textarea>`+
        (act?UI.aviso('Licencia activada. <b>Hasta el 29/11/2026</b>','ok'):'')+UI.btn({t:act?'Volver a activar':'Activar',i:'key',a:'data-act="activa"',c:'var(--c-licencia)'});
    },
    respaldo(s){
      return `<div class="aju-row"><span><b>Incluir las fotos</b><small>El archivo pesa más</small></span>${UI.sw(s.fotos,'data-act="sw" data-k="fotos"')}</div>`+
        `<p class="tiny">Último respaldo: ${s.ultimo}</p>`+UI.btn({t:'Crear y compartir',i:'share',a:'data-act="crea"'})+
        UI.btn({t:'Restaurar un respaldo',i:'download',cls:'sec',a:'data-act="pide" data-id="rest"'})+
        conf(s,'rest','Se reemplazarán los datos de este teléfono por los del respaldo.','Sí, restaurar','restaura');
    },
    terminos(){return `<div class="aju-caja" style="font:600 14px/1.5 var(--f-body)">Control Driver guarda tus datos solo en este teléfono. No los envía a ningún servidor ni los comparte con la empresa.\n\nLos nombres, teléfonos y direcciones de los clientes son datos personales: úsalos solo para entregar sus pedidos.\n\nTú eres responsable de tus respaldos. Si pierdes el teléfono sin respaldo, no podremos recuperar tus datos.\n\nLa licencia se paga por mes; si vence, la app sigue abierta en solo lectura.</div>`+UI.btn({t:'Entendido',i:'check',cls:'sec',a:'data-toast="Gracias por leerlos"'})},
    ejemplo(s){
      return `<p class="aju-txt">Llena la app con pedidos de prueba para ver cómo funciona. <b>No se mezclan con los tuyos.</b></p>`+
        UI.btn({t:'Cargar datos de ejemplo',i:'gift',a:'data-act="pide" data-id="cargaej"',c:'var(--c-mano)'})+conf(s,'cargaej','Se añadirán 10 pedidos de ejemplo al día de hoy.','Sí, cargarlos','cargaej','ok')+
        UI.btn({t:'Borrar los datos de ejemplo',i:'trash',cls:'sec',a:'data-act="pide" data-id="borraej"'})+conf(s,'borraej','Se borrarán solo los pedidos de ejemplo.','Sí, borrarlos','borraej');
    },
    diag(s){
      const t=`Control Driver 1.29\nBase de datos: abierta (SQLite 1.11.0)\nPedidos hoy: ${App.state.pedidos}\nLicencia: ${App.state.licencia}\nCara: ${s.cara}\nTienda: ${s.tienda}\nÚltima lectura de captura: sin errores\nAlmacenamiento: 18.4 MB`;
      s._diag=t;return `<div class="aju-caja">${X(t)}</div>${UI.btn({t:'Copiar',i:'copy',cls:'sec',a:'data-act="copiaDiag"'})}`;
    }
  };
  function stp(k,v,paso,f,min=0,max=99999){return `<div class="stepper"><button type="button" aria-label="Menos" data-act="step" data-k="${k}" data-d="${-paso}" data-min="${min}" data-max="${max}">−</button><output>${f(v)}</output><button type="button" aria-label="Más" data-act="step" data-k="${k}" data-d="${paso}" data-min="${min}" data-max="${max}">+</button></div>`}

  /* captura de campos de texto sin redibujar */
  function montaCampos(el,ctx){
    el.querySelectorAll('[data-m]').forEach(inp=>inp.addEventListener('input',()=>{
      const s=ctx.s,k=inp.dataset.m;
      if(inp.dataset.i!=null){const f=s[k]&&s[k][+inp.dataset.i];if(f)f[inp.dataset.f]=inp.value}else s[k]=inp.value;
    }));
  }

  App.screen('ajustes',{titulo:'Ajustes',icono:'gear',tab:null,grupo:'Más',
    cambios:['Un menú de 11 tarjetas de color con figura en lugar de una lista de acordeones iguales','Cada tarjeta dice su estado en una línea: «Mapa», «Meta S/ 150»…','Tocar una abre solo ese panel a pantalla, con botón para volver','Tarifa con tres botones grandes (Única, Por km, Por zona) y confeti al guardar','Licencia con una barra animada y dos pasos numerados'],
    render(ctx){
      const s=ini(ctx.s);
      if(ctx.p.abre&&ctx.p._v!==1){ctx.p._v=1;s.abre=ctx.p.abre}
      const sal=`<div style="margin-top:14px">${UI.btn({t:'Salir de la app',i:'x',cls:'bad',a:'data-act="pide" data-id="salir"'})}${conf(s,'salir','¿Cerrar Control Driver? Tus datos quedan guardados.','Sí, salir','salir')}</div>`;
      if(s.abre){
        const d=SEC.find(x=>x[0]===s.abre);
        return `<div class="aju-cab" style="background:${d[3]}"><span class="fig">${I(d[2])}</span><span><b>${d[1]}</b><small>${d[4](s)}</small></span><button type="button" class="atras" data-act="cierra">${I('back')}Ajustes</button></div><div class="aju-pan">${CUERPO[d[0]](s)}</div>${sal}`;
      }
      return `<div class="aju-ver rise"><span class="fig ${s.bus?'girando':''}">${I(s.bus?'refresh':'phone')}</span><span><b>Control Driver 1.29</b><small>${s.bus?'Buscando…':'Estás al día'}</small></span><button type="button" class="btn ${s.bus?'girando':''}" data-act="buscaAct">${I('refresh')}Buscar actualización</button></div>`+
        `<div class="grid2">${SEC.map((d,i)=>`<button type="button" class="tile aju-card rise d${(i%6)+1}" style="background:${d[3]}" data-act="abrePanel" data-id="${d[0]}"><span class="brillo"></span><span class="big">${I(d[2])}</span><span class="fig">${I(d[2])}</span><span><b>${d[1]}</b><small>${X(d[4](s))}</small></span></button>`).join('')}</div>`+sal;
    },
    mount:montaCampos,
    acts:{
      abrePanel(el,e,c){c.s.abre=el.dataset.id;c.s.conf=null},
      cierra(el,e,c){c.s.abre=null;c.s.conf=null},
      buscaAct(el,e,c){const s=c.s;if(s.bus)return false;s.bus=1;setTimeout(()=>{s.bus=0;if(App.cur().id==='ajustes'){App.toast('Ya tienes la última versión');App.refresh()}},1200)},
      cara(el,e,c){c.s.cara=el.dataset.id;if(!aplicaCara(el.dataset.id))App.toast('Demostración: esta cara no cambia el prototipo');else App.toast('Cara cambiada')},
      step(el,e,c){const k=el.dataset.k,v=(+c.s[k])+(+el.dataset.d);c.s[k]=Math.min(+el.dataset.max,Math.max(+el.dataset.min,v))},
      sw(el,e,c){c.s[el.dataset.k]=!c.s[el.dataset.k]},
      swc(el,e,c){const i=+el.dataset.i;c.s.coms[i]=!c.s.coms[i]},
      swh(el,e,c){c.s.bq.huella=!c.s.bq.huella},
      set(el,e,c){c.s[el.dataset.k]=el.dataset.v},
      guardaMetas(el,e,c){App.confetti();App.toast('¡Metas guardadas!');c.s.abre=null},
      selT(el,e,c){c.s.tienda=el.dataset.id},
      addT(el,e,c){c.s.addT=!c.s.addT},
      okT(el,e,c){const n=(c.s.nuevaT||'').trim();if(n){c.s.tiendas.push(n);c.s.tienda=n;c.s.nuevaT='';c.s.addT=false;App.toast('Tienda agregada')}else App.toast('Escribe el nombre','warn')},
      aqui(el,e,c){c.s.ubi=true;App.toast('Ubicación guardada')},
      quitaUbi(el,e,c){c.s.ubi=false;App.toast('Ubicación quitada','warn')},
      zonaAdd(el,e,c){if(c.s.zonas.length<5)c.s.zonas.push({n:'',m:'0.00'})},
      zonaDel(el,e,c){c.s.zonas.splice(+el.dataset.i,1)},
      semana(el,e,c){c.s.desde='2026-10-26';App.toast('Desde el lunes 26 de octubre')},
      guardaTarifa(el,e,c){App.confetti();App.toast('¡Tarifa guardada!')},
      selTipo(el,e,c){c.s.tipo=el.dataset.id},
      addTipo(el,e,c){c.s.addTipo=!c.s.addTipo},
      okTipo(el,e,c){const n=(c.s.nuevoTipo||'').trim();if(n&&!c.s.tipos.includes(n)){c.s.tipos.push(n);c.s.tipo=n;c.s.nuevoTipo='';c.s.addTipo=false;App.toast('Tipo creado')}else App.toast('Escribe un nombre nuevo','warn')},
      todasZ(el,e,c){c.s.todasZ=!c.s.todasZ},
      pegaTabla(el,e,c){const s=c.s,out=[];(s.pegar||'').split(/\n/).forEach(l=>{const m=l.trim().match(/^(.*?)[\s;,\t]+(?:S\/\s*)?(\d+(?:[.,]\d+)?)$/);if(m)out.push({n:m[1].trim(),m:sol(m[2])})});
        if(out.length){s.expo=out;s.pegar='';s.todasZ=false;App.confetti();App.toast(out.length+' zonas leídas')}else App.toast('No encontré zonas en el texto','warn')},
      guardaAd(el,e,c){App.confetti();App.toast('¡Adicionales guardados!')},
      key(el,e,c){const b=c.s.bq;if(b.pin.length<4)b.pin+=el.dataset.d},
      borrar(el,e,c){c.s.bq.pin=c.s.bq.pin.slice(0,-1)},
      activaPin(el,e,c){if(c.s.bq.pin.length<4){App.toast('Pon 4 números','warn');return}c.s.bq.on=true;App.confetti();App.toast('PIN activado')},
      quitaPin(el,e,c){c.s.bq=Object.assign(c.s.bq,{on:false,pin:''});App.toast('PIN quitado','warn')},
      copiaCod(el,e,c){copiar(c.s.cod);App.toast('Código copiado');return false},
      activa(el,e,c){App.state.licencia='activa';App.confetti();App.toast('¡Licencia activada hasta el 29/11/2026!')},
      copiaDiag(el,e,c){copiar(c.s._diag||'');App.toast('Copiado');return false},
      pide(el,e,c){c.s.conf=el.dataset.id},
      noconf(el,e,c){c.s.conf=null},
      crea(el,e,c){c.s.ultimo='hoy, 10:24';App.confetti();App.toast('Respaldo listo para compartir')},
      restaura(el,e,c){c.s.conf=null;App.toast('Respaldo restaurado')},
      cargaej(el,e,c){c.s.conf=null;App.state.pedidos=10;App.confetti();App.toast('Datos de ejemplo cargados')},
      borraej(el,e,c){c.s.conf=null;App.state.pedidos=0;App.toast('Datos de ejemplo borrados','warn')},
      salir(el,e,c){c.s.conf=null;App.toast('Hasta pronto');App.go('bloqueo')}
    }
  });

  /* ---------------- tutoriales ---------------- */
  const TUT=[
    {id:'inicio',t:'Inicio',s:'Cargar y ver tu día',c:'var(--acc)',i:'home',temas:[
      {t:'Cargar el resumen del día',go:'inicio',p:['Toca el botón redondo «Cargar» de abajo.','Elige las capturas de la tienda.','Revisa que los totales cuadren.','Pulsa «Confirmar y guardar».']},
      {t:'Anotar una comanda',go:'inicio',p:['En Inicio, abre «Pedidos de mi tienda».','Toca «Leer una comanda» y haz la foto.','Corrige lo dudoso en amarillo.','Guarda: el pedido queda con su cliente.']},
      {t:'Marcar un día de descanso',go:'inicio',p:['Mantén presionado el día en la tira.','Toca «Marcar descanso».','Verás la lunita en ese día.']}]},
    {id:'pagos',t:'Pagos',s:'Cuánto llevas y cuánto cobras',c:'var(--c-pagos)',i:'wallet',temas:[
      {t:'Ver cuánto llevo en la semana',go:'pagos',p:['Entra a Pagos.','Mira la carretera: el auto avanza hacia tu meta.','Toca una fuente para ver sus días.']},
      {t:'Cotejar con la empresa',go:'pagos',p:['En Pagos, toca «Subir el reporte de la empresa».','Elige la imagen del reporte.','Marca los pedidos que coinciden.','Mira los que la empresa no contó.']}]},
    {id:'stats',t:'Estadísticas e historial',s:'Compara y busca',c:'var(--c-stats)',i:'bars',temas:[
      {t:'Comparar dos semanas',go:'stats',p:['Entra a Estadísticas.','Toca la pestaña «Comparar».','Elige la semana con las flechas.','Mira el cambio, cifra por cifra.']},
      {t:'Buscar un pedido por su código',go:'buscar',p:['Abre «Más» y toca Buscar.','Escribe el código.','Toca el resultado para abrirlo.']}]},
    {id:'ajustes',t:'Ajustes',s:'Tu tienda, tarifa y licencia',c:'var(--c-ajustes)',i:'gear',temas:[
      {t:'Poner mi tarifa',go:'ajustes',gp:{abre:'tienda'},p:['Abre Ajustes y toca «Tienda y tarifa».','Entra a la pestaña Tarifa.','Elige Única, Por km o Por zona.','Pulsa «Guardar tarifa».']},
      {t:'Activar mi licencia',go:'ajustes',gp:{abre:'licencia'},p:['Toca la tarjeta «Licencia».','Copia el código de tu teléfono y envíalo.','Pega la licencia que te respondan.','Pulsa «Activar».']},
      {t:'Hacer un respaldo',go:'ajustes',gp:{abre:'respaldo'},p:['Abre «Respaldo».','Decide si incluyes las fotos.','Pulsa «Crear y compartir».']}]}];

  App.screen('tutoriales',{titulo:'Tutoriales',icono:'book',tab:null,grupo:'Más',
    cambios:['Cuatro tarjetas grandes de color en lugar de una lista de texto','Cada tema muestra sus pasos como una línea de tiempo numerada','«Ver recorrido» te lleva a la pantalla real con un aviso'],
    render(ctx){
      const s=ctx.s;
      return UI.titulo('Aprende en un minuto','Toca un grupo y elige un tema')+TUT.map((g,gi)=>{
        const ab=s.g===g.id;
        return `<div class="rise d${gi+1}" style="margin-bottom:12px"><button type="button" class="aju-tut" style="background:${g.c}" aria-expanded="${ab}" data-act="grupo" data-id="${g.id}"><i class="c1"></i><i class="c2"></i><span class="fig">${I(g.i)}</span><span><b>${g.t}</b><small>${g.s} · ${g.temas.length} temas</small></span>${I('chev','chev')}</button>`+
          (ab?`<div class="aju-temas">${g.temas.map((t,ti)=>{
            const k=g.id+'.'+ti,o=s.t===k;
            return `<div class="card" style="padding:0;overflow:hidden"><button type="button" class="fila" aria-expanded="${o}" data-act="tema" data-id="${k}"><span class="fig" style="background:${g.c}">${I(o?'eye':'book')}</span><span><b>${t.t}</b><small>${t.p.length} pasos</small></span>${I(o?'chev':'fwd','flecha')}</button>`+
              (o?`<div style="padding:4px 14px 14px"><ol class="aju-linea" style="--tc:${g.c}">${t.p.map((p,n)=>`<li><i>${n+1}</i>${p}</li>`).join('')}</ol><button type="button" class="btn" style="background:${g.c}" data-go="${t.go}" data-p='${JSON.stringify(t.gp||{})}' data-toast="Recorrido: ${t.t}">${I('route')}Ver recorrido</button></div>`:'')+`</div>`}).join('')}</div>`:'')+`</div>`}).join('');
    },
    acts:{
      grupo(el,e,c){c.s.g=c.s.g===el.dataset.id?null:el.dataset.id;c.s.t=null},
      tema(el,e,c){c.s.t=c.s.t===el.dataset.id?null:el.dataset.id}
    }
  });

  /* ---------------- acerca de ---------------- */
  App.screen('acerca',{titulo:'Acerca de',icono:'info',tab:null,grupo:'Más',
    cambios:['Una escena con el carro en marcha en lugar de un icono y texto','El teléfono es un botón de llamar y otro de copiar el número','Versión y derechos en una sola tarjeta'],
    render(ctx){
      return `<div class="aju-cent rise"><div class="card" style="width:100%;padding:0;overflow:hidden"><svg viewBox="0 0 340 190" width="100%" role="img" aria-label="Un carro recorre la calle"><rect width="340" height="190" style="fill:var(--acc-soft)"/><circle cx="270" cy="44" r="22" style="fill:var(--sun)"/><g style="fill:var(--surf)"><rect x="24" y="70" width="46" height="70" rx="6"/><rect x="78" y="48" width="56" height="92" rx="6"/><rect x="142" y="82" width="40" height="58" rx="6"/><rect x="200" y="58" width="52" height="82" rx="6"/></g><g style="fill:var(--acc)" opacity=".35"><rect x="34" y="82" width="10" height="10"/><rect x="50" y="82" width="10" height="10"/><rect x="90" y="62" width="10" height="10"/><rect x="108" y="62" width="10" height="10"/><rect x="212" y="72" width="10" height="10"/><rect x="230" y="72" width="10" height="10"/></g><rect y="140" width="340" height="50" style="fill:var(--ink2)"/><path class="aju-via" d="M0 168H340" stroke="#fff" stroke-width="4" fill="none"/><g class="aju-auto"><g transform="translate(120 112)">${CAR(100)}</g></g></svg></div>`+
        `<h2>Control Driver</h2><div class="row"><span class="pill acc">Versión 1.29</span></div><p class="muted">© 2026 Control Driver. Todos los derechos reservados.</p>`+
        `<div style="width:100%;display:flex;flex-direction:column;gap:10px">${UI.btn({t:'Llamar al 984 368 710',i:'phone',cls:'ok',a:'data-toast="Demostración: llamando al 984 368 710…"'})}${UI.btn({t:'Copiar el número',i:'copy',cls:'sec',a:'data-act="copia"'})}</div></div>`;
    },
    acts:{copia(el,e,c){copiar('984368710');App.toast('Número copiado');return false}}
  });

  /* ---------------- bloqueo ---------------- */
  function desbloquea(){App.confetti();App.toast('¡Bienvenido!');App.go('inicio')}
  App.screen('bloqueo',{titulo:'Bloqueado',icono:'lock',tab:null,grupo:'Sistema',
    cambios:['Cuatro puntos que se llenan y un teclado grande en pantalla','Si el PIN falla, los puntos se sacuden y se pone rojo el aviso','Huella y «¿Olvidaste el PIN?» son botones, no enlaces','PIN de ejemplo: 1234'],
    render(ctx){
      const s=ctx.s,pin=s.pin||'';
      return `<div class="aju-cent rise" style="padding-top:6px"><div style="width:72px;height:72px;border-radius:24px;background:var(--c-licencia);color:#fff;display:grid;place-items:center" class="${s.hue?'aju-huella on':''}">${I('lock')}</div><h2>Control Driver está bloqueado</h2><p class="muted">Escribe tu PIN de 4 números</p>`+
        `<div class="${s.err?'aju-sacude':''}" style="width:100%">${dots(pin,s.err)}</div>`+
        `<p style="color:var(--bad);font-weight:800;min-height:22px">${s.err?'Ese PIN no es correcto.':''}</p>`+
        pad(`<button type="button" class="acc aju-huella ${s.hue?'on':''}" aria-label="Usar huella" data-act="huella">${I('finger')}</button>`)+
        `<div style="width:100%;display:flex;flex-direction:column;gap:8px;margin-top:6px">${UI.btn({t:'Usar huella',i:'finger',cls:'sec aju-huella '+(s.hue?'on':''),a:'data-act="huella"'})}${UI.btn({t:'¿Olvidaste el PIN?',i:'key',cls:'ghost',a:'data-act="olvido"'})}</div>`+
        (s.olv?UI.aviso('Sin el PIN no se puede entrar. Si tienes un respaldo, puedes borrar la app, instalarla otra vez y restaurarlo.','warn'):'')+`</div>`;
    },
    acts:{
      key(el,e,c){const s=c.s;if(s.busy)return false;s.err=false;s.pin=s.pin||'';if(s.pin.length>=4)return false;s.pin+=el.dataset.d;
        if(s.pin.length===4){s.busy=1;setTimeout(()=>{s.busy=0;if(App.cur().id!=='bloqueo')return;if(s.pin==='1234'){s.pin='';desbloquea()}else{s.err=true;s.pin='';App.refresh()}},260)}},
      borrar(el,e,c){if(c.s.busy)return false;c.s.pin=(c.s.pin||'').slice(0,-1);c.s.err=false},
      huella(el,e,c){const s=c.s;if(s.busy)return false;s.busy=1;s.hue=true;s.err=false;setTimeout(()=>{s.busy=0;s.hue=false;if(App.cur().id==='bloqueo'){s.pin='';desbloquea()}},900)},
      olvido(el,e,c){c.s.olv=!c.s.olv}
    }
  });

  /* ---------------- aviso legal ---------------- */
  App.screen('legal',{titulo:'Antes de empezar',icono:'shield',tab:null,grupo:'Sistema',
    cambios:['Un escudo grande abre la pantalla en vez de un muro de texto','El aviso va en un acordeón; solo lo lees si quieres','«Aceptar y continuar» se enciende cuando marcas la casilla grande'],
    render(ctx){
      const s=ctx.s;
      return `<div class="card rise aju-cent" style="padding:18px"><svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="54" style="fill:var(--acc-soft)"/><g class="aju-escudo"><path d="M60 22l30 11v22c0 20-13 32-30 38-17-6-30-18-30-38V33z" style="fill:var(--acc)"/><path d="M45 58l11 11 20-22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g></svg><h2>Antes de empezar</h2><p class="muted">Tus clientes confían en ti. Cuida sus datos.</p></div>`+
        `<div style="margin-top:12px">${UI.ac({id:'aviso',t:'Aviso legal y protección de datos de tus clientes',k:'licencia',i:'doc',body:'<p class="aju-txt">Los nombres, teléfonos y direcciones de tus clientes son <b>datos personales</b>. Guárdalos solo para entregar sus pedidos y no los compartas.</p><p class="aju-txt">La app los guarda únicamente en tu teléfono. Si haces un respaldo, el archivo también los contiene: cuídalo.</p><p class="aju-txt">Puedes borrar los datos de un cliente cuando quieras desde su pedido.</p>'})}</div>`+
        `<button type="button" class="aju-check" style="margin-top:12px" aria-pressed="${!!s.ok}" data-act="acepto"><span class="caja">${I('check')}</span><span>He leído y acepto el aviso legal</span></button>`+
        `<div style="display:flex;flex-direction:column;gap:10px;margin-top:14px"><button type="button" id="aju-acepta" class="btn ok ${s.ok?'':'dis'}" data-act="acepta">${I('check')}Aceptar y continuar</button>${UI.btn({t:'No acepto',cls:'sec',a:'data-act="rechaza"'})}</div>`;
    },
    acts:{
      acepto(el,e,c){c.s.ok=!c.s.ok;el.setAttribute('aria-pressed',!!c.s.ok);const b=document.getElementById('aju-acepta');if(b)b.classList.toggle('dis',!c.s.ok);return false},
      acepta(el,e,c){if(!c.s.ok){App.toast('Marca la casilla primero','warn');return false}App.confetti();App.toast('¡Listo, bienvenido!');App.go('inicio');return false},
      rechaza(el,e,c){App.toast('Sin aceptar no se puede usar la app','warn');return false}
    }
  });

  /* ---------------- sin conexión ---------------- */
  App.screen('sinconexion',{titulo:'Sin conexión',icono:'wifioff',tab:null,grupo:'Sistema',
    cambios:['Una ilustración animada explica la situación de un vistazo','Dos botones llevan a lo que sí funciona sin red','Dice sin rodeos que cargar capturas necesita internet'],
    render(ctx){
      return `<div class="aju-cent rise" style="padding-top:8px"><svg viewBox="0 0 200 160" width="220" aria-hidden="true"><circle class="aju-onda" cx="100" cy="86" r="40" style="fill:var(--warn-soft)"/><circle class="aju-onda d" cx="100" cy="86" r="40" style="fill:var(--warn-soft)"/><g class="aju-nube"><path d="M62 112a22 22 0 010-44 32 32 0 0161 8 19 19 0 013 36z" style="fill:var(--warn)"/><path d="M80 80l40 40M120 80L80 120" stroke="#fff" stroke-width="7" stroke-linecap="round" transform="translate(0 -4) scale(1) "/></g></svg><h2>Sin conexión</h2><p class="muted">Tu historial y tus estadísticas siguen disponibles. Para cargar capturas necesitas internet.</p>`+
        `<div style="width:100%;display:flex;flex-direction:column;gap:10px;margin-top:6px">${UI.fila({k:'historial',t:'Ver el historial',s:'Tus pedidos guardados',a:'data-go="historial"'})}${UI.fila({k:'stats',t:'Ver estadísticas',s:'Tu semana y tu mes',a:'data-go="stats"'})}</div>`+UI.aviso('Cuando vuelva la señal, todo seguirá como lo dejaste.','warn','wifioff')+`</div>`;
    }
  });

  /* ---------------- error ---------------- */
  App.screen('error',{titulo:'Algo falló',icono:'warn',tab:null,grupo:'Sistema',
    cambios:['Un triángulo que se mueve y una sola frase, sin términos técnicos','Tres botones claros: reintentar, ir al inicio, ver el detalle','El detalle para soporte queda escondido, con botón Copiar'],
    render(ctx){
      const det='Error: TypeError: Cannot read properties of undefined (reading \'pedidos\')\n  en Pantalla.render (pagos.js:214)\n  en App.draw (app.js:88)\nVersión 1.29 · 29/10/2026 10:24 · pantalla: pagos';ctx.s._det=det;
      return `<div class="aju-cent rise" style="padding-top:8px"><svg viewBox="0 0 120 110" width="150" aria-hidden="true"><g class="aju-wob"><path d="M60 8l52 92H8z" style="fill:var(--warn)" stroke="var(--warn)" stroke-width="8" stroke-linejoin="round"/><path d="M60 40v28M60 80v.01" stroke="#fff" stroke-width="9" stroke-linecap="round"/></g></svg><h2>Esta pantalla no se pudo mostrar</h2><p class="muted">No perdiste nada. Intenta de nuevo.</p>`+
        `<div style="width:100%;display:flex;flex-direction:column;gap:10px">${UI.btn({t:'Volver a intentar',i:'refresh',a:'data-act="reintenta"'})}${UI.btn({t:'Ir al inicio',i:'home',cls:'sec',a:'data-go="inicio"'})}</div>`+
        `<div style="width:100%;text-align:left">${UI.ac({id:'det',t:'Detalle para soporte',i:'doc',c:'var(--c-ajustes)',body:`<div class="aju-caja">${X(det)}</div>${UI.btn({t:'Copiar',i:'copy',cls:'sec',a:'data-act="copia"'})}`})}</div></div>`;
    },
    acts:{
      reintenta(el,e,c){App.toast('Intentando de nuevo…');setTimeout(()=>{if(App.cur().id==='error')App.go('inicio')},500);return false},
      copia(el,e,c){copiar(c.s._det||'');App.toast('Detalle copiado');return false}
    }
  });
})();
