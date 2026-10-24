import {leerJSON, escribirJSON, guardarLote, todosLosPosts} from './almacen.js';

// Recogida incremental. El presupuesto es TOTAL para el Visor, no diario.
// X factura lecturas de Posts (USD 0,005) y usuarios (USD 0,010);
// se reserva el peor coste de cada página antes de pedirla.
const config=leerJSON('config/fuentes.json',null);
const bearer=process.env.X_BEARER_TOKEN;
const api='https://api.x.com/2';
const fields='created_at,author_id,conversation_id,lang,public_metrics,referenced_tweets,note_tweet';
const inicio=Date.parse(config.inicio_utc);
const now=new Date();
const limits=config.limites;
const estado=leerJSON('data/estado.json',{version:1,por_fuente:{},avisos:[]});
estado.por_fuente ||= {};
const budget=estado.presupuesto_visor || {moneda:'USD',limite_total:500,gasto_estimado:0,lecturas:0,usuarios:0};
budget.limite_total=Math.min(Number(budget.limite_total||500),Number(config.presupuesto_total_usd||500));
if(!Number.isFinite(budget.gasto_estimado))throw Error('Contabilidad del presupuesto inválida');
const control={iniciado_en:now.toISOString(),peticiones:0,leidos:0,nuevos:0,fuentes_completadas:0,avisos:[],parada:null};
const maxRequests=Number(process.env.MAX_REQUESTS||limits.max_peticiones_por_ejecucion||500);
const maxMinutes=Number(process.env.MAX_MINUTES||'160');
const deadline=Date.now()+maxMinutes*60000;
const interval=10*60*1000;
const oldestAllowed=Date.now()-7*86400000+120000;
const source=(code,kind,query=null,id=null)=>({code,kind,query,id});
const search=(code,query)=>source(code,'search',query);
const quotes=(code,id)=>source(code,'quotes',null,id);

function originals(){
 const user=config.cuenta_principal;
 // Nunca se filtra por usuario, idioma, signo político ni por relevancia de RTVE.
 const suffix=config.incluir_republicaciones_en_busquedas?'':' -is:retweet';
 const base=[
  search('texto','Albiol'+suffix),
  search('mencion_directa','@'+user+suffix),
  search('actividad_propia','from:'+user),
  search('respuesta_directa','to:'+user+suffix)
 ];
 for(const c of config.conversaciones.filter(x=>x.activa)){
  base.push(search('hilo:'+c.id,'conversation_id:'+c.id+suffix));
  base.push(quotes('citas:'+c.id,c.id));
 }
 return base;
}
function dynamic(){
 const posts=todosLosPosts();
 const propios=posts.filter(p=>p.procedencias?.includes('actividad_propia')&&!p.republica_a&&Date.parse(p.fecha)>=inicio);
 const semillas=posts.filter(p=>p.procedencias?.some(x=>x.startsWith('citas:'))&&!p.republica_a&&Date.parse(p.fecha)>=inicio);
 // Todas las publicaciones propias tienen seguimiento, sin el antiguo corte de tres hilos.
 const list=propios.flatMap(p=>[
  search('respuestas_albiol:'+p.id,'conversation_id:'+p.id),
  quotes('citas_albiol:'+p.id,p.id)
 ]);
 // Repartimos el seguimiento de conversaciones de terceros a lo largo de los días.
 semillas.sort((a,b)=>(b.metricas?.reply_count||0)-(a.metricas?.reply_count||0));
 const limit=Math.max(1,Number(limits.max_semillas_terceros_por_ejecucion||150));
 const start=(Number(estado.turno_semillas||0)*limit)%Math.max(1,semillas.length);
 const elegidas=[];
 for(let n=0;n<Math.min(limit,semillas.length);n++)elegidas.push(semillas[(start+n)%semillas.length]);
 estado.turno_semillas=Number(estado.turno_semillas||0)+1;
 return [...list,...elegidas.map(p=>search('respuestas_a_cita:'+p.id,'conversation_id:'+p.id))];
}
function canRequest(){
 if(control.parada)return false;
 if(Date.now()>deadline){control.parada='Límite de tiempo de la ejecución';return false;}
 if(control.peticiones>=maxRequests){control.parada='Límite de peticiones de esta ejecución';return false;}
 if(budget.limite_total-budget.gasto_estimado<0.15){
  control.parada='Presupuesto acumulado del Visor agotado';return false;
 }
 return true;
}
function pageSize(){
 return Math.min(100,Math.floor((budget.limite_total-budget.gasto_estimado)/0.015));
}
async function saldo(){
 try{
  const r=await fetch(api+'/usage/credits',{headers:{Authorization:'Bearer '+bearer}});
  if(!r.ok)return null;
  const v=Number((await r.json()).data?.total_balance);
  return Number.isFinite(v)?v:null;
 }catch{return null;}
}
async function request(url,users){
 if(!canRequest())return null;
 const page=pageSize();
 if(page<10){control.parada='Reserva insuficiente para una página de X';return null;}
 const r=await fetch(url,{headers:{Authorization:'Bearer '+bearer}});
 if(!r.ok){
  const detail=(await r.text()).slice(0,300);
  const e=Error('HTTP '+r.status+' '+detail);
  e.http=r.status;throw e;
 }
 const json=await r.json();
 control.peticiones++;
 const items=json.data||[];
 const names=users?(json.includes?.users||[]):[];
 const cost=items.length*0.005+names.length*0.01;
 budget.gasto_estimado=Math.round((budget.gasto_estimado+cost)*10000)/10000;
 budget.lecturas=(budget.lecturas||0)+items.length;
 budget.usuarios=(budget.usuarios||0)+names.length;
 control.leidos+=items.length;
 return json;
}
function persist(){
 estado.presupuesto_visor=budget;
 estado.ultimo_control_recogida=control;
 estado.avisos=control.avisos;
 escribirJSON('data/estado.json',estado);
}
function windowFor(f){
 const st=estado.por_fuente[f.code]||{};
 if(st.pendiente?.inicio && st.pendiente?.fin && Date.parse(st.pendiente.inicio)>=oldestAllowed)
  return st.pendiente;
 const ultimo=st.hasta_completado||st.terminado_en||st.consultado_en;
 const desde=new Date(Math.max(inicio,oldestAllowed,ultimo?Date.parse(ultimo)-interval:inicio)).toISOString();
 const fin=new Date(Date.now()-20000).toISOString();
 return Date.parse(desde)<Date.parse(fin)?{inicio:desde,fin,token:null}:null;
}
function queryURL(f,win,max){
 const q=new URLSearchParams();
 q.set('max_results',String(max));
 q.set('tweet.fields',fields);
 q.set('expansions','author_id');
 q.set('user.fields','username,name');
 if(f.kind==='search'){
  q.set('query',f.query);
  if(win.token)q.set('pagination_token',win.token);
  else {q.set('start_time',win.inicio);q.set('end_time',win.fin);}
 }else if(win.token)q.set('pagination_token',win.token);
 return api+(f.kind==='search'?'/tweets/search/recent':'/tweets/'+f.id+'/quote_tweets')+'?'+q;
}
async function sweep(f){
 let st=estado.por_fuente[f.code]||{};
 let win;
 if(f.kind==='search')win=windowFor(f);
 else{
  const cutoff=st.hasta_completado||st.terminado_en||st.consultado_en||config.inicio_utc;
  win=st.pendiente||{inicio:cutoff,fin:new Date().toISOString(),token:null};
 }
 if(!win)return;
 let pages=0,completed=false;
 while(canRequest()){
  const max=pageSize();
  try{
   // Un token de paginación pertenece a su ventana original; se conserva en estado.
   const json=await request(queryURL(f,win,max),true);
   if(!json)break;
   const items=(json.data||[]).filter(p=>p.id&&p.created_at);
   const users=Object.fromEntries((json.includes?.users||[]).map(u=>[u.id,u]));
   const usable=items.filter(p=>Date.parse(p.created_at)>=inicio);
   const saved=guardarLote(usable,f.code,users);
   control.nuevos+=saved.nuevos;pages++;
   st.ultima_consulta=new Date().toISOString();
   st.ultimo_lote=items.length;st.peticiones=(st.peticiones||0)+1;
   st.registros_leidos=(st.registros_leidos||0)+items.length;
   const next=json.meta?.next_token||null;
   // Quote endpoint no admite start_time: al llegar a posts ya leídos podemos parar.
   const foundOld=f.kind==='quotes'&&items.some(p=>Date.parse(p.created_at)<Date.parse(win.inicio)-interval);
   completed=!next||foundOld;
   win.token=next;
   st.pendiente=completed?null:win;
   if(completed){st.hasta_completado=win.fin;st.completa=true;st.terminado_en=win.fin;}
   else st.completa=false;
   estado.por_fuente[f.code]=st;
   estado.ultima_ejecucion=control.iniciado_en;
   persist();
   console.log(f.code+': '+items.length+' leídas, '+saved.nuevos+' nuevas, página '+pages+', completa='+completed);
   if(completed)break;
  }catch(e){
   control.avisos.push(f.code+': '+e.message);
   if([401,402,403,429].includes(e.http))control.parada='X API HTTP '+e.http;
   else control.parada='Error al consultar X; reintentar mañana';
   persist();break;
  }
 }
 if(completed)control.fuentes_completadas++;
 if(!completed&&st.pendiente)control.avisos.push('Pendiente de paginar: '+f.code);
}
async function refreshMetrics(){
 if(!canRequest())return;
 const list=todosLosPosts().filter(p=>p.id&&!p.republica_a);
 list.sort((a,b)=>{
  const ma=a.metricas||{},mb=b.metricas||{};
  const m=x=>(x.like_count||0)+(x.retweet_count||0)+(x.reply_count||0)+(x.quote_count||0);
  return m(mb)-m(ma);
 });
 const selected=[...new Map([...list.slice(0,200),...list.filter(p=>p.procedencias?.includes('actividad_propia'))]
  .map(p=>[p.id,p])).values()];
 const existing=new Map(selected.map(p=>[p.id,p]));
 for(let i=0;i<selected.length&&canRequest();){
  const cap=Math.min(pageSize(),100);
  if(cap<10)break;
  const chunk=selected.slice(i,i+cap);i+=chunk.length;
  const q=new URLSearchParams({ids:chunk.map(p=>p.id).join(','),'tweet.fields':fields});
  try{
   const json=await request(api+'/tweets?'+q,false);
   if(!json)break;
   for(const p of json.data||[]){
    const origin=existing.get(p.id);
    guardarLote([p],origin?.procedencias?.[0]||'metricas');
   }
   persist();
  }catch(e){control.avisos.push('Revisión de métricas: '+e.message);break;}
 }
}
async function main(){
 const plan=[...originals(),...dynamic()];
 if(!process.argv.includes('--execute')){
  console.log(JSON.stringify({modo:'PLAN SIN GASTO',inicio:config.inicio_utc,
   presupuesto_usd:budget.limite_total,gasto_estimado_usd:budget.gasto_estimado,
   fuentes:plan.map(p=>({fuente:p.code,consulta:p.query||p.id}))},null,2));return;
 }
 if(!bearer)throw Error('Falta el secreto X_BEARER_TOKEN. No se consultó X.');
 if(!Number.isFinite(maxRequests)||maxRequests<1||maxRequests>2000)throw Error('MAX_REQUESTS inválido');
 const balance=await saldo();
 if(balance!==null){
  estado.saldo_x_ultimo_usd=balance;
  if(balance<0.15){control.parada='Sin saldo suficiente en X';persist();return;}
 }
 for(const f of plan){if(!canRequest())break;await sweep(f);}
 if(canRequest())await refreshMetrics();
 control.finalizado_en=new Date().toISOString();
 persist();
 console.log('RESUMEN '+JSON.stringify({control,presupuesto:budget,saldo_x_ultimo_usd:estado.saldo_x_ultimo_usd}));
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
