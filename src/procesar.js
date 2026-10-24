import {todosLosPosts,leerJSON,escribirJSON} from './almacen.js';

/* El mismo ID no cuenta dos veces. Las republicaciones se excluyen del universo
   de publicaciones propias; sus interacciones se reflejan en el original.
   Las métricas son las de la última observación, no la suma de snapshots. */
const exclusiones=leerJSON('config/exclusiones.json',{registros:[]});
const idsExcluidos=new Set((exclusiones.registros||[]).map(x=>String(x.id)));
const originales=todosLosPosts().filter(p=>p?.id && p.fecha && !p.republica_a && !idsExcluidos.has(String(p.id)));
const estado=leerJSON('data/estado.json',{});
const formatoDia=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const metrics=p=>{
 const x=p.metricas||{};
 const likes=num(x.like_count),reposts=num(x.retweet_count),replies=num(x.reply_count),quotes=num(x.quote_count);
 return {interacciones:likes+reposts+replies+quotes,impresiones:x.impression_count==null?null:num(x.impression_count),
 likes,reposts,respuestas:replies,citas:quotes};
};
const lang=p=>['es','ca','mixto','otro','indeterminado'].includes(p.idioma?.codigo)?p.idioma.codigo:'indeterminado';
const propio=p=>(p.procedencias||[]).includes('actividad_propia') || String(p.autor_username||'').toLowerCase()==='albiol_xg';
const dia=p=>formatoDia.format(new Date(p.fecha));
const tipo=p=>p.responde_a?'respuesta':p.cita_a?'cita':'original';
const temas={
 'Vivienda':[/viviend/i,/habitatg/i,/alquil/i,/lloguer/i,/okup/i,/ocupaci[oó]/i,/desahuci/i,/desnon/i],
 'Seguridad':[/seguridad/i,/seguretat/i,/polic[ií]/i,/delinq/i,/delincuenc/i,/gu[aà]rdia urbana/i],
 'Inmigración':[/inmigra/i,/immigra/i,/migraci[oó]/i,/estranger/i,/extranjer/i],
 'Elecciones y partidos':[/eleccion/i,/elecci[oó]/i,/candidat/i,/campan[yñ]a/i,/campanya/i,/congreso/i,/congr[eé]s/i,/partido popular/i,/partit popular/i],
 'Servicios públicos':[/educaci[oó]/i,/sanidad/i,/salut/i,/escuel/i,/escol/i,/hospital/i,/transporte/i,/transport/i],
 'Economía':[/impuest/i,/impost/i,/salari/i,/empleo/i,/econom[ií]/i,/presupuesto/i,/pressupost/i]
};
const etiquetas=p=>Object.entries(temas).filter(([_,patrones])=>patrones.some(rx=>rx.test(p.texto||''))).map(([nombre])=>nombre);
const idiomas=['todos','es','ca','mixto','otro','indeterminado'];
const ordenes=['interacciones','impresiones','likes','reposts','respuestas','citas'];
const stats=()=>({posts:0,autores:new Set(),interacciones:0,impresiones:0,con_impresiones:0,
                likes:0,reposts:0,respuestas:0,citas:0,propios:0,
                idiomas:{es:0,ca:0,mixto:0,otro:0,indeterminado:0},tipos:{original:0,respuesta:0,cita:0}});
function sumar(st,p){
 const m=metrics(p);st.posts++;
 st.autores.add(p.autor_id||p.autor_username||p.id);
 st.interacciones+=m.interacciones;st.likes+=m.likes;st.reposts+=m.reposts;
 st.respuestas+=m.respuestas;st.citas+=m.citas;
 if(m.impresiones!==null){st.impresiones+=m.impresiones;st.con_impresiones++;}
 if(propio(p))st.propios++;
 st.idiomas[lang(p)]++;
 st.tipos[tipo(p)]++;
}
function serialize(st){
 return {...st,autores:st.autores.size,impresiones_cobertura:st.posts?Math.round(10000*st.con_impresiones/st.posts)/100:0};
}
const global=stats(), porDia=new Map(), fuenteCont={},temasGlobal={},temasPorIdioma={};
for(const idioma of idiomas)temasPorIdioma[idioma]={};
for(const p of originales){
 const d=dia(p),lg=lang(p);
 sumar(global,p);
 if(!porDia.has(d))porDia.set(d,stats());
 sumar(porDia.get(d),p);
 for(const s of p.procedencias||[])fuenteCont[s]=(fuenteCont[s]||0)+1; // superposición, NO sumar
 const asignados=etiquetas(p);
 for(const t of asignados.length?asignados:['Sin clasificar']){
   temasGlobal[t]=(temasGlobal[t]||0)+1;
   temasPorIdioma.todos[t]=(temasPorIdioma.todos[t]||0)+1;
   temasPorIdioma[lg][t]=(temasPorIdioma[lg][t]||0)+1;
 }
}
const mostrarAutor=p=>{
 const name=p.autor_nombre||p.autor_username||null;
 return name||'Cuenta en X';
};
const detalle=p=>{
 const m=metrics(p);const t=(p.texto||'').replace(/\s+/g,' ').trim();
 return {id:p.id,autor:mostrarAutor(p),username:p.autor_username||null,
    fecha:p.fecha,dia:dia(p),idioma:lang(p),tipo:tipo(p),propio:propio(p),
    texto:t.length>320?t.slice(0,317)+'…':t,url:p.url||('https://x.com/i/web/status/'+p.id),
    ...m,temas:etiquetas(p)};
};
const rankings={};
for(const scope of ['general','albiol']){
 const universo=scope==='albiol'?originales.filter(propio):originales;
 rankings[scope]={};
 for(const l of idiomas){
   const filtrados=l==='todos'?universo:universo.filter(p=>lang(p)===l);
   const result={};
   for(const campo of ordenes){
      const sorted=filtrados.filter(p=>campo!=='impresiones'||metrics(p).impresiones!==null)
       .sort((a,b)=>num(metrics(b)[campo])-num(metrics(a)[campo]) || Date.parse(b.fecha)-Date.parse(a.fecha));
      result[campo]=sorted.slice(0,10).map(detalle);
   }
   rankings[scope][l]=result;
 }
}
const temporal=[...porDia].sort(([a],[b])=>a.localeCompare(b)).map(([fecha,st])=>({fecha,...serialize(st)}));
const porIdioma={};
for(const l of idiomas){
 const st=stats();
 for(const p of originales)if(l==='todos'||lang(p)===l)sumar(st,p);
 porIdioma[l]=serialize(st);
}
const metricas=serialize(global);
const resumen={
 version:2,inicio:'2026-10-21',actualizado_en:[estado.ultima_ejecucion,estado.ultimo_refresco_albiol?.ejecutado_en].filter(Boolean).sort().at(-1)||null,
 ...metricas,total_posts:metricas.posts,total_autores:metricas.autores,
 publicaciones_albiol:metricas.propios,impresiones_disponibles_en:metricas.con_impresiones,
 exclusiones_fuera_de_ambito:idsExcluidos.size,
 // Compatibilidad con el esqueleto anterior
 idiomas:metricas.idiomas,fuentes:fuenteCont,
 por_dia:temporal.map(d=>({...d,es:d.idiomas.es,ca:d.idiomas.ca})),
 temas:Object.entries(temasGlobal).map(([tema,posts])=>({tema,posts})).sort((a,b)=>b.posts-a.posts),
 temas_por_idioma:temasPorIdioma,por_idioma:porIdioma,rankings,
 top_interacciones:rankings.general.todos.interacciones,
 avisos:estado.ultimo_barrido?.errores||[],estado:originales.length?'DATOS_DISPONIBLES':'SIN_DATOS',
 metodologia:{
    deduplicacion:'Por ID de publicación; se excluyen republicaciones del universo.',
    fuera_de_ambito:'IDs validados de publicaciones sobre homónimos (como Raúl Albiol) excluidos de cifras, rankings y temas sin borrar la fuente original.',
    interacciones:'Me gusta + republicaciones + respuestas + citas, según último dato observado.',
    impresiones:'Suma de impresiones publicadas por X donde están disponibles; no son usuarios únicos.',
    temas:'Etiquetas multiclase por coincidencia de palabras; no son clasificación semántica ni sentimiento.',
    idiomas:'Clasificación automática, susceptible de errores en textos breves y bilingües.',
    cobertura:'Recopilación parcial de X. No representa al conjunto de votantes ni constituye una encuesta.'
 }
};
escribirJSON('data/public/resumen.json',resumen);
console.log(JSON.stringify({version:2,posts:resumen.posts,autores:resumen.autores,
  propios:resumen.propios,interacciones:resumen.interacciones,
  top_general:resumen.rankings.general.todos.interacciones.length,
  top_albiol:resumen.rankings.albiol.todos.interacciones.length}));
