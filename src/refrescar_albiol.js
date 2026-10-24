import {leerJSON,escribirJSON,guardarLote,todosLosPosts} from './almacen.js';

// Refresco extraordinario y acotado del TOP de la cuenta de Albiol.
// Máximo: una página de 20 publicaciones propias y una lectura de los ID antiguos
// que esa página no incluya. Sin búsquedas masivas ni compra de créditos.
const cfg=leerJSON('config/fuentes.json',null);
const token=process.env.X_BEARER_TOKEN;
if(!token)throw Error('Falta X_BEARER_TOKEN; no se ha consultado la API de X.');
const api='https://api.x.com/2';
const fields='created_at,author_id,conversation_id,lang,public_metrics,referenced_tweets,note_tweet';
const estado=leerJSON('data/estado.json',{version:1,por_fuente:{},avisos:[]});
const presupuesto=estado.presupuesto_visor||{moneda:'USD',gasto_estimado:0,lecturas:0,usuarios:0};
let peticiones=0,leidos=0,nuevos=0;
const avisos=[];
const recogidos=new Set();

async function xget(url){
  const r=await fetch(url,{headers:{Authorization:'Bearer '+token}});
  if(!r.ok){
    const mensaje=(await r.text()).slice(0,220);
    throw Error('X API HTTP '+r.status+' '+mensaje);
  }
  peticiones++;
  const dato=await r.json();
  const n=dato.data?.length||0,u=dato.includes?.users?.length||0;
  leidos+=n;
  presupuesto.lecturas=(presupuesto.lecturas||0)+n;
  presupuesto.usuarios=(presupuesto.usuarios||0)+u;
  presupuesto.gasto_estimado=Math.round(((presupuesto.gasto_estimado||0)+n*0.005+u*0.01)*10000)/10000;
  return dato;
}
function guardar(data,procedencia,usuarios={}){
  const utilizables=(data||[]).filter(p=>p.id&&p.created_at&&Date.parse(p.created_at)>=Date.parse(cfg.inicio_utc));
  for(const p of utilizables)recogidos.add(String(p.id));
  const res=guardarLote(utilizables,procedencia,usuarios);
  nuevos+=res.nuevos;
  return utilizables.length;
}
async function main(){
  // Consulta de saldo informativa: no compra ni solicita recarga.
  try{
    const r=await fetch(api+'/usage/credits',{headers:{Authorization:'Bearer '+token}});
    if(r.ok){
      const v=Number((await r.json()).data?.total_balance);
      if(Number.isFinite(v)){
        estado.saldo_x_ultimo_usd=v;
        if(v<=0){
          console.log('REFRESCO_ALBIOL SIN SALDO: 0 publicaciones consultadas; no se ha intentado recargar.');
          return;
        }
      }
    }
  }catch{avisos.push('No fue posible consultar el saldo antes de la actualización.');}

  const propiosAntes=todosLosPosts().filter(p=>p.id&&!p.republica_a&&p.procedencias?.includes('actividad_propia'));
  const final=new Date(Date.now()-20000).toISOString();
  const q=new URLSearchParams({
    query:'from:'+cfg.cuenta_principal+' -is:retweet',
    max_results:'20',
    'tweet.fields':fields,
    expansions:'author_id',
    'user.fields':'username,name',
    start_time:cfg.inicio_utc,
    end_time:final
  });
  const primer=await xget(api+'/tweets/search/recent?'+q);
  const usuarios=Object.fromEntries((primer.includes?.users||[]).map(u=>[String(u.id),u]));
  const firstCount=guardar(primer.data,'actividad_propia',usuarios);
  if(primer.meta?.next_token)avisos.push('Hay más de 20 publicaciones propias; por ahorro no se ha paginado.');

  const faltantes=propiosAntes.filter(p=>!recogidos.has(String(p.id))).slice(0,100);
  if(faltantes.length){
    const lookup=new URLSearchParams({ids:faltantes.map(p=>p.id).join(','),'tweet.fields':fields});
    try{
      const segundo=await xget(api+'/tweets?'+lookup);
      for(const p of segundo.data||[]){
        const anterior=faltantes.find(x=>String(x.id)===String(p.id));
        guardar([p],anterior?.procedencias?.[0]||'actividad_propia');
      }
    }catch(e){avisos.push('No se actualizaron algunas métricas anteriores: '+e.message);}
  }
  estado.presupuesto_visor=presupuesto;
  estado.ultimo_refresco_albiol={
    ejecutado_en:new Date().toISOString(),peticiones,leidos,nuevos,
    publicaciones_propias_observadas:firstCount,
    antiguas_consultadas:faltantes.length,avisos
  };
  escribirJSON('data/estado.json',estado);
  console.log('REFRESCO_ALBIOL '+JSON.stringify(estado.ultimo_refresco_albiol));
}
main().catch(e=>{console.error('REFRESCO_ALBIOL ERROR: '+e.message);process.exitCode=1;});
