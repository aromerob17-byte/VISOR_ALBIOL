import {todosLosPosts,leerJSON,escribirJSON} from './almacen.js';
const posts=todosLosPosts();
const estado=leerJSON('data/estado.json',{});
const nf=v=>Number.isFinite(+v)?Number(v):0;
const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
const temas={
 'Vivienda':[/viviend/i,/habitatg/i,/alquil/i,/lloguer/i,/okup/i,/ocupaci[oó]/i,/desahuci/i,/desnon/i],
 'Seguridad':[/seguridad/i,/seguretat/i,/polic[ií]/i,/delinq/i,/delincuenc/i],
 'Inmigración':[/inmigra/i,/immigra/i,/migraci[oó]/i,/estranger/i,/extranjer/i],
 'Elecciones y partidos':[/eleccion/i,/elecci[oó]/i,/candidat/i,/campan[yñ]a/i,/campanya/i,/congreso/i,/congr[eé]s/i,/partido popular/i,/partit popular/i],
 'Servicios públicos':[/educaci[oó]/i,/sanidad/i,/salut/i,/escuel/i,/escol/i,/hospital/i,/transporte/i,/transport/i],
 'Economía':[/impuest/i,/impost/i,/salari/i,/empleo/i,/ocupaci[oó] laboral/i,/econom[ií]/i,/presupuesto/i,/pressupost/i]
};
const puntuacion=p=>{const m=p.metricas||{};return nf(m.like_count)+nf(m.retweet_count)+nf(m.reply_count)+nf(m.quote_count);};
const dias=new Map(),langs={},fuentes={},temasCount={},autores=new Set();
let propios=0,impresiones=0;
for(const p of posts){
 const d=day.format(new Date(p.fecha));
 const fila=dias.get(d)||{fecha:d,posts:0,autores:new Set(),propios:0,es:0,ca:0};
 fila.posts++;fila.autores.add(p.autor_id||p.autor_username||p.id);
 if(p.procedencias?.includes('actividad_propia')){fila.propios++;propios++;}
 if(p.idioma?.codigo==='es')fila.es++;
 if(p.idioma?.codigo==='ca')fila.ca++;
 dias.set(d,fila);
 const lang=p.idioma?.codigo||'indeterminado';langs[lang]=(langs[lang]||0)+1;
 for(const f of p.procedencias||[])fuentes[f]=(fuentes[f]||0)+1;
 if(p.autor_id)autores.add(p.autor_id);
 if(p.metricas?.impression_count!=null)impresiones++;
 const matches=Object.entries(temas).filter(([_,regex])=>regex.some(r=>r.test(p.texto||''))).map(([k])=>k);
 for(const t of matches.length?matches:['Sin clasificar'])temasCount[t]=(temasCount[t]||0)+1;
}
const top=[...posts].sort((a,b)=>puntuacion(b)-puntuacion(a)).slice(0,25).map(p=>({
 id:p.id,fecha:p.fecha,autor:p.autor_username||p.autor_nombre||p.autor_id||'Sin datos',
 idioma:p.idioma?.codigo||'indeterminado',interacciones:puntuacion(p),
 likes:nf(p.metricas?.like_count),republicaciones:nf(p.metricas?.retweet_count),
 respuestas:nf(p.metricas?.reply_count),citas:nf(p.metricas?.quote_count),
 impresiones:p.metricas?.impression_count??null,url:p.url,propio:p.procedencias?.includes('actividad_propia')||false
}));
const resumen={
 version:1,inicio:'2026-10-21',actualizado_en:estado.ultima_ejecucion||null,
 total_posts:posts.length,total_autores:autores.size,publicaciones_albiol:propios,
 impresiones_disponibles_en:impresiones,idiomas:langs,fuentes,
 por_dia:[...dias.values()].sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(v=>({...v,autores:v.autores.size})),
 temas:Object.entries(temasCount).map(([tema,posts])=>({tema,posts})).sort((a,b)=>b.posts-a.posts),
 top_interacciones:top,avisos:estado.avisos||[],estado:posts.length?'DATOS_DISPONIBLES':'SIN_DATOS',
 notas:['Fuentes solapadas: no sumar recuentos de procedencia.',
 'Temáticas de palabras clave: multietiqueta, no interpretación semántica.',
 'Actividad en X, no encuesta ni representación de la opinión pública.',
 'La presencia en un hilo no demuestra que el mensaje se refiera a Albiol.',
 'Clasificación lingüística automática susceptible de error.']
};
escribirJSON('data/public/resumen.json',resumen);
console.log('Procesados '+posts.length+' posts y '+autores.size+' autores');
