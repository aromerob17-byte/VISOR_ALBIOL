// Clasificación orientativa para auditar homónimos, nunca exclusión automática.
export function normalizarTexto(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
const sports=[
 ['Villarreal',/\bvillarreal\b/],
 ['Nápoles/Napoli',/\b(napoli|napoles|napoles|ssc napoli)\b/],
 ['Pisa',/\b(pisa sc|pisa calcio|pisa sporting)\b/],
 ['Valencia CF',/\b(valencia cf|valencia c\.?f\.?)\b/],
 ['Real Madrid',/\breal madrid\b/],
 ['Fútbol',/\b(futbol|futebol|football|soccer|calcio|fussball)\b/],
 ['Futbolista',/\b(futbolista|footballer|futbolista|football player|soccer player)\b/],
 ['Defensa central',/\b(central defender|centre.back|defensa central|centreback|defender|back line)\b/],
 ['Fichajes',/\b(fichaj[eo]|mercato|transfer|traspaso|cedid[oa])\b/],
 ['Competiciones',/\b(champions league|europa league|serie a|la liga|premier league|mundial de clubes)\b/],
 ['Jugadores',/\b(jesus navas|pepe reina|javi martinez|david silva|sergio ramos|ramos|iscomania)\b/],
 ['Cuenta deportiva',/@(demarkesports|laligalondon)\b/]
];
const political=/\b(xavier garcia albiol|xavi garcia albiol|alcalde de badalona|alcaldia de badalona|albiol_xg)\b/;
export function clasificarFutbol(post,excluidos=new Set()){
 const texto=normalizarTexto(post?.texto||'');
 const id=String(post?.id||'');
 const descartado=excluidos.has(id);
 const albiol=/\balbiol\b/.test(texto);
 const raul=/\b(raul\s+(?:[a-z]\.?\s+)?albiol|albiol[\s,]+raul)\b/.test(texto);
 const indicators=sports.filter(([_,rx])=>rx.test(texto)).map(([name])=>name);
 const xavier=political.test(texto);
 let categoria=null;
 if(descartado)categoria='excluido_confirmado';
 else if(raul&&xavier)categoria='mixto_revisar';
 else if(raul)categoria='alta_probabilidad';
 else if(albiol&&indicators.length>=1&&xavier)categoria='mixto_revisar';
 else if(albiol&&indicators.length>=1)categoria='contexto_futbol';
 if(!categoria)return null;
 return {categoria,indicadores:[...(raul?['Nombre Raúl Albiol']:[]),...indicators],
    mencion_raul:raul,mencion_xavier:xavier,excluido:descartado};
}
