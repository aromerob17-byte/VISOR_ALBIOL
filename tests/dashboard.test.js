import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const child=spawnSync(process.execPath,['src/procesar.js'],{encoding:'utf8',timeout:90000});
test('Procesador genera dashboard real sin llamar a X',()=>{
 assert.equal(child.status,0,child.stderr);
 const d=JSON.parse(fs.readFileSync('data/public/resumen.json','utf8'));
 assert.equal(d.version,2);
 assert.ok(d.total_posts>0);
 assert.equal(d.rankings.general.todos.interacciones.length,10);
 assert.ok(d.rankings.albiol.todos.interacciones.length>0);
 assert.ok(d.rankings.albiol.todos.interacciones.every(p=>p.propio));
 assert.ok(d.rankings.general.todos.interacciones.every(p=>p.texto&&p.url));
 assert.deepEqual(Object.keys(d.idiomas).sort(),['ca','es','indeterminado','mixto','otro']);
 assert.ok(d.por_dia.length>0);
 assert.equal(d.por_dia.reduce((a,x)=>a+x.posts,0),d.total_posts);
 for(const metric of ['interacciones','impresiones','likes','reposts','respuestas','citas']){
   const top=d.rankings.general.todos[metric];
   assert.ok(top.length<=10);
   assert.ok(top.every((p,i)=>!i||top[i-1][metric]>=p[metric]));
 }
 assert.equal(d.total_posts,d.por_idioma.es.posts+d.por_idioma.ca.posts+d.por_idioma.mixto.posts+d.por_idioma.otro.posts+d.por_idioma.indeterminado.posts);
});
