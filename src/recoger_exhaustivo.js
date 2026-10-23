import {leerJSON,escribirJSON,guardarLote,todosLosPosts} from './almacen.js';

/**
 * Barrido de recuperación puntual. No hay schedule ni bucle ilimitado de gasto.
 * Se guarda el cursor por fuente, se consulta primero el hilo prioritario
 * y se pueden reanudar fuentes incompletas sin recomenzarlas.
 */
const config=leerJSON('config/fuentes.json',null);
const token=process.env.X_BEARER_TOKEN;
const start=config.inicio_utc;
const startedAt=new Date().toISOString();
const estado=leerJSON('data/estado.json',{version:1,por_fuente:{},avisos:[]});
estado.por_fuente ||= {};
const MAX_POSTS=Number(process.env.MAX_POSTS||'6000');
const MAX_REQUESTS=Number(process.env.MAX_REQUESTS||'120');
const MAX_RELEVANT_QUOTES=Number(process.env.MAX_RELEVANT_QUOTES||'20');
let requests=0,records=0,newRecords=0;
const errors=[],completed=[],partial=[],omitted=[];
let stopReason='';
const root='2112800267305460199';
const fields='created_at,author_id,conversation_id,lang,public_metrics,referenced_tweets,note_tweet';
const api='https://api.x.com/2';
const isoStart=Date.parse(start);

function source(code,kind,query=null,id=null){return{code,kind,query,id};}
const search=(code,q)=>source(code,'search',q);
const quotes=(code,id)=>source(code,'quotes',null,id);

function core(){
 const norepost=config.incluir_republicaciones_en_busquedas?'':' -is:retweet';
 const user=config.cuenta_principal;
 return [
  search('hilo:'+root,'conversation_id:'+root+norepost),
  quotes('citas:'+root,root),
  search('texto','Albiol'+norepost),
  search('mencion_directa','@'+user+norepost),
  search('respuesta_directa','to:'+user+norepost),
  search('actividad_propia','from:'+user)
 ];
}
function relevantQuotes(){
 const p=todosLosPosts()
  .filter(t=>t.procedencias?.includes('citas:'+root) && (t.metricas?.reply_count||0)>0)
  .sort((a,b)=>(b.metricas?.reply_count||0)-(a.metricas?.reply_count||0));
 return p.slice(0,MAX_RELEVANT_QUOTES)
    .map(p=>search('respuestas_a_cita:'+p.id,'conversation_id:'+p.id+' -is:retweet'));
}
function albiolThreads(){
 return todosLosPosts()
  .filter(p=>p.procedencias?.includes('actividad_propia') && !p.republica_a && Date.parse(p.fecha)>=isoStart)
  .sort((a,b)=>Date.parse(a.fecha)-Date.parse(b.fecha))
  .flatMap(p=>[search('respuestas_albiol:'+p.id,'conversation_id:'+p.id+' -is:retweet'),
    ...(Number(p.metricas?.quote_count||0)>0?[quotes('citas_albiol:'+p.id,p.id)]:[])]);
}
function remaining(){return MAX_POSTS-records;}
function capacity(){
 if(requests>=MAX_REQUESTS){stopReason='Límite de '+MAX_REQUESTS+' peticiones';return false;}
 if(remaining()<10){stopReason='Límite preventivo de '+MAX_POSTS+' lecturas';return false;}
 return true;
}
function storedIdBounds(code) {
 let min=null,max=null;
 for(const p of todosLosPosts()){
  if(!p.procedencias?.includes(code))continue;
  if(min===null||BigInt(p.id)<BigInt(min))min=p.id;
  if(max===null||BigInt(p.id)>BigInt(max))max=p.id;
 }
 return{min,max};
}
function queryURL(f,paramsState){
 const q=new URLSearchParams();
 q.set('max_results',String(Math.min(100,remaining())));
 q.set('tweet.fields',fields);
 if(f.kind==='search'){
  q.set('query',f.query);
  q.set('start_time',start);
  // Guardar el ID del más antiguo es más robusto que un token que puede caducar.
  if(paramsState.until_id)q.set('until_id',paramsState.until_id);
  // Orden recency: el identificador más antiguo sirve para seguir hacia atrás.
  q.set('sort_order','recency');
 }else if(paramsState.token)q.set('pagination_token',paramsState.token);
 return api+(f.kind==='search'?'/tweets/search/recent':'/tweets/'+f.id+'/quote_tweets')+'?'+q;
}
async function get(url){
 if(!token)throw Error('El secreto X_BEARER_TOKEN no está disponible.');
 const res=await fetch(url,{headers:{Authorization:'Bearer '+token}});
 if(!res.ok)throw Object.assign(new Error('HTTP '+res.status+' '+(await res.text()).slice(0,360)),{code:res.status});
 return res.json();
}
function stateFor(f){
 const s=estado.por_fuente[f.code]||{};
 const db=storedIdBounds(f.code);
 return{...s,
   until_id:s.until_id||(!s.completa?db.min:null),
   max_existing_id:db.max,
   token:s.token||null
 };
}
function persistState(f,s){
 estado.por_fuente[f.code]=s;
 estado.ultima_ejecucion=startedAt;
 estado.avisos=[...new Set([...(estado.avisos||[]),...errors,stopReason].filter(Boolean))];
 estado.ultimo_barrido={
  iniciado_en:startedAt,peticiones:requests,registros_leidos:records,
  nuevos_unicos_en_lotes:newRecords,estimacion_lectura_posts_usd:Math.round(records*0.005*100)/100,
  fuentes_completas:completed,fuentes_incompletas:partial,
  errores:errors,omitidas:omitted,parada:stopReason||null
 };
 escribirJSON('data/estado.json',estado);
}
async function sweep(f){
 let s=stateFor(f);
 if(s.barrido_completo){completed.push(f.code);return;}
 if(!capacity()){partial.push(f.code);omitted.push(f.code);return;}
 console.log('FUENTE '+f.code+' '+f.kind+'; hasta '+(s.until_id||'INICIO')+'; token '+!!s.token);
 let page=0;
 while(capacity()){
  try{
   const json=await get(queryURL(f,s));
   requests++;page++;
   const postList=(json.data||[]).filter(p=>p?.id&&p?.created_at);
   records+=postList.length;
   const usable=postList.filter(p=>Date.parse(p.created_at)>=isoStart);
   const save=guardarLote(usable,f.code);
   newRecords+=save.nuevos;
   const oldest=postList.reduce((a,p)=>a===null||BigInt(p.id)<BigInt(a)?p.id:a,null);
   if(f.kind==='search'&&oldest)s.until_id=oldest;
   if(f.kind==='quotes')s.token=json.meta?.next_token||null;
   s.peticiones=(s.peticiones||0)+1;
   s.registros_leidos=(s.registros_leidos||0)+postList.length;
   s.ultimo_lote=postList.length;
   s.consultado_en=startedAt;
   // Una búsqueda agotada o una lista sin token ha terminado.
   const hasNext=Boolean(json.meta?.next_token);
   const done=!hasNext||postList.length===0;
   if(done){
    s.barrido_completo=true;s.completa=true;s.terminado_en=new Date().toISOString();
    completed.push(f.code);
   }
   persistState(f,s);
   console.log('  página '+page+' '+postList.length+' leídos / '+save.nuevos+' nuevos. total '+records+'; completa '+done);
   if(done)break;
   if(!oldest && f.kind==='search'){errors.push('Respuesta sin IDs en '+f.code);break;}
  }catch(e){
   const msg=f.code+': '+e.message;
   errors.push(msg);console.error(msg);
   if(e.code===402||e.code===401||e.code===403||e.code===429){stopReason='API X HTTP '+e.code;persistState(f,s);return 'STOP';}
   persistState(f,s);return;
  }
 }
 if(!s.barrido_completo)partial.push(f.code);
 persistState(f,s);
}
async function main(){
 if(!token)throw Error('Token X no configurado: no hay llamadas de pago.');
 if(!Number.isInteger(MAX_POSTS)||MAX_POSTS<10||MAX_POSTS>20000)throw Error('MAX_POSTS fuera de rango');
 if(!Number.isInteger(MAX_REQUESTS)||MAX_REQUESTS<1||MAX_REQUESTS>250)throw Error('MAX_REQUESTS fuera de rango');
 // Prioridad 1: respuestas y citas al vídeo de RTVE.
 const queue=core();
 for(const f of queue.slice(0,2)){if(!capacity())break;if(await sweep(f)==='STOP')break;}
 // Prioridad 2: respuestas a las citas más comentadas de la misma conversación.
 if(!stopReason)for(const f of relevantQuotes()){if(!capacity())break;if(await sweep(f)==='STOP')break;}
 // Prioridad 3: resto de conversación pública desde el 21.
 if(!stopReason)for(const f of queue.slice(2)){if(!capacity())break;if(await sweep(f)==='STOP')break;}
 // Prioridad 4: respuestas y citas a TODAS las publicaciones propias recuperadas.
 if(!stopReason)for(const f of albiolThreads()){if(!capacity())break;if(await sweep(f)==='STOP')break;}
 persistState({code:'_barrido',kind:'meta'},estado.por_fuente._barrido||{});
 console.log('RESUMEN_BARRIDO '+JSON.stringify(estado.ultimo_barrido));
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
