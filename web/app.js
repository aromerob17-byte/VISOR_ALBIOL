const el=id=>document.getElementById(id);
const numero=v=>new Intl.NumberFormat('es-ES').format(v||0);
function barras(id,items){
 const root=el(id);root.replaceChildren();
 if(!items.length){const p=document.createElement('p');p.textContent='Sin datos todavía.';root.append(p);return;}
 const max=Math.max(1,...items.map(i=>i.valor));
 for(const i of items){
  const row=document.createElement('div');row.className='chartrow';
  const t=document.createElement('span');t.textContent=i.nombre;
  const track=document.createElement('div');track.className='charttrack';
  const bar=document.createElement('div');bar.className='bar';
  bar.style.width=(100*i.valor/max)+'%';track.append(bar);
  const v=document.createElement('span');v.textContent=numero(i.valor);
  row.append(t,track,v);root.append(row);
 }
}
function tabla(posts){
 const root=el('tabla');root.replaceChildren();
 if(!posts.length){root.textContent='No hay publicaciones para este filtro.';return;}
 const table=document.createElement('table'),head=document.createElement('thead');
 head.innerHTML='<tr><th>Publicación</th><th>Idioma</th><th>Interacciones</th></tr>';
 table.append(head);const body=document.createElement('tbody');
 for(const p of posts){
  const row=document.createElement('tr');
  const c=document.createElement('td'),a=document.createElement('a');
  a.textContent='@'+p.autor+' · '+new Date(p.fecha).toLocaleDateString('es-ES');
  a.href=p.url;a.target='_blank';a.rel='noopener noreferrer';c.append(a);
  const lang=document.createElement('td');lang.textContent=p.idioma;
  const n=document.createElement('td');n.textContent=numero(p.interacciones);
  row.append(c,lang,n);body.append(row);
 }
 table.append(body);root.append(table);
}
async function init(){
 try{
  const response=await fetch('./data/public/resumen.json',{cache:'no-store'});
  if(!response.ok)throw Error('No se pudo cargar el resumen');
  const d=await response.json();
  el('total').textContent=numero(d.total_posts);
  el('autores').textContent=numero(d.total_autores);
  el('propios').textContent=numero(d.publicaciones_albiol);
  el('catalan').textContent=numero(d.idiomas?.ca);
  el('ultima').textContent=d.actualizado_en?'Última recopilación: '+new Date(d.actualizado_en).toLocaleString('es-ES'):'Pendiente de primera recopilación (sin consultas a X)';
  barras('dias',(d.por_dia||[]).map(x=>({nombre:x.fecha,valor:x.posts})));
  const idiomas={es:'Castellano',ca:'Catalán',mixto:'Mixto',otro:'Otros',indeterminado:'Indeterminado'};
  barras('idiomas',Object.entries(d.idiomas||{}).map(([k,v])=>({nombre:idiomas[k]||k,valor:v})));
  barras('temas',(d.temas||[]).map(x=>({nombre:x.tema,valor:x.posts})));
  barras('fuentes',Object.entries(d.fuentes||{}).map(([k,v])=>({nombre:k.length>18?k.slice(0,17)+'…':k,valor:v})));
  const posts=d.top_interacciones||[];
  el('filtro').addEventListener('change',()=>{const v=el('filtro').value;tabla(v==='todos'?posts:posts.filter(p=>p.idioma===v));});
  tabla(posts);el('avisos').textContent=(d.avisos||[]).join(' · ');
 }catch(e){el('ultima').textContent='Error: '+e.message;}
}
init();
