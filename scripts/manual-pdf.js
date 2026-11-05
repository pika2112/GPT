'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
 const win = new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await win.loadFile(path.join(__dirname,'../docs/manual.html'));
 await win.webContents.executeJavaScript('document.fonts.ready.then(()=>Promise.all(Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise((resolve,reject)=>{i.onload=resolve;i.onerror=reject;}))))');
 const pdf = await win.webContents.printToPDF({
  pageSize:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,
  generateTaggedPDF:true,generateDocumentOutline:true,headerTemplate:'<span></span>',
  footerTemplate:'<div style="width:100%;padding:0 17mm;font-family:Arial;font-size:8px;color:#64745f;display:flex;justify-content:space-between"><span>Sistema de Chamadas · Manual de instalação e utilização · 3.0.0</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
 });
 const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
 if(pages!==10)throw new Error('Manual layout changed: expected 10 pages, got '+pages);
 fs.writeFileSync(path.join(__dirname,'../docs/Manual-Sistema-Chamadas-3.0.0.pdf'),pdf);
 console.log('Manual PDF generated:',pdf.length,'bytes');app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
