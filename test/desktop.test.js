'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const vm = require('node:vm');
const path = require('node:path');
const { EventEmitter } = require('node:events');
async function harness(t, { trayError = false, serverError } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const h = { notices: [], dialogs: [], closed: false, active: false, process: new EventEmitter() };
    h.events = new EventEmitter();
    h.service = { eventos: h.events, pastaDados: dir, estado: () => ({ chamadaAtiva: h.active }), iniciar: async () => { if (serverError) throw serverError; return 3000; }, fechar: async () => { h.closed = true; } };
    h.app = new EventEmitter();
    Object.assign(h.app, { setAppUserModelId() {}, disableHardwareAcceleration() {}, requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), getPath: () => dir, getVersion: () => '2.0.1', getLoginItemSettings: () => ({ openAtLogin: false }), isPackaged: true, quit() { h.app.emit('before-quit', { preventDefault() {} }); } });
    Object.assign(h.process, { platform: 'win32', arch: 'x64', argv: [], env: {}, versions: { electron: '22.3.27' } });
    class Win extends EventEmitter {
        constructor() { super(); h.win = this; this.visible = true; this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = () => {}; this.webContents.session = { setPermissionRequestHandler() {} }; }
        async loadURL() {} isDestroyed() { return false; } isMinimized() { return true; } restore() { this.restored = true; } show() { this.visible = true; } hide() { this.visible = false; } focus() {} flashFrame(v) { this.flash = v; } isVisible() { return this.visible; }
    }
    class MockTray extends EventEmitter { constructor() { super(); if (trayError) throw Error('No tray'); h.tray = this; } setContextMenu(v) { this.menu = v; } setToolTip() {} }
    class Notice extends EventEmitter { static isSupported() { return true; } constructor() { super(); h.notices.push(this); } show() { this.shown = true; } close() { this.closed = true; } }
    const electron = { app: h.app, BrowserWindow: Win, Tray: MockTray, Menu: { buildFromTemplate: x => x }, Notification: Notice, nativeImage: { createFromPath: () => ({}) }, shell: { openPath() {} }, dialog: { showMessageBox: async options => { h.dialogs.push(options); return { response: 0 }; }, showErrorBox() {} } };
    const root = path.join(__dirname, '..');
    vm.runInNewContext(fs.readFileSync(path.join(root, 'desktop.js'), 'utf8'), { require: n => n === 'electron' ? electron : n === './servidor' ? { criarServidor: () => h.service } : require(n.startsWith('.') ? path.join(root, n) : n), __dirname: root, process: h.process, console, URL, setInterval: fn => { h.tick = fn; return 1; }, clearInterval() {} });
    await new Promise(r => setImmediate(r));
    h.log = () => fs.readFileSync(path.join(dir, 'arranque.log'), 'utf8');
    return h;
}
test('closing hides the window; calls restore it; shutdown stops the service', async t => {
    const h = await harness(t); assert.ok(h.tray); assert.match(h.log(), /Aplicação pronta/);
    let prevented = false; h.win.emit('close', { preventDefault() { prevented = true; } });
    assert.ok(prevented); assert.equal(h.win.visible, false); assert.equal(h.closed, false);
    h.active = true; h.events.emit('chamada'); assert.equal(h.win.visible, true); assert.ok(h.win.restored); assert.ok(h.notices[0].shown);
    h.win.hide(); h.tick(); assert.equal(h.win.visible, true); assert.equal(h.notices.length, 2);
    h.active = false; h.events.emit('estado', { chamadaAtiva: false }); assert.ok(h.notices[1].closed); assert.equal(h.win.flash, false);
    h.app.quit(); await new Promise(r => setImmediate(r)); assert.ok(h.closed);
});
test('startup errors show a useful message and persist the error log', async t => {
    const h = await harness(t, { serverError: Object.assign(Error('Port in use'), { code: 'EADDRINUSE' }) });
    assert.match(h.dialogs[0].message, /porta 3000/); assert.match(h.log(), /Port in use/); assert.ok(h.closed);
});
test('an unavailable tray never hides the running app', async t => {
    const h = await harness(t, { trayError: true }); assert.equal(h.tray, undefined); assert.ok(h.win.visible);
    let prevented = false; h.win.emit('close', { preventDefault() { prevented = true; } }); assert.equal(prevented, false);
    assert.match(h.log(), /Área de notificação indisponível/); h.app.emit('window-all-closed'); await new Promise(r => setImmediate(r)); assert.ok(h.closed);
});
