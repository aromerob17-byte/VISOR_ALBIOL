import fs from 'node:fs';
fs.rmSync('dist',{recursive:true,force:true});
fs.cpSync('web','dist',{recursive:true});
fs.mkdirSync('dist/data/public',{recursive:true});
fs.copyFileSync('data/public/resumen.json','dist/data/public/resumen.json');
console.log('Sitio generado sin publicar BBDD de textos originales.');
