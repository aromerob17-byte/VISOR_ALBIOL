import {leerJSON,escribirJSON,guardarLote,todosLosPosts} from './almacen.js';
const CONFIG=leerJSON('config/fuentes.json',null);
const TOKEN=process.env.X_BEARER_TOKEN;
const BASE='https://api.x.com/2';
const FIELDS='created_at,author_id,conversation_id,lang,public_metrics,referenced_tweets,note_tweet';
const INICIO=Date.parse(CONFIG.inicio_utc);
const estado=leerJSON('data/estado.json',{version:1,por_fuente:{},avisos:[]});
const limite=CONFIG.limites;
const control={peticiones:0,posts:0,fuentes_completas:0,avisos:[],ejecutado_en:new Date().toISOString()};
function fuente(codigo,endpoint,query=null,extra={}){return{codigo,endpoint,query,...extra};}
function fuentesBase(){
 const ex=CONFIG.incluir_republicaciones_en_busquedas?'':' -is:retweet';
 const user=CONFIG.cuenta_principal;
 const lista=[
  fuente('texto','search','Albiol'+ex),
  fuente('mencion_directa','search','@'+user+ex),
  fuente('actividad_propia','search','from:'+user),
  fuente('respuesta_directa','search','to:'+user+ex)
 ];
 for(const c of CONFIG.conversaciones.filter(c=>c.activa)){
  lista.push(fuente('hilo:'+c.id,'search','conversation_id:'+c.id+ex));
  lista.push(fuente('citas:'+c.id,'quotes',null,{tweetId:c.id}));
 }
 return lista;
}
function fuentesDinamicas(){
 const horizon=Date.now()-limite.dias_seguimiento_hilos*86400000;
 const propios=todosLosPosts().filter(p=>p.procedencias?.includes('actividad_propia')
  && Date.parse(p.fecha)>=horizon && !p.republica_a && p.id);
 propios.sort((a,b)=>Date.parse(b.fecha)-Date.parse(a.fecha));
 return propios.slice(0,limite.max_hilos_albiol_por_ejecucion).flatMap(p=>[
   fuente('hilo_propio:'+p.id,'search','conversation_id:'+p.id+' -is:retweet'),
   fuente('citas_propias:'+p.id,'quotes',null,{tweetId:p.id})
 ]);
}
function desde(f){
 if(f.endpoint!=='search')return null;
 const last=estado.por_fuente?.[f.codigo]?.hasta_completado;
 const t=Math.max(INICIO,last?Date.parse(last)-600000:INICIO);
 return new Date(t).toISOString();
}
function requestParams(f,token){
 const q=new URLSearchParams();
 q.set('max_results','100');q.set('tweet.fields',FIELDS);
 q.set('expansions','author_id');q.set('user.fields','username,name');
 if(token)q.set('pagination_token',token);
 if(f.endpoint==='search'){q.set('query',f.query);q.set('start_time',desde(f));}
 return BASE+(f.endpoint==='search'?'/tweets/search/recent':'/tweets/'+f.tweetId+'/quote_tweets')+'?'+q;
}
async function solicitar(url){
 if(!TOKEN)throw Error('Falta secreto X_BEARER_TOKEN');
 const res=await fetch(url,{headers:{Authorization:'Bearer '+TOKEN}});
 if(!res.ok)throw Error('X HTTP '+res.status+': '+(await res.text()).slice(0,350));
 return res.json();
}
function margen(){return control.peticiones<limite.max_peticiones_por_ejecucion && control.posts<limite.max_posts_por_ejecucion;}
async function ejecutarFuente(f){
 if(!margen()){control.avisos.push('Omitida por límites: '+f.codigo);return;}
 let token,pagina=0,total=0,complete=false;
 const inicioEjecucion=new Date().toISOString();
 while(margen()&&pagina<limite.max_paginas_por_fuente){
  const data=await solicitar(requestParams(f,token));
  control.peticiones++;pagina++;
  const posts=data.data||[];
  const users=Object.fromEntries((data.includes?.users||[]).map(u=>[u.id,u]));
  guardarLote(posts.filter(p=>Date.parse(p.created_at)>=INICIO),f.codigo,users);
  control.posts+=posts.length;total+=posts.length;
  token=data.meta?.next_token;
  if(!token){complete=true;break;}
 }
 estado.por_fuente ||= {};
 estado.por_fuente[f.codigo]={...estado.por_fuente[f.codigo],ultima_consulta:inicioEjecucion,
    completa:complete,ultimo_lote:total,paginas:pagina};
 if(complete){
  control.fuentes_completas++;
  if(f.endpoint==='search')estado.por_fuente[f.codigo].hasta_completado=inicioEjecucion;
 }else control.avisos.push('Fuente incompleta: '+f.codigo+'; cursor conservado');
 console.log(f.codigo+': '+total+' posts; '+pagina+' páginas; completa='+complete);
}
async function main(){
 const plan=[...fuentesBase(),...fuentesDinamicas()];
 const mode=process.argv.includes('--execute')?'execute':'plan';
 if(mode==='plan'){
  console.log(JSON.stringify({modo:'SIN CONSULTAS X',inicio:CONFIG.inicio_utc,limites:limite,
   fuentes:plan.map(f=>({codigo:f.codigo,endpoint:f.endpoint,consulta:f.query||f.tweetId,desde:desde(f)}))},null,2));return;
 }
 if(Date.now()-INICIO>7*86400000&&!Object.values(estado.por_fuente||{}).some(f=>f.hasta_completado))
  throw Error('Fecha de inicio fuera de ventana reciente de X; revisar acceso histórico.');
 if(!TOKEN)throw Error('Falta X_BEARER_TOKEN; no se realizaron consultas.');
 for(const f of plan){
  try{await ejecutarFuente(f);}
  catch(e){control.avisos.push(f.codigo+': '+e.message);console.error(e.message);
   if(/HTTP (402|403|429)/.test(e.message))break;}
 }
 estado.ultima_ejecucion=control.ejecutado_en;
 estado.avisos=control.avisos;estado.ultima_estadistica=control;
 escribirJSON('data/estado.json',estado);
 console.log(JSON.stringify(control,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
