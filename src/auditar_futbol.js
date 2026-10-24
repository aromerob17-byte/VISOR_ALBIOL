import fs from 'node:fs';
import {leerJSON,escribirJSON,todosLosPosts} from './almacen.js';
import {clasificarFutbol} from './clasificar_futbol.js';

// Audita TODO el JSON histórico: sin consultas ni coste de la API de X.
// Los nuevos sospechosos solo se señalan para revisión; NO se excluyen solos.
const cfg=leerJSON('config/exclusiones.json',{registros:[]});
const excluded=new Set((cfg.registros||[]).map(x=>String(x.id)));
const politicalReviewed=new Set((cfg.conservados_politicos||[]).map(String));
const posts=todosLosPosts();
const byId=new Map(posts.map(p=>[String(p.id),p]));
const categories=['excluido_confirmado','alta_probabilidad','contexto_futbol','mixto_revisar'];
const counts=Object.fromEntries(categories.map(c=>[c,{total:0,originales:0,republicaciones:0}]));
const candidates=[];
const presentExcluded=[];
for(const p of posts){
 const id=String(p?.id||'');
 // Estos 27 registros fueron revisados personalmente y son conversación política.
 if(politicalReviewed.has(id))continue;
 if(excluded.has(id))presentExcluded.push(id);
 const result=clasificarFutbol(p,excluded);
 if(!result)continue;
 const repost=!!p.republica_a;
 const c=counts[result.categoria];
 c.total++;if(repost)c.republicaciones++;else c.originales++;
 const m=p.metricas||{};
 const interactions=Number(m.like_count||0)+Number(m.retweet_count||0)+Number(m.reply_count||0)+Number(m.quote_count||0);
 candidates.push({
  id,fecha:p.fecha||null,autor:p.autor_username||p.autor_nombre||p.autor_id||null,
  idioma:p.idioma?.codigo||p.idioma_x||null,
  categoria:result.categoria,indicadores:result.indicadores,
  ambiguo_con_alcalde:result.mencion_xavier,
  republicacion:repost,interacciones:interactions,
  url:p.url||'https://x.com/i/web/status/'+id,
  texto:String(p.texto||'').slice(0,650)
 });
}
const weight={excluido_confirmado:0,alta_probabilidad:1,contexto_futbol:2,mixto_revisar:3};
candidates.sort((a,b)=>weight[a.categoria]-weight[b.categoria]||b.interacciones-a.interacciones||a.id.localeCompare(b.id));
const outputDir='data/auditoria_futbol';
fs.mkdirSync(outputDir,{recursive:true});
const chunkSize=100,files=[];
for(let start=0;start<candidates.length;start+=chunkSize){
 const path=outputDir+'/candidatos_'+String(1+Math.floor(start/chunkSize)).padStart(3,'0')+'.json';
 const part=candidates.slice(start,start+chunkSize);
 escribirJSON(path,{desde:start+1,hasta:start+part.length,registros:part});
 files.push({archivo:path,desde:start+1,hasta:start+part.length});
}
const totalPosts=posts.length,retweets=posts.filter(p=>p.republica_a).length;
const resumen={
 version:1,analizado_en:new Date().toISOString(),
 objeto:'Detectar referencias al futbolista Raúl Albiol en la base del Visor sobre Xavier García Albiol',
 alcance:{registros_analizados:totalPosts,publicaciones_sin_republicacion:totalPosts-retweets,republicaciones:retweets},
 exclusiones:{configuradas:excluded.size,encontradas:presentExcluded.length,
   no_encontradas:[...excluded].filter(id=>!byId.has(id))},
 categorias:counts,
 total_candidatos:candidates.length,
 nuevos_sin_excluir:candidates.filter(p=>p.categoria!=='excluido_confirmado').length,
 nuevos_originales_sin_excluir:candidates.filter(p=>p.categoria!=='excluido_confirmado'&&!p.republicacion).length,
 muestra_por_categoria:Object.fromEntries(categories.map(c=>[c,candidates.filter(p=>p.categoria===c).slice(0,8)])),
 archivos:files,
 cautelas:[
  'El análisis recorre todos los registros guardados, no todas las publicaciones existentes en X.',
  'La clasificación es heurística; menciones futbolísticas sin apellido pueden no detectarse.',
  'Solo se excluyen automáticamente de las estadísticas los seis IDs ya validados.',
  'Una republicación se audita pero no forma parte del universo principal del visor.',
  'Las categorías detectan candidatos a revisar y no constituyen una prueba definitiva de identidad.'
 ]
};
escribirJSON(outputDir+'/resumen.json',resumen);
console.log('AUDITORIA_FUTBOL '+JSON.stringify({alcance:resumen.alcance,exclusiones:resumen.exclusiones,
 categorias:resumen.categorias,total_candidatos:resumen.total_candidatos,
 nuevos_originales_sin_excluir:resumen.nuevos_originales_sin_excluir,archivos:files.length}));
if(resumen.exclusiones.no_encontradas.length)process.exitCode=1;
