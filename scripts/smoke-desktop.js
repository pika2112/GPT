'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { WebSocket } = require('ws');
const fs = require('node:fs');
const path = require('node:path');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function esperar(check) {
    for (let i = 0; i < 100; i++) { if (await check()) return; await pause(100); }
    throw new Error('Desktop readiness timed out');
}
module.exports = async function testar({ janela, servico, tray, log }) {
    assert.equal(process.versions.electron, '44.7.2', 'The modern Windows build must use the pinned runtime');
    await esperar(() => janela.webContents.executeJavaScript("document.getElementById('connection').textContent.includes('Ligado')"));
    await esperar(() => janela.webContents.executeJavaScript("role === 'backoffice' && !request"));
    assert.equal(await janela.webContents.executeJavaScript('window.desktopApp'), true);
    assert.equal(await janela.webContents.executeJavaScript("document.getElementById('roleName').textContent"), 'Back Office');
    assert.equal(await janela.webContents.executeJavaScript('document.getElementById("analysisPanel").open'),false);
    assert.equal(await janela.webContents.executeJavaScript('typeof window.desktopSettings.getStartup === "function"'),true);
    assert.equal(await janela.webContents.executeJavaScript('document.getElementById("settingsDialog").open'),false);
    assert.equal(await janela.webContents.executeJavaScript('openSettings();document.getElementById("settingsDialog").open'),true);
    await esperar(() => janela.webContents.executeJavaScript('!document.getElementById("startupSettings").classList.contains("hidden")'));
    await janela.webContents.executeJavaScript('closeSettings()');
    assert.ok(janela.isVisible()); assert.ok(tray, 'System tray must be available');
    const ws = new WebSocket('ws://127.0.0.1:3000');
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    try {
        ws.send(JSON.stringify({ tipo: 'configurar-posto', ip: '127.0.0.1', nome: 'Marcelo', pedidoId: randomUUID() }));
        await esperar(() => servico.estado().postos['127.0.0.1'] === 'Marcelo');
        janela.close(); await esperar(() => !janela.isVisible());
        ws.send(JSON.stringify({ tipo: 'chamar', pedidoId: randomUUID() }));
        await esperar(() => servico.estado().chamadaAtiva && janela.isVisible());
        await esperar(() => janela.webContents.executeJavaScript("!document.getElementById('alert').classList.contains('hidden')"));
        assert.equal(await janela.webContents.executeJavaScript('document.querySelectorAll("#alert img").length'),0);
        assert.equal(await janela.webContents.executeJavaScript('getComputedStyle(document.getElementById("alert")).animationName'),await janela.webContents.executeJavaScript('matchMedia("(prefers-reduced-motion: reduce)").matches ? "none" : "chamadaVermelha"'));
        assert.equal(JSON.parse(fs.readFileSync(path.join(servico.pastaDados, 'chamadas.json'))).chamadas.length, 1);
        const id = servico.estado().chamadas[0].id;
        ws.send(JSON.stringify({ tipo: 'atendido', pedidoId: randomUUID(), chamadaId: id }));
        await esperar(() => !servico.estado().chamadaAtiva);
        await janela.webContents.executeJavaScript('document.getElementById("analysisPanel").open=true');
        await esperar(() => janela.webContents.executeJavaScript("document.getElementById('total').textContent === '1'"));
        assert.equal(await janela.webContents.executeJavaScript('document.getElementById("todayTotal").textContent'),'1');
        assert.ok(await janela.webContents.executeJavaScript('document.getElementById("todayLog").textContent.includes("Marcelo")'));
        assert.equal(await janela.webContents.executeJavaScript('typeof window.XLSX'),'undefined');
        await janela.webContents.executeJavaScript('ensureExcel()');
        assert.equal(await janela.webContents.executeJavaScript('Array.from(new Uint8Array(FariaExcel.criarXls({chamadas:todayCalls(),postos:posts})).slice(0,8)).map(x=>x.toString(16).padStart(2,"0")).join("")'),'d0cf11e0a1b11ae1');
        await janela.webContents.executeJavaScript('exportTodayXLS()');
        // A fresh browser window has no preload, sessionStorage or localStorage state.
        const { BrowserWindow } = require('electron');
        const browser = new BrowserWindow({show:false,webPreferences:{partition:'role-check-'+randomUUID(),nodeIntegration:false,contextIsolation:true,sandbox:true}});
        try {
            await browser.loadURL('http://127.0.0.1:3000');
            const js = source => browser.webContents.executeJavaScript(source);
            await esperar(() => js("ready && role === 'backoffice' && !request"));
            assert.equal(await js('window.desktopApp'),undefined);
            assert.equal(await js("document.getElementById('selection').classList.contains('hidden')"),true);
            await js("sessionStorage.setItem('posto','colaborador')");await browser.loadURL('http://127.0.0.1:3000');
            await esperar(() => js("ready && role === 'backoffice' && !request"));
            await js("changeRole()");await esperar(() => js("role === null"));
            assert.equal(servico.estado().funcoes['127.0.0.1'],'backoffice');
            await js("choose('colaborador')");
            await esperar(() => js("role === 'colaborador' && !request"));
            assert.equal(servico.estado().funcoes['127.0.0.1'],'colaborador');
            await browser.loadURL('http://127.0.0.1:3000');await esperar(() => js("ready && role === 'colaborador' && !request"));
            await esperar(() => janela.webContents.executeJavaScript("role === 'colaborador'"));
            // JSON backup must carry the persisted roles as well as calls and aliases.
            const backup = await js("(()=>{let result;const old=download;download=(n,d)=>{result=d;};exportBackup();download=old;return JSON.parse(result);})()");
            assert.equal(backup.funcoes['127.0.0.1'],'colaborador');
            assert.equal(backup.chamadas.length,1);assert.equal(backup.postos['127.0.0.1'],'Marcelo');
            await js("changeRole();choose('backoffice')");
            await esperar(() => js("role === 'backoffice' && !request"));
            await js("openSettings()");
            assert.ok(await js("document.getElementById('postLog').textContent.includes('Back Office')"));
            await js("closeSettings()");
            log.escrever('ROLE TEST PASSED: fresh browser, old session ignored, role changes, reload, cross-client sync and JSON backup.');
        } finally { browser.destroy(); }
        log.escrever('SMOKE TEST PASSED: real desktop launch, preload, tray close, incoming call, window restore, saved history and resolution.');
    } finally { ws.close(); }
};
