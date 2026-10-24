import fs from 'node:fs';
import path from 'node:path';
import { detectarIdioma } from './idioma.js';
import { clasificarFutbol } from './clasificar_futbol.js';
const ROOT = path.resolve('data');
const exclusiones=JSON.parse(fs.readFileSync('config/exclusiones.json','utf8'));
const idsFutbol=new Set((exclusiones.registros||[]).map(x=>String(x.id)));
const idsPoliticos=new Set((exclusiones.conservados_politicos||[]).map(String));
export function leerJSON(archivo,fallback) {
  try {return JSON.parse(fs.readFileSync(archivo,'utf8'));}
  catch(e) {if(e.code==='ENOENT')return fallback;throw e;}
}
export function escribirJSON(archivo,valor) {
  fs.mkdirSync(path.dirname(archivo),{recursive:true});
  const temp=archivo+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(valor,null,2)+'\n','utf8');
  fs.renameSync(temp,archivo);
}
export function todosLosPosts() {
  const dir=path.join(ROOT,'posts');
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(f=>/^\d{4}-\d{2}\.json$/.test(f))
    .flatMap(f=>Object.values(leerJSON(path.join(dir,f),{})));
}
export function normalizar(p,usuarios={}) {
  const u=usuarios[p.author_id]||{};
  const texto=p.note_tweet?.text||p.text||'';
  const ref=p.referenced_tweets||[];
  return {
    id:String(p.id),fecha:p.created_at,autor_id:p.author_id||null,
    autor_username:u.username||null,autor_nombre:u.name||null,
    texto,idioma_x:p.lang||'und',idioma:detectarIdioma(texto,p.lang),
    conversation_id:p.conversation_id||null,
    responde_a:ref.find(r=>r.type==='replied_to')?.id||null,
    cita_a:ref.find(r=>r.type==='quoted')?.id||null,
    republica_a:ref.find(r=>r.type==='retweeted')?.id||null,
    metricas:p.public_metrics||{},
    url:'https://x.com/i/web/status/'+p.id,
    procedencias:[],relevancia:'por_revisar'
  };
}
export function guardarLote(posts,procedencia,usuarios={},momento=new Date().toISOString()) {
  const meses=new Map(),snapshots=new Map();
  let nuevos=0;
  for(const p of posts) {
    if(!p.id||!p.created_at)continue;
    const id=String(p.id);
    // No reintroducir nunca falsos positivos ya revisados. Los 27 casos
    // políticos prevalecen frente a coincidencias léxicas sobre deportes.
    if(idsFutbol.has(id))continue;
    if(!idsPoliticos.has(id)){
      const texto=p.note_tweet?.text||p.text||'';
      const resultado=clasificarFutbol({id,texto});
      if(resultado?.categoria==='alta_probabilidad')continue;
    }
    const mes=String(p.created_at).slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(mes))continue;
    if(!meses.has(mes))meses.set(mes,leerJSON(path.join(ROOT,'posts',mes+'.json'),{}));
    if(!snapshots.has(mes))snapshots.set(mes,leerJSON(path.join(ROOT,'metrics',mes+'.json'),{}));
    const mapa=meses.get(mes),met=snapshots.get(mes),prev=mapa[p.id];
    const post=normalizar(p,usuarios);
    if(!prev)nuevos++;
    post.procedencias=[...new Set([...(prev?.procedencias||[]),procedencia])].sort();
    post.relevancia=prev?.relevancia||'por_revisar';
    post.autor_username ||= prev?.autor_username||null;
    post.autor_nombre ||= prev?.autor_nombre||null;
    mapa[p.id]=post;
    if(!Array.isArray(met[p.id]))met[p.id]=[];
    const ultimo=met[p.id].at(-1);
    if(!ultimo||JSON.stringify(ultimo.metricas)!==JSON.stringify(post.metricas))
      met[p.id].push({medido_en:momento,metricas:post.metricas});
  }
  for(const [mes,mapa] of meses)escribirJSON(path.join(ROOT,'posts',mes+'.json'),mapa);
  for(const [mes,mapa] of snapshots)escribirJSON(path.join(ROOT,'metrics',mes+'.json'),mapa);
  return {recibidos:posts.length,nuevos};
}
