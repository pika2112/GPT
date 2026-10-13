'use strict';
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell, dialog } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { criarServidor } = require('./servidor');
let janela, tray, servico, sair = false, alerta, lembrete;
const porta = 3000;
app.setAppUserModelId('pt.loja.sistema-chamadas');
if (!app.requestSingleInstanceLock()) app.quit();
else {
    app.on('second-instance', () => mostrar());
    app.whenReady().then(iniciar).catch(async erro => {
        await dialog.showMessageBox({ type: 'error', title: 'Sistema de Chamadas', message: 'Não foi possível iniciar a aplicação.', detail: `${erro.message}\nVerifique se a porta 3000 está disponível. O histórico não foi apagado.` });
        sair = true; app.quit();
    });
}
function mostrar() {
    if (!janela || janela.isDestroyed()) return;
    if (janela.isMinimized()) janela.restore();
    janela.show(); janela.focus();
}
function menu() {
    const enderecos = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${porta}`);
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Abrir Back Office', click: mostrar },
        { label: servico?.estado().chamadaAtiva ? 'Chamada por atender' : 'Sem chamadas pendentes', enabled: false },
        { type: 'separator' },
        { label: 'Endereços para colaboradores', submenu: enderecos.length ? enderecos.map(url => ({ label: url, click: () => { require('electron').clipboard.writeText(url); dialog.showMessageBox({ message: 'Endereço copiado', detail: `Abra ${url} no navegador dos colaboradores, na mesma rede.` }); } })) : [{ label: 'Sem ligação à rede', enabled: false }] },
        { label: 'Abrir pasta do histórico', click: () => shell.openPath(servico.pastaDados) },
        { label: 'Iniciar com o Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged, click: item => app.setLoginItemSettings({ openAtLogin: item.checked, path: process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe') }) },
        { type: 'separator' },
        { label: 'Sair e parar o serviço…', click: async () => {
            const { response } = await dialog.showMessageBox({ type: 'warning', buttons: ['Continuar a receber chamadas', 'Sair'], defaultId: 0, cancelId: 0, message: 'Parar o Sistema de Chamadas?', detail: 'Os colaboradores deixarão de conseguir enviar chamadas até abrir a aplicação novamente.' });
            if (response === 1) { sair = true; app.quit(); }
        } }
    ]));
}
function notificar() {
    if (!servico.estado().chamadaAtiva) return;
    mostrar(); janela.flashFrame(true);
    if (Notification.isSupported()) {
        alerta?.close();
        alerta = new Notification({ title: 'Atendimento necessário', body: 'Há uma chamada à espera. Abra o Back Office para atender.', silent: false, timeoutType: 'never' });
        alerta.on('click', mostrar); alerta.show();
    }
}
async function iniciar() {
    servico = criarServidor({ porta, pastaDados: path.join(app.getPath('userData'), 'dados') });
    await servico.iniciar();
    janela = new BrowserWindow({ width: 1200, height: 850, minWidth: 660, minHeight: 560, title: 'Sistema de Chamadas', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    const local = `http://127.0.0.1:${porta}`;
    janela.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== local) event.preventDefault(); });
    janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const session = janela.webContents.session;
    session.setPermissionRequestHandler((contents, permission, callback) => callback(contents === janela.webContents && new URL(contents.getURL()).origin === local && permission === 'notifications'));
    await janela.loadURL(local);
    janela.on('close', event => { if (!sair) { event.preventDefault(); janela.hide(); } });
    janela.on('focus', () => janela.flashFrame(false));
    // A small PNG is bundled so tray operation works without network access.
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
    tray = new Tray(icon);tray.setToolTip('Sistema de Chamadas · A receber chamadas');tray.on('double-click', mostrar);tray.on('right-click', menu);menu();
    servico.eventos.on('chamada', notificar);
    servico.eventos.on('estado', estado => { menu(); if (!estado.chamadaAtiva) { alerta?.close();janela.flashFrame(false); } });
    // Reminders are driven by the main process, independently of the renderer.
    lembrete = setInterval(() => { if (servico.estado().chamadaAtiva && !janela.isVisible()) notificar(); }, 20000);
    if (servico.estado().chamadaAtiva) notificar();
}
app.on('window-all-closed', () => {});
app.on('before-quit', event => {
    if (servico) {
        event.preventDefault(); sair = true;clearInterval(lembrete);alerta?.close();
        const encerrar = servico;servico = null;
        encerrar.fechar().finally(() => app.quit());
    }
});
