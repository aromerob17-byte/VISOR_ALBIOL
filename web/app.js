const $=id=>document.getElementById(id);
const number=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(Number(n)||0);
const compact=n=>new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);
const pct=(n,t)=>t?Math.round(1000*n/t)/10:0;
const dateTime=iso=>iso?new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)):'Sin datos';
const dateOnly=iso=>iso?new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'short'}).format(new Date(iso)):'—';
const LANGUAGES=[
  ['todos','Todos'],['es','Castellano'],['ca','Catalán'],
  ['mixto','Mixto'],['otro','Otros'],['indeterminado','Indet.']
];
const METRICS=[
  ['interacciones','Interacciones'],['impresiones','Impresiones'],
  ['likes','Me gusta'],['reposts','Reposts'],['respuestas','Respuestas'],['citas','Citas']
];
const LABEL_METRIC=Object.fromEntries(METRICS);
const COLORS={es:'#318ff1',ca:'#32c6b4',mixto:'#8b8fe3',otro:'#7487aa',indeterminado:'#425572'};
const state={language:'todos',generalMetric:'interacciones',albiolMetric:'interacciones',data:null};
function node(tag,klass,text){
  const n=document.createElement(tag);
  if(klass)n.className=klass;
  if(text!==undefined)n.textContent=text;
  return n;
}
function empty(parent,message='Todavía no hay datos para este filtro.'){
  parent.replaceChildren(node('div','empty-state',message));
}
function selector(id,options,current,change){
  const parent=$(id);parent.replaceChildren();
  for(const [value,label] of options){
    const b=node('button',value===current?'active':'',label);
    b.type='button';b.setAttribute('aria-pressed',String(value===current));
    b.addEventListener('click',()=>change(value));
    parent.append(b);
  }
}
function renderSelectors(){
  selector('language-controls',LANGUAGES,state.language,v=>{state.language=v;render();});
  selector('general-controls',METRICS,state.generalMetric,v=>{state.generalMetric=v;render();});
  selector('albiol-controls',METRICS,state.albiolMetric,v=>{state.albiolMetric=v;render();});
}
function renderOverview(){
  const d=state.data,scope=d.por_idioma?.[state.language]||d;
  const coverage=(scope.impresiones_cobertura??0);
  const cards=[
    ['Publicaciones únicas',scope.posts,'Sin republicaciones duplicadas'],
    ['Autores únicos',scope.autores,'Cuentas identificadas'],
    ['Interacciones',scope.interacciones,'Me gusta + reposts + respuestas + citas'],
    ['Impresiones',scope.con_impresiones?scope.impresiones:'—','Disponibles en '+number(scope.con_impresiones||0)+' publicaciones'],
    ['Publicaciones de Albiol',scope.propios,'Actividad propia capturada']
  ];
  const root=$('kpis');root.replaceChildren();
  for(const [label,value,description] of cards){
    const card=node('article','kpi'),small=node('small','',label),strong=node('strong','',typeof value==='number'?number(value):value),span=node('span','',description);
    card.append(small,strong,span);root.append(card);
  }
  $('hero-number').textContent=compact(d.interacciones);
  $('type-interactions').textContent=number(scope.interacciones);
  $('impressions-coverage').textContent=coverage.toLocaleString('es-ES',{maximumFractionDigits:1})+' %';
  $('header-updated').textContent='Corte · '+dateTime(d.actualizado_en);
  $('hero-status').textContent=d.total_posts?number(d.total_posts)+' publicaciones en el histórico':'Sin registros disponibles';
  $('data-status').textContent='Periodo observado: desde el 21/10/2026 · Última recopilación: '+dateTime(d.actualizado_en)+
      ' · Filtro: '+(LANGUAGES.find(x=>x[0]===state.language)?.[1]||'Todos')+
      ' · Datos capturados, no volumen completo de X.';
}
function renderDaily(){
  const chart=$('daily-chart');chart.replaceChildren();
  const dias=state.data.por_dia||[];
  if(!dias.length){empty(chart);return;}
  const filter=state.language;
  const counted=dias.map(d=>({date:d.fecha,langs:d.idiomas||{},value:filter==='todos'?d.posts:(d.idiomas?.[filter]||0)}));
  const max=Math.max(1,...counted.map(d=>d.value));
  for(const d of counted){
    const col=node('div','daily-col');
    const val=node('strong','',number(d.value));
    const track=node('div','daily-track');
    const bar=node('div','daily-stack');
    bar.style.height=(d.value?Math.max(3,150*d.value/max):2)+'px';
    if(filter==='todos'){
      const total=d.value||1;
      const entries=[['es',d.langs.es||0],['ca',d.langs.ca||0],['otro',(d.langs.otro||0)+(d.langs.mixto||0)+(d.langs.indeterminado||0)]];
      for(const [lang,n] of entries){
        const seg=node('i',lang);seg.style.height=(100*n/total)+'%';
        seg.title=lang+': '+number(n);bar.append(seg);
      }
    }else{
      const seg=node('i',filter==='ca'?'ca':filter==='es'?'es':'otro');seg.style.height='100%';bar.append(seg);
    }
    track.append(bar);
    const label=node('div','date',dateOnly(d.date+'T12:00:00Z'));
    col.append(val,track,label);chart.append(col);
  }
}
function renderLanguages(){
  const all=state.data.idiomas||{},sum=Object.values(all).reduce((a,b)=>a+b,0);
  const roots=$('language-bars');roots.replaceChildren();
  const entries=[['es','Castellano'],['ca','Catalán'],['mixto','Bilingüe / mixto'],['otro','Otros idiomas'],['indeterminado','Indeterminado']];
  let offset=0;const gradient=[];
  for(const [code,label] of entries){
    const count=all[code]||0;
    const share=100*count/(sum||1);
    gradient.push((COLORS[code]||'#8da')+' '+offset+'% '+(offset+share)+'%');
    offset+=share;
    const row=node('div','lang-row');
    const dot=node('b');dot.style.background=COLORS[code];
    const name=node('span','',label);
    const value=node('strong','',number(count));
    const small=node('small','',pct(count,sum).toLocaleString('es-ES')+' % del total');
    row.append(dot,name,value,small);roots.append(row);
  }
  $('lang-donut').style.background='conic-gradient('+gradient.join(', ')+')';
  $('lang-donut-value').replaceChildren(document.createTextNode(number(sum)),node('small','','publicaciones'));
}
function barRows(id,items,color=null){
  const root=$(id);root.replaceChildren();
  if(!items.length){empty(root);return;}
  const max=Math.max(1,...items.map(x=>x.count));
  for(const item of items){
    const row=node('div','bar-row'),label=node('label','',item.label),bar=node('div','bar-track'),fill=node('i');
    fill.style.width=(item.count/max*100)+'%';
    if(color)fill.style.background=color;
    bar.append(fill);
    const val=node('strong','',number(item.count));
    row.append(label,bar,val);root.append(row);
  }
}
function renderTopics(){
  const dictionary=state.data.temas_por_idioma?.[state.language]||{};
  const topics=Object.entries(dictionary).filter(([name])=>name!=='Sin clasificar')
       .sort((a,b)=>b[1]-a[1]).slice(0,6).map(([label,count])=>({label,count}));
  if(dictionary['Sin clasificar'])topics.push({label:'Sin clasificar',count:dictionary['Sin clasificar']});
  barRows('topic-bars',topics);
  const types=state.data.por_idioma?.[state.language]?.tipos||{};
  barRows('type-bars',[
    {label:'Respuestas',count:types.respuesta||0},
    {label:'Publicaciones originales',count:types.original||0},
    {label:'Citas',count:types.cita||0}
  ]);
}
function postLink(post,label){
  const link=node('a','',label);
  link.href=post.url;link.target='_blank';link.rel='noopener noreferrer';
  return link;
}
function badgeType(p){return p.propio?'Publicación de Albiol':p.tipo==='respuesta'?'Respuesta':p.tipo==='cita'?'Cita':'Publicación';}
function textExcerpt(p){
  const text=(p.texto||'').trim();
  return text||'Consulta el contenido en X';
}
function makeFeatured(post,metric){
 const card=node('article','post-feature');
 const top=node('div','post-topline');top.append(node('b','','01'),node('span','',badgeType(post)+' · Nº 1 por '+LABEL_METRIC[metric].toLowerCase()));
 const author=node('div','author-line');
 const icon=node('span','author-icon',(post.autor||'X').slice(0,2).toUpperCase());
 const user=node('div');
 user.append(node('strong','',post.autor),node('small','',(post.username?'@'+post.username+' · ':'')+dateTime(post.fecha)));
 const lang=node('span','lang-chip',LANGUAGES.find(x=>x[0]===post.idioma)?.[1]||post.idioma);
 author.append(icon,user,lang);
 const paragraph=node('p','feature-text',textExcerpt(post));
 const stats=node('div');
 stats.append(node('div','feature-stat',number(post[metric])));
 stats.lastChild.append(node('small','',LABEL_METRIC[metric]));
 const aux=node('div','post-stat-line');
 for(const [key,label] of [['likes','Me gusta'],['reposts','Reposts'],['respuestas','Respuestas'],['citas','Citas']])aux.append(node('span','',label+' '+number(post[key])));
 stats.append(aux);
 const link=postLink(post,'Abrir publicación en X ↗');link.className='post-link';
 card.append(top,author,paragraph,stats,link);
 return card;
}
function makeRank(post,i,metric){
 const row=node('article','ranking-item');
 const rank=node('strong','rank-pos',String(i+1).padStart(2,'0'));
 const body=node('div','rank-body');
 const content=postLink(post,textExcerpt(post));
 content.title=textExcerpt(post);
 const secondary=node('small','',(post.username?'@'+post.username:post.autor)+' · '+dateOnly(post.fecha)+' · '+(post.idioma||'?'));
 body.append(content,secondary);
 const val=node('div','rank-value',number(post[metric]));
 val.append(node('small','',LABEL_METRIC[metric]));
 row.append(rank,body,val);
 return row;
}
function ranking(scope,metric,featureId,listId){
 const all=state.data.rankings?.[scope]?.[state.language]?.[metric]||[];
 const feature=$(featureId),list=$(listId);
 feature.replaceChildren();list.replaceChildren();
 if(!all.length){
   empty(feature,'No se registraron publicaciones en este ámbito con el idioma y la métrica seleccionados.');
   empty(list,'Sin publicaciones para mostrar.');return;
 }
 feature.append(makeFeatured(all[0],metric));
 for(let i=1;i<Math.min(all.length,10);i++)list.append(makeRank(all[i],i,metric));
 if(all.length===1)empty(list,'Solo existe una publicación para este filtro.');
}
function render(){
 if(!state.data)return;
 renderSelectors();renderOverview();renderDaily();renderLanguages();renderTopics();
 ranking('general',state.generalMetric,'general-feature','general-ranking');
 ranking('albiol',state.albiolMetric,'albiol-feature','albiol-ranking');
}
async function boot(){
 try{
  const response=await fetch('./data/public/resumen.json',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(!data.rankings?.general||!data.por_idioma){
    throw Error('Falta generar el nuevo resumen del visor. Ejecuta npm run process.');
  }
  state.data=data;
  render();
 }catch(e){
  $('data-status').textContent='No se han podido cargar los datos: '+e.message;
  $('hero-status').textContent='Histórico no disponible';
  console.error(e);
 }
}
boot();
