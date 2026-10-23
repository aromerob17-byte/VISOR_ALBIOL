// Detección deliberadamente prudente; conservamos por separado el valor facilitado por X.
const ca = new Set('els les del dels amb aquest aquesta això però perquè molt tenim som nosaltres seva seves avui demà també així gràcies carrer barri ajuntament veïns veïnes ciutat feina volem hem cal nostre nostra vostres'.split(' '));
const es = new Set('los las del con este esta esto pero porque muy tenemos somos nosotros su sus hoy mañana también así gracias calle barrio ayuntamiento vecinos vecinas ciudad trabajo queremos hemos hace nuestro nuestra ustedes'.split(' '));
function palabras(s) { return (s || '').toLocaleLowerCase('ca').match(/[\p{L}]+/gu) || []; }
export function detectarIdioma(texto, xLang = 'und') {
  const words = palabras(texto);
  const catalan = words.reduce((a,w) => a + Number(ca.has(w)),0);
  const espanol = words.reduce((a,w) => a + Number(es.has(w)),0);
  if (catalan >= 2 && espanol >= 2) return {codigo:'mixto',metodo:'lexico',confianza:'media'};
  if (catalan >= espanol + 2) return {codigo:'ca',metodo:'lexico',confianza:'media'};
  if (espanol >= catalan + 2) return {codigo:'es',metodo:'lexico',confianza:'media'};
  if (xLang === 'ca' || xLang === 'es') return {codigo:xLang,metodo:'x',confianza:'baja'};
  if (xLang && xLang !== 'und') return {codigo:'otro',metodo:'x',confianza:'baja',idioma_x:xLang};
  return {codigo:'indeterminado',metodo:'insuficiente',confianza:'baja'};
}
