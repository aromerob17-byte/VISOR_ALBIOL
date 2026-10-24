import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clasificarFutbol} from '../src/clasificar_futbol.js';

const ex=JSON.parse(fs.readFileSync('config/exclusiones.json','utf8'));
const ids=new Set(ex.registros.map(r=>r.id));
const politicos=new Set(ex.conservados_politicos||[]);
test('Se bloquean 80 registros futbolísticos y se protegen los 27 políticos',()=>{
 assert.equal(ids.size,80);
 assert.equal(politicos.size,27);
 assert.ok([...politicos].every(id=>!ids.has(id)));
 const p={id:'2112675833831629280',texto:'I miss Raúl Albiol at Villarreal'};
 assert.equal(clasificarFutbol(p,ids).categoria,'excluido_confirmado');
 assert.equal(clasificarFutbol({id:'1',texto:'Xavier García Albiol habla de Badalona'},ids),null);
});
test('Raúl Albiol sin tilde se detecta como futbolista probable',()=>{
 assert.equal(clasificarFutbol({id:'2',texto:'Ramos Raul Albiol David Silva'},ids).categoria,'alta_probabilidad');
});
test('Referencia deportiva sin nombre exige revisión, no exclusión',()=>{
 assert.equal(clasificarFutbol({id:'3',texto:'Albiol y el Villarreal hablan de fútbol'},ids).categoria,'contexto_futbol');
 assert.equal(clasificarFutbol({id:'4',texto:'Xavier García Albiol comenta el fútbol en Badalona'},ids).categoria,'mixto_revisar');
});
