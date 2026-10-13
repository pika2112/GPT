'use strict';
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell, dialog, ipcMain } = require('electron');
const path = require('node:path');
const os = require('node:os');
const smoke = process.argv.includes('--smoke-test');
let janela, tray, servico, sair = false, alerta, lembrete, log;
const porta = 3000;
app.setAppUserModelId('pt.loja.sistema-chamadas');
// This app does not require a GPU; avoid driver-related startup failures.
app.disableHardwareAcceleration();
function registar(message) { if (log) log.escrever(message); else console.error(message); }
async function falhar(erro) {
    registar(`ERRO: ${erro.stack || erro}`);
    if (!smoke) {
        const detalhe = erro.code === 'EADDRINUSE' ? 'A porta 3000 está ocupada. Feche o servidor anterior.' : 'Não foi possível iniciar. O histórico não foi apagado.';
        try { await dialog.showMessageBox({ type: 'error', title: 'Sistema de Chamadas', message: detalhe, detail: `${erro.message}\n\nLog: ${log?.ficheiro || 'indisponível'}` }); }
        catch { dialog.showErrorBox('Sistema de Chamadas', `${erro.message}\nLog: ${log?.ficheiro || 'indisponível'}`); }
    }
    sair = true;
    if (smoke) { if (servico) await servico.fechar(); app.exit(1); }
    else app.quit();
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
    app.on('second-instance', () => mostrar());
    app.whenReady().then(iniciar).catch(falhar);
    process.on('uncaughtException', falhar);
    process.on('unhandledRejection', falhar);
}
function mostrar() {
    if (!janela || janela.isDestroyed()) return;
    if (janela.isMinimized()) janela.restore();
    janela.show(); janela.focus();
}
function menu() {
    if (!tray || !servico) return;
    const enderecos = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${porta}`);
    const startup = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Abrir Back Office', click: mostrar },
        { label: servico.estado().chamadaAtiva ? 'Chamada por atender' : 'Sem chamadas pendentes', enabled: false },
        { type: 'separator' },
        { label: 'Endereços para colaboradores', submenu: enderecos.length ? enderecos.map(url => ({ label: url, click: () => { require('electron').clipboard.writeText(url); dialog.showMessageBox({ message: 'Endereço copiado', detail: `Abra ${url} no navegador dos colaboradores, na mesma rede.` }); } })) : [{ label: 'Sem ligação à rede', enabled: false }] },
        { label: 'Abrir pasta do histórico', click: () => shell.openPath(servico.pastaDados) },
        { label: 'Abrir log de arranque', click: () => shell.openPath(log.ficheiro) },
        { label: 'Iniciar com o Windows', type: 'checkbox', checked: process.platform === 'win32' && app.getLoginItemSettings({ path: startup }).openAtLogin, enabled: app.isPackaged && process.platform === 'win32', click: item => app.setLoginItemSettings({ openAtLogin: item.checked, path: startup }) },
        { type: 'separator' },
        { label: 'Sair e parar o serviço…', click: async () => {
            const { response } = await dialog.showMessageBox({ type: 'warning', buttons: ['Continuar a receber chamadas', 'Sair'], defaultId: 0, cancelId: 0, message: 'Parar o Sistema de Chamadas?', detail: 'Os colaboradores deixarão de conseguir enviar chamadas até abrir a aplicação novamente.' });
            if (response === 1) { sair = true; app.quit(); }
        } }
    ]));
}
function notificar() {
    const dados = servico?.estado();
    if (!dados?.chamadaAtiva) return;
    const chamada = dados.chamadas.find(c => !c.resolvida);
    mostrar(); janela.flashFrame(true);
    try {
        if (Notification.isSupported()) {
            alerta?.close();
            alerta = new Notification({ title: 'Farmácia Faria · Atendimento', body: `${dados.postos?.[chamada?.origemIp] || chamada?.origemNome || chamada?.origemIp || 'Um posto'} está à espera.`, silent: false, timeoutType: 'never' });
            alerta.on('click', mostrar); alerta.show();
        }
    } catch (erro) { registar(`Notificação indisponível: ${erro.message}`); }
}
async function iniciar() {
    const userData = smoke && process.env.CHAMADAS_SMOKE_DATA ? process.env.CHAMADAS_SMOKE_DATA : app.getPath('userData');
    log = require('./scripts/startup-log').criarLog(userData);
    registar(`Arranque v${app.getVersion()} / ${process.platform} ${process.arch} / Electron ${process.versions.electron}`);
    // Load server dependencies within the startup error handler, not before it.
    const { criarServidor } = require('./servidor');
    servico = criarServidor({ porta, pastaDados: path.join(userData, 'dados') });
    await servico.iniciar(); registar('Servidor pronto na porta 3000.');
    janela = new BrowserWindow({ width: 1200, height: 850, minWidth: 660, minHeight: 560, title: 'Farmácia Faria · Atendimento', icon: path.join(__dirname, 'assets', 'tray.png'), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    // Never hide the app if a tray icon could not be created.
    janela.on('close', event => { if (!sair && tray) { event.preventDefault(); janela.hide(); } });
    janela.on('focus', () => janela.flashFrame(false));
    janela.webContents.on('render-process-gone', (_event, details) => falhar(new Error(`A janela terminou: ${details.reason}`)));
    janela.webContents.on('preload-error', (_event, _file, erro) => registar(`Preload: ${erro.stack}`));
    const local = `http://127.0.0.1:${porta}`;
    janela.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== local) event.preventDefault(); });
    janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    janela.webContents.session.setPermissionRequestHandler((contents, permission, callback) => callback(contents === janela.webContents && new URL(contents.getURL()).origin === local && permission === 'notifications'));
    function autorizarSettings(event) {
        if (event.sender !== janela.webContents || new URL(event.senderFrame.url).origin !== local) throw new Error('Pedido não autorizado.');
    }
    const startupPath = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
    ipcMain.handle('faria:get-startup', event => { autorizarSettings(event);return process.platform === 'win32' && app.getLoginItemSettings({ path: startupPath }).openAtLogin; });
    ipcMain.handle('faria:set-startup', (event, enabled) => {
        autorizarSettings(event);if (typeof enabled !== 'boolean' || process.platform !== 'win32') throw new Error('Opção inválida.');
        app.setLoginItemSettings({ openAtLogin: enabled, path: startupPath });menu();return app.getLoginItemSettings({ path: startupPath }).openAtLogin;
    });
    await janela.loadURL(local); registar('Janela carregada.');
    try {
        const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
        tray = new Tray(icon);tray.setToolTip('Farmácia Faria · A receber chamadas');tray.on('double-click', mostrar);tray.on('right-click', menu);menu();
        registar('Ícone da área de notificação pronto.');
    } catch (erro) { tray = null; registar(`Área de notificação indisponível; mantenha a janela aberta: ${erro.message}`); }
    servico.eventos.on('chamada', notificar);
    servico.eventos.on('estado', estado => { menu(); if (!estado.chamadaAtiva) { alerta?.close();janela.flashFrame(false); } });
    lembrete = setInterval(() => { if (servico?.estado().chamadaAtiva && !janela.isVisible()) notificar(); }, 20000);
    if (servico.estado().chamadaAtiva) notificar();
    registar('Aplicação pronta.');
    if (smoke) { await require('./scripts/smoke-desktop')({ janela, servico, tray, log });sair = true;app.quit(); }
}
app.on('window-all-closed', () => { if (!tray) { sair = true;app.quit(); } });
app.on('before-quit', event => {
    sair = true;
    if (servico) {
        event.preventDefault();clearInterval(lembrete);alerta?.close();
        const encerrar = servico;servico = null;
        encerrar.fechar().finally(() => app.quit());
    }
});
