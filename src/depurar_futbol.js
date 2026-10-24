import fs from 'node:fs';
import path from 'node:path';
import {leerJSON,escribirJSON} from './almacen.js';

// Depuración autorizada el 24/10/2026: retirar los falsos positivos futbolísticos
// del almacenamiento activo, sus series de métricas y los listados de auditoría.
// La lista de IDs bloqueados evita que una futura consulta a X los reintroduzca.
const config=leerJSON('config/exclusiones.json',{registros:[],conservados_politicos:[]});
const bloqueados=new Set((config.registros||[]).map(x=>String(x.id)));
const politicos=new Set((config.conservados_politicos||[]).map(String));
if(bloqueados.size!==80||politicos.size!==27)
  throw Error('El alcance aprobado ha cambiado: se esperaban 80 futbolísticos y 27 políticos');
if([...politicos].some(id=>bloqueados.has(id)))
  throw Error('Un registro político aparece erróneamente en la lista de exclusiones');

const formato=/^\d{4}-\d{2}\.json$/;
const postsDir='data/posts',metricsDir='data/metrics',auditDir='data/auditoria_futbol';
const cambiosPosts=[],cambiosMetricas=[];
const encontrados=new Set(),conservados=new Set();

for(const archivo of fs.readdirSync(postsDir).filter(x=>formato.test(x))){
  const ruta=path.join(postsDir,archivo);
  const mapa=leerJSON(ruta,{});
  const limpio={};
  for(const [clave,registro] of Object.entries(mapa)){
    const id=String(registro?.id||clave);
    if(bloqueados.has(id)||bloqueados.has(clave)){
      encontrados.add(id);
      continue;
    }
    if(politicos.has(id))conservados.add(id);
    limpio[clave]=registro;
  }
  cambiosPosts.push({ruta,limpio});
}
const pendientes=[...bloqueados].filter(id=>!encontrados.has(id));
const politicosAusentes=[...politicos].filter(id=>!conservados.has(id));
if(pendientes.length)throw Error('No encontrados en la base: '+pendientes.join(','));
if(politicosAusentes.length)throw Error('Faltan publicaciones políticas protegidas: '+politicosAusentes.join(','));

let metricasEliminadas=0;
if(fs.existsSync(metricsDir)){
  for(const archivo of fs.readdirSync(metricsDir).filter(x=>formato.test(x))){
    const ruta=path.join(metricsDir,archivo);
    const mapa=leerJSON(ruta,{});
    const limpio={};
    for(const [id,mediciones] of Object.entries(mapa)){
      if(bloqueados.has(String(id))){metricasEliminadas++;continue;}
      limpio[id]=mediciones;
    }
    cambiosMetricas.push({ruta,limpio});
  }
}
// No se escribe nada hasta validar el alcance completo de la depuración.
for(const x of cambiosPosts)escribirJSON(x.ruta,x.limpio);
for(const x of cambiosMetricas)escribirJSON(x.ruta,x.limpio);
if(fs.existsSync(auditDir)){
  for(const archivo of fs.readdirSync(auditDir).filter(x=>/^candidatos_\d+\.json$/.test(x)))
    fs.unlinkSync(path.join(auditDir,archivo));
  // resumen.json se regenera ejecutando audit:futbol tras la depuración.
}
console.log(JSON.stringify({
  registros_futbol_eliminados:encontrados.size,
  series_metricas_eliminadas:metricasEliminadas,
  registros_politicos_conservados:conservados.size
},null,2));