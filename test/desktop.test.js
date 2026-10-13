'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {EventEmitter}=require('node:events');
test('closing hides the window; a call restores it and notifies; shutdown stops the service',async()=>{
 let win,tray,notifications=[],tick,closed=false;const events=new EventEmitter();let active=false;
 const service={eventos:events,pastaDados:'/tmp/data',estado:()=>({chamadaAtiva:active}),iniciar:async()=>3000,fechar:async()=>{closed=true;}};
 const app=new EventEmitter();Object.assign(app,{setAppUserModelId(){},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),getPath:()=>'/tmp',getLoginItemSettings:()=>({openAtLogin:false}),quit(){app.emit('before-quit',{preventDefault(){}});}});
 class Win extends EventEmitter{constructor(){super();win=this;this.visible=true;this.focused=false;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.webContents.session={setPermissionRequestHandler(){}};}async loadURL(){}isDestroyed(){return false;}isMinimized(){return true;}restore(){this.restored=true;}show(){this.visible=true;}hide(){this.visible=false;}focus(){this.focused=true;}flashFrame(v){this.flash=v;}isVisible(){return this.visible;}}
 class MockTray extends EventEmitter{constructor(){super();tray=this;}setContextMenu(v){this.menu=v;}setToolTip(){}}
 class Notice extends EventEmitter{static isSupported(){return true;}constructor(){super();notifications.push(this);}show(){this.shown=true;}close(){this.closed=true;}}
 const electron={app,BrowserWindow:Win,Tray:MockTray,Menu:{buildFromTemplate:x=>x},Notification:Notice,nativeImage:{createFromPath:()=>({})},shell:{openPath(){}},dialog:{showMessageBox:async()=>({response:0})}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../desktop.js'),'utf8'),{require:n=>n==='electron'?electron:n==='./servidor'?{criarServidor:()=>service}:require(n),__dirname:path.join(__dirname,'..'),console,URL,setInterval:fn=>{tick=fn;return 1;},clearInterval(){}});
 await new Promise(r=>setImmediate(r));assert.ok(tray);let prevented=false;win.emit('close',{preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(win.visible,false);assert.equal(closed,false);
 active=true;events.emit('chamada');assert.equal(win.visible,true);assert.ok(win.restored);assert.ok(notifications[0].shown);
 win.hide();tick();assert.equal(win.visible,true);assert.equal(notifications.length,2);
 active=false;events.emit('estado',{chamadaAtiva:false});assert.ok(notifications[1].closed);assert.equal(win.flash,false);
 app.quit();await new Promise(r=>setImmediate(r));assert.ok(closed);
});
