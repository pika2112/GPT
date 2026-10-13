'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../public/vendor/xlsx.full.min.js');
const { criarXls, criarWorkbook } = require('../public/excel-export');
function ler(options) {
 const bytes = Buffer.from(criarXls(options));
 assert.equal(bytes.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1','Must be a real OLE/BIFF XLS file');
 return XLSX.read(bytes,{type:'buffer',cellNF:true});
}
test('real XLS preserves names, IPs, Unicode, Lisbon dates and numeric waiting time',()=>{
 const call={id:'call-1',horaChamada:'2026-10-13T09:00:00Z',horaResolucao:'2026-10-13T09:01:05Z',resolvida:true,origemIp:'10.21.225.20',origemNome:'Antigo'};
 const book=ler({chamadas:[call],postos:{'10.21.225.20':'Vítor'},folha:'Hoje'}),sheet=book.Sheets.Hoje;
 assert.equal(sheet.B2.v,'Vítor');assert.equal(sheet.C2.v,'10.21.225.20');assert.equal(sheet.F2.v,65);assert.equal(sheet.F2.t,'n');
 assert.match(sheet.D2.w,/13\/10\/2026 10:00:00/);assert.match(sheet.E2.w,/13\/10\/2026 10:01:05/);assert.equal(sheet.H2.v,call.horaChamada);
});
test('pending calls and empty exports remain valid workbooks; names are text, never formulas',()=>{
 const book=ler({chamadas:[{id:'pending',horaChamada:'2026-10-13T09:00:00Z',horaResolucao:null,resolvida:false,origemIp:'127.0.0.1'}],postos:{'127.0.0.1':'=1+1'},agora:Date.parse('2026-10-13T09:02:10Z')}),sheet=book.Sheets.Chamadas;
 assert.equal(sheet.B2.t,'s');assert.equal(sheet.B2.v,'=1+1');assert.equal(sheet.B2.f,undefined);assert.equal(sheet.F2.v,130);assert.equal(sheet.G2.v,'Por atender');assert.ok(!sheet.E2 || sheet.E2.v==='');
 assert.equal(ler({chamadas:[]}).Sheets.Chamadas['!ref'],'A1:I1');
});

test('history beyond the XLS row limit is retained in additional sheets',()=>{
 const c={id:'record',horaChamada:'2026-10-13T09:00:00Z',horaResolucao:'2026-10-13T09:00:01Z',resolvida:true};
 const calls=Array(65535).fill(c);calls.push({...c,id:'last-record'});
 const book=criarWorkbook({chamadas:calls});assert.equal(book.SheetNames.length,2);
 assert.equal(book.Sheets['Chamadas 1']['!ref'],'A1:I65536');assert.equal(book.Sheets['Chamadas 2'].A2.v,'last-record');
});
