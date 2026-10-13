'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { criarServidor } = require('../servidor');
async function connect(port, options = {}) {
 const ws=new WebSocket(`ws://127.0.0.1:${port}`, options),queue=[],waiters=[];
 ws.on('message',raw=>{const m=JSON.parse(raw);const w=waiters.find(x=>x.type===m.tipo);if(w){waiters.splice(waiters.indexOf(w),1);w.resolve(m);}else queue.push(m);});
 await once(ws,'open');
 return {ws,next:type=>{const i=queue.findIndex(m=>m.tipo===type);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`No ${type}`)),3000);waiters.push({type,resolve:m=>{clearTimeout(timer);resolve(m);}});});}};
}
test('saved calls survive restart; duplicate and stale actions cannot corrupt state',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chamadas-'));let s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 t.after(async()=>{await s.fechar();fs.rmSync(dir,{recursive:true,force:true});});
 const port=await s.iniciar(),a=await connect(port),b=await connect(port);
 assert.equal((await a.next('estado')).dados.chamadas.length,0);await b.next('estado');
 const send=async(client,msg)=>{client.ws.send(JSON.stringify(msg));return client.next('confirmacao');};
 await send(a,{tipo:'chamar',pedidoId:'first'});const saved=JSON.parse(fs.readFileSync(path.join(dir,'chamadas.json')));assert.equal(saved.chamadas.length,1);const id=saved.chamadas[0].id;
 assert.equal((await b.next('atualizacao')).dados.chamadaAtiva,true);
 await send(b,{tipo:'chamar',pedidoId:'second'});assert.equal(s.estado().chamadas.length,1);
 await s.fechar();s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});const port2=await s.iniciar(),c=await connect(port2);assert.equal((await c.next('estado')).dados.chamadas[0].id,id);
 await send(c,{tipo:'atendido',pedidoId:'resolve',chamadaId:id});assert.equal(s.estado().chamadaAtiva,false);assert.ok(s.estado().chamadas[0].horaResolucao);
 await send(c,{tipo:'chamar',pedidoId:'first'});assert.equal(s.estado().chamadas.length,1);
 await send(c,{tipo:'chamar',pedidoId:'third'});assert.equal(s.estado().chamadas.length,2);
 await send(c,{tipo:'atendido',pedidoId:'stale',chamadaId:id});assert.equal(s.estado().chamadaAtiva,true);
 const root=await fetch(`http://127.0.0.1:${port2}/`);assert.equal(root.status,200);assert.match(await root.text(),/Histórico e análise/);
 for(const url of ['/dados/chamadas.json','/servidor.js','/package.json'])assert.equal((await fetch(`http://127.0.0.1:${port2}${url}`)).status,404);
 c.ws.send('bad json');assert.equal((await c.next('erro')).tipo,'erro');
});
test('disk errors are reported without applying an unsaved change',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chamadas-')),s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 t.after(async()=>{await s.fechar();fs.rmSync(dir,{recursive:true,force:true});});const c=await connect(await s.iniciar());await c.next('estado');
 fs.mkdirSync(path.join(dir,'chamadas.json.tmp'));c.ws.send(JSON.stringify({tipo:'chamar',pedidoId:'disk-error'}));await c.next('erro');assert.equal(s.estado().chamadas.length,0);
});
test('a damaged history file is preserved and never silently replaced',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chamadas-'));try{const p=path.join(dir,'chamadas.json');fs.writeFileSync(p,'broken');assert.throws(()=>criarServidor({pastaDados:dir}));assert.equal(fs.readFileSync(p,'utf8'),'broken');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('socket IP is authentic; aliases persist and do not change the historical records', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'postos-'));let s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 t.after(async()=>{await s.fechar();fs.rmSync(dir,{recursive:true,force:true});});
 const c=await connect(await s.iniciar(),{headers:{'X-Forwarded-For':'10.21.225.99'}});await c.next('estado');
 const send=async msg=>{c.ws.send(JSON.stringify(msg));return c.next('confirmacao');};
 await send({tipo:'configurar-posto',ip:'127.0.0.1',nome:'Marcelo',pedidoId:'alias'});
 await send({tipo:'chamar',pedidoId:'ip-call',origemIp:'10.21.225.88'});
 assert.equal(s.estado().chamadas[0].origemIp,'127.0.0.1');assert.equal(s.estado().chamadas[0].origemNome,'Marcelo');
 c.ws.send(JSON.stringify({tipo:'configurar-posto',ip:'not-an-ip',nome:'Vítor',pedidoId:'bad-ip'}));assert.match((await c.next('erro')).mensagem,/IP inválido/);
 const callId=s.estado().chamadas[0].id;await s.fechar();s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 assert.equal(s.estado().postos['127.0.0.1'],'Marcelo');assert.equal(s.estado().chamadas[0].id,callId);const port=await s.iniciar();
 const b=await connect(port);await b.next('estado');b.ws.send(JSON.stringify({tipo:'remover-posto',ip:'127.0.0.1',pedidoId:'remove'}));await b.next('confirmacao');assert.equal(s.estado().postos['127.0.0.1'],undefined);assert.equal(s.estado().chamadas[0].origemNome,'Marcelo');
});
