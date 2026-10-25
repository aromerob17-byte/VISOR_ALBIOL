import fs from 'node:fs';
import path from 'node:path';

const base='data/posts/2026-10.json';
const salida='data/exportaciones';
const data=JSON.parse(fs.readFileSync(base,'utf8'));
const todos=Object.values(data).filter(p=>p && p.id && !p.republica_a);
todos.sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||''))||String(a.id).localeCompare(String(b.id)));

const regexLengua=/(catal[aàá]n|catal[uà]ny|llengua|ling[üu][ií]stic|castellano|castell[aà]|biling[üu]|idioma|lengua|cooficial|oficialidad|normalitzaci[oó]|normalizaci[oó]|imposici[oó]n\s+ling[üu]|inmersi[oó]n\s+ling[üu]|immers[ií]o\s+ling[üu])/i;
const hiloOrigen='2112800267305460199';
const num=v=>Number.isFinite(Number(v))?Number(v):'';
const campos=[
'id','fecha','autor_usuario','autor_nombre','autor_id','texto','idioma_detectado',
'tipo','url','conversation_id','responde_a','cita_a','likes','republicaciones',
'respuestas','citas','impresiones','interacciones','procedencias',
'coincidencia_lexica_lengua','vinculado_hilo_origen',
'postura_contenido_ALBIOL_REVISION_MANUAL','critica_PP_REVISION_MANUAL',
'critica_ALBIOL_REVISION_MANUAL','observaciones_revision'
];
const clasificacion=''; // No existe un archivo auditable con las 533 etiquetas previas.
function fila(p){
  const m=p.metricas||{};
  const l=num(m.like_count),r=num(m.retweet_count),a=num(m.reply_count),q=num(m.quote_count);
  const fuente=Array.isArray(p.procedencias)?p.procedencias:[];
  const origen=fuente.some(x=>String(x).includes(hiloOrigen)) || String(p.conversation_id||'')===hiloOrigen;
  const coincide=regexLengua.test(p.texto||'');
  return {
    id:String(p.id),fecha:p.fecha||'',autor_usuario:p.autor_username||'',autor_nombre:p.autor_nombre||'',
    autor_id:p.autor_id||'',texto:p.texto||'',idioma_detectado:p.idioma?.codigo||p.idioma_x||'',
    tipo:p.responde_a?'respuesta':p.cita_a?'cita':'original',
    url:p.url||'https://x.com/i/web/status/'+p.id,
    conversation_id:p.conversation_id||'',responde_a:p.responde_a||'',cita_a:p.cita_a||'',
    likes:l,republicaciones:r,respuestas:a,citas:q,impresiones:num(m.impression_count),
    interacciones:(l===''?0:l)+(r===''?0:r)+(a===''?0:a)+(q===''?0:q),
    procedencias:fuente.join(' | '),
    coincidencia_lexica_lengua:coincide?'si':'no',
    vinculado_hilo_origen:origen?'si':'no',
    postura_contenido_ALBIOL_REVISION_MANUAL:clasificacion,
    critica_PP_REVISION_MANUAL:clasificacion,
    critica_ALBIOL_REVISION_MANUAL:clasificacion,
    observaciones_revision:clasificacion
  };
}
function escapar(v) {
  let s=String(v??'');
  // Evitar ejecución de fórmulas al abrir CSV en Excel; el texto conserva
  // su contenido semántico, pero incorpora apóstrofo si empieza como fórmula.
  if(/^[\s]*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function volcar(nombre,rows) {
 const csv='\uFEFF'+campos.map(escapar).join(';')+'\r\n'+rows.map(p=>campos.map(k=>escapar(p[k])).join(';')).join('\r\n')+'\r\n';
 fs.writeFileSync(path.join(salida,nombre),csv,'utf8');
 return {archivo:nombre,filas:rows.length,bytes:Buffer.byteLength(csv)};
}
fs.mkdirSync(salida,{recursive:true});
const filas=todos.map(fila);
const candidatas=filas.filter(x=>x.coincidencia_lexica_lengua==='si'||x.vinculado_hilo_origen==='si');
const archivos=[
 volcar('corpus_originales_2026-10.csv',filas),
 volcar('candidatas_lengua_2026-10.csv',candidatas)
];
const nota=[
'EXTRACCIÓN DOCUMENTAL SIN CONSULTAS A X NI ETIQUETAS INVENTADAS',
'Fuente: data/posts/2026-10.json, repositorio VISOR_ALBIOL.',
'Universo: publicaciones de octubre 2026 no marcadas como republicaciones, una por ID.',
'CSV: UTF-8 BOM, separador punto y coma; los IDs de X deben importarse como texto.',
'candidatas_lengua: filtro léxico amplio O vínculo documentado al hilo origen. NO equivale a la selección histórica de 533.',
'La clasificación individual de las 533 no fue almacenada. Por ello las columnas de revisión están vacías.',
'No interpretar las 533 publicaciones citadas en conversaciones anteriores como una muestra reproducible.',
'Filtrar y revisar manualmente contenido/critica_al_PP/critica_a_Albiol antes de publicar resultados.',
'No se ha usado la API de X, no se han comprado créditos y no se han refrescado métricas.',
...archivos.map(x=>JSON.stringify(x))
].join('\n')+'\n';
fs.writeFileSync(path.join(salida,'LEEME_EXPORTACION.txt'),nota);
console.log(JSON.stringify({fuente:base,total_originales:filas.length,candidatas:candidatas.length,archivos},null,2));
