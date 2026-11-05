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

test('duplicate requests acknowledge the sender without rebroadcasting or retriggering an alarm',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'no-op-')),s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 t.after(async()=>{await s.fechar();fs.rmSync(dir,{recursive:true,force:true});});
 const a=await connect(await s.iniciar());await a.next('estado');let alarms=0;s.eventos.on('chamada',()=>alarms++);
 a.ws.send(JSON.stringify({tipo:'chamar',pedidoId:'repeat'}));await a.next('atualizacao');await a.next('confirmacao');
 a.ws.send(JSON.stringify({tipo:'chamar',pedidoId:'repeat'}));await a.next('estado');await a.next('confirmacao');
 assert.equal(alarms,1);assert.equal(s.estado().chamadas.length,1);
});
test('closing releases HTTP keep-alive sockets and is safe to repeat',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'closing-')),s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 const port=await s.iniciar();await fetch(`http://127.0.0.1:${port}/`);
 await Promise.race([Promise.all([s.fechar(),s.fechar()]),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Shutdown blocked by keep-alive')),1000);t.unref();})]);fs.rmSync(dir,{recursive:true,force:true});
});
test('invalid records are refused without overwriting the history file',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'invalid-')),p=path.join(dir,'chamadas.json');
 try{const text=JSON.stringify({versao:1,chamadas:[{id:'old',resolvida:false,horaChamada:'invalid'}]});fs.writeFileSync(p,text);assert.throws(()=>criarServidor({pastaDados:dir}),/Histórico inválido/);assert.equal(fs.readFileSync(p,'utf8'),text);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('equipment roles use the socket IP, survive restart and preserve calls and names', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roles-')),p=path.join(dir,'chamadas.json');
 fs.writeFileSync(p,JSON.stringify({versao:1,chamadas:[],postos:{'127.0.0.1':'Marcelo'}}));
 let s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 t.after(async()=>{await s.fechar();fs.rmSync(dir,{recursive:true,force:true});});
 const c=await connect(await s.iniciar(),{headers:{'X-Forwarded-For':'10.21.225.99'}});
 assert.deepEqual((await c.next('estado')).dados.funcoes,{});
 const send=async msg=>{c.ws.send(JSON.stringify(msg));await c.next('confirmacao');};
 await send({tipo:'chamar',pedidoId:'role-call'});const id=s.estado().chamadas[0].id;
 let alarms=0,updates=0;s.eventos.on('chamada',()=>alarms++);s.eventos.on('estado',()=>updates++);
 await send({tipo:'escolher-funcao',funcao:'backoffice',ip:'10.21.225.99',pedidoId:'role-first'});
 assert.deepEqual(s.estado().funcoes,{'127.0.0.1':'backoffice'});
 await send({tipo:'escolher-funcao',funcao:'backoffice',pedidoId:'role-first'});
 assert.equal(updates,1);assert.equal(alarms,0);
 c.ws.send(JSON.stringify({tipo:'escolher-funcao',funcao:'admin',pedidoId:'bad-role'}));
 assert.match((await c.next('erro')).mensagem,/Função inválida/);
 await s.fechar();s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 const b=await connect(await s.iniciar()),state=await b.next('estado');
 assert.equal(state.ipCliente,'127.0.0.1');assert.equal(state.dados.funcoes[state.ipCliente],'backoffice');
 assert.equal(state.dados.chamadas[0].id,id);assert.equal(state.dados.postos['127.0.0.1'],'Marcelo');
 fs.mkdirSync(p+'.tmp');b.ws.send(JSON.stringify({tipo:'escolher-funcao',funcao:'colaborador',pedidoId:'role-disk-error'}));
 await b.next('erro');assert.equal(s.estado().funcoes['127.0.0.1'],'backoffice');
 assert.equal(JSON.parse(fs.readFileSync(p)).funcoes['127.0.0.1'],'backoffice');
 fs.rmdirSync(p+'.tmp');b.ws.send(JSON.stringify({tipo:'escolher-funcao',funcao:'colaborador',pedidoId:'role-last'}));await b.next('confirmacao');
 await s.fechar();s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 assert.equal(s.estado().funcoes['127.0.0.1'],'colaborador');
 assert.equal(s.estado().chamadas[0].id,id);assert.equal(s.estado().chamadas[0].resolvida,false);
});
test('invalid equipment roles are rejected without overwriting the file',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roles-invalid-')),p=path.join(dir,'chamadas.json');
 try{for(const funcoes of [null,[],{'not-an-ip':'backoffice'},{'127.0.0.1':'admin'}]){
  const text=JSON.stringify({versao:1,chamadas:[],funcoes});fs.writeFileSync(p,text);
  assert.throws(()=>criarServidor({pastaDados:dir}),/Funções dos equipamentos inválidas/);assert.equal(fs.readFileSync(p,'utf8'),text);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('choosing a role preserves preferences for other equipment IPs',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roles-other-'));
 fs.writeFileSync(path.join(dir,'chamadas.json'),JSON.stringify({versao:1,chamadas:[],funcoes:{'10.21.225.7':'backoffice','10.21.225.20':'colaborador'}}));
 const s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});t.after(async()=>{await s.fechar();fs.rmSync(dir,{recursive:true,force:true});});
 const c=await connect(await s.iniciar());await c.next('estado');c.ws.send(JSON.stringify({tipo:'escolher-funcao',funcao:'colaborador',pedidoId:'third-ip',ip:'10.21.225.7'}));await c.next('confirmacao');
 assert.deepEqual(s.estado().funcoes,{'10.21.225.7':'backoffice','10.21.225.20':'colaborador','127.0.0.1':'colaborador'});
});

test('pharmacy name persists, syncs to other clients and preserves existing data',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pharmacy-name-')),p=path.join(dir,'chamadas.json');
 fs.writeFileSync(p,JSON.stringify({versao:1,chamadas:[],postos:{'127.0.0.1':'Marcelo'},funcoes:{'127.0.0.1':'backoffice'}}));
 let s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 t.after(async()=>{await s.fechar();fs.rmSync(dir,{recursive:true,force:true});});
 const port=await s.iniciar(),a=await connect(port),b=await connect(port);
 assert.equal((await a.next('estado')).dados.configuracao.nomeFarmacia,'Farmácia');await b.next('estado');
 let alarms=0;s.eventos.on('chamada',()=>alarms++);
 const send=async msg=>{a.ws.send(JSON.stringify(msg));await a.next('confirmacao');};
 await send({tipo:'configurar-farmacia',nomeFarmacia:'  Farmácia Central & Saúde  ',pedidoId:'pharmacy-name'});
 assert.equal((await b.next('atualizacao')).dados.configuracao.nomeFarmacia,'Farmácia Central & Saúde');
 assert.equal(alarms,0);assert.deepEqual(s.estado().funcoes,{'127.0.0.1':'backoffice'});assert.equal(s.estado().postos['127.0.0.1'],'Marcelo');
 await send({tipo:'chamar',pedidoId:'named-call'});const id=s.estado().chamadas[0].id;
 assert.equal(JSON.parse(fs.readFileSync(p)).configuracao.nomeFarmacia,'Farmácia Central & Saúde');
 fs.mkdirSync(p+'.tmp');a.ws.send(JSON.stringify({tipo:'configurar-farmacia',nomeFarmacia:'Outro nome',pedidoId:'name-disk-error'}));await a.next('erro');
 assert.equal(s.estado().configuracao.nomeFarmacia,'Farmácia Central & Saúde');fs.rmdirSync(p+'.tmp');
 for(const name of ['', '   ', 'x'.repeat(101), null, 'Inválido\nNome']){
  a.ws.send(JSON.stringify({tipo:'configurar-farmacia',nomeFarmacia:name,pedidoId:'bad-name'}));
  assert.match((await a.next('erro')).mensagem,/Nome da farmácia inválido/);
 }
 await s.fechar();s=criarServidor({porta:0,host:'127.0.0.1',pastaDados:dir});
 const c=await connect(await s.iniciar()),state=await c.next('estado');
 assert.equal(state.dados.configuracao.nomeFarmacia,'Farmácia Central & Saúde');assert.equal(state.dados.chamadas[0].id,id);
 assert.equal(state.dados.postos['127.0.0.1'],'Marcelo');assert.equal(state.dados.funcoes['127.0.0.1'],'backoffice');
});
test('invalid pharmacy configuration is rejected without overwriting saved data',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pharmacy-invalid-')),p=path.join(dir,'chamadas.json');
 try{for(const configuracao of [null,[],{}, {nomeFarmacia:''},{nomeFarmacia:42}]){
  const text=JSON.stringify({versao:1,chamadas:[],configuracao});fs.writeFileSync(p,text);
  assert.throws(()=>criarServidor({pastaDados:dir}),/Configuração da farmácia inválida/);assert.equal(fs.readFileSync(p,'utf8'),text);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
