
/* ===== recorridos rápidos (los flujos más usados) y arranque ===== */
(function(){
  const R=[
    ['Anotar pedidos de una comanda',()=>{App.go('inicio');App.openSheet('subirmas')}],
    ['Ver cuánto llevo hoy',()=>App.go('inicio')],
    ['Corregir un pedido',()=>{App.go('inicio');App.openSheet('pedido',{i:0})}],
    ['Registrar Expo Vino por zonas',()=>{App.go('inicio');App.openSheet('adicional',{tipo:'Expo Vino'})}],
    ['Registrar apoyo a otra tienda',()=>{App.go('inicio');App.openSheet('apoyo')}],
    ['Revisar la semana y cotejar con la empresa',()=>{App.go('pagos');App.openSheet('cotejo')}],
    ['Cargar el resumen del día',()=>App.openSheet('cargar')],
    ['Activar mi licencia',()=>App.go('ajustes',{abre:'licencia'})]
  ];
  $('#recorridos').innerHTML=R.map(([t],i)=>`<button type="button" data-r="${i}"><i>${i+1}</i>${t}</button>`).join('');
  $('#recorridos').addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(b){R[+b.dataset.r][1]()}});
  App.start();
})();
