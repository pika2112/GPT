'use strict';
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { isIP } = require('node:net');
function normalizarIp(ip) { return String(ip || '').replace(/^::ffff:/i, '').split('%')[0].toLowerCase(); }

// Call changes are committed to disk before they are acknowledged or broadcast.
function criarServidor({ porta = 3000, host = '0.0.0.0', pastaDados = path.join(__dirname, 'dados') } = {}) {
    fs.mkdirSync(pastaDados, { recursive: true });
    const ficheiro = path.join(pastaDados, 'chamadas.json');
    let chamadas = [];
    let postos = {};
    if (fs.existsSync(ficheiro)) {
        const saved = JSON.parse(fs.readFileSync(ficheiro, 'utf8'));
        if (saved.versao !== 1 || !Array.isArray(saved.chamadas)) throw new Error('Histórico inválido. Preserve o ficheiro e restaure uma cópia de segurança.');
        chamadas = saved.chamadas;
        if (saved.postos && typeof saved.postos === 'object' && !Array.isArray(saved.postos)) {
            for (const [ip, nome] of Object.entries(saved.postos)) {
                if (isIP(ip) && typeof nome === 'string' && nome.trim().length <= 60) postos[normalizarIp(ip)] = nome.trim();
            }
        }
    }
    const eventos = new EventEmitter();
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server, maxPayload: 4096 });
    const estado = () => {
        const ativa = chamadas.find(c => !c.resolvida);
        return { chamadas, postos, chamadaAtiva: Boolean(ativa), horaInicioChamada: ativa ? Date.parse(ativa.horaChamada) : null };
    };
    function guardar(novas, novosPostos = postos) {
        const tmp = `${ficheiro}.tmp`;
        const fd = fs.openSync(tmp, 'w', 0o600);
        try { fs.writeFileSync(fd, JSON.stringify({ versao: 1, chamadas: novas, postos: novosPostos }, null, 2)); fs.fsyncSync(fd); }
        finally { fs.closeSync(fd); }
        fs.renameSync(tmp, ficheiro);
        chamadas = novas;
        postos = novosPostos;
    }
    function enviar(ws, mensagem) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(mensagem)); }
    function transmitir() { for (const ws of wss.clients) enviar(ws, { tipo: 'atualizacao', dados: estado() }); }
    app.disable('x-powered-by');
    app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'sistema-chamadas-cliente.html')));
    app.use(express.static(path.join(__dirname, 'public')));
    // Source code, saved history and package files are never exposed as static files.
    wss.on('connection', (ws, req) => {
        // Always use the actual socket, never a caller-supplied IP or forwarded header.
        const origemIp = normalizarIp(req.socket.remoteAddress);
        ws.vivo = true;
        ws.on('pong', () => { ws.vivo = true; });
        enviar(ws, { tipo: 'estado', dados: estado() });
        ws.on('message', raw => {
            let msg;
            try {
                msg = JSON.parse(raw.toString());
                if (!msg || !['chamar', 'atendido', 'configurar-posto', 'remover-posto'].includes(msg.tipo) || typeof msg.pedidoId !== 'string' || msg.pedidoId.length > 80) throw new Error('Pedido inválido.');
                const ativa = chamadas.find(c => !c.resolvida);
                let nova;
                if (msg.tipo === 'chamar') {
                    // Retries cannot create duplicate calls, even after a restart.
                    if (!chamadas.some(c => c.pedidoId === msg.pedidoId) && !ativa) {
                        nova = { id: randomUUID(), pedidoId: msg.pedidoId, horaChamada: new Date().toISOString(), resolvida: false, horaResolucao: null, origemIp, origemNome: postos[origemIp] || null };
                        guardar([nova, ...chamadas]);
                    }
                } else if (msg.tipo === 'atendido' && ativa && msg.chamadaId === ativa.id) {
                    guardar(chamadas.map(c => c.id === ativa.id ? { ...c, resolvida: true, horaResolucao: new Date().toISOString() } : c));
                }
                if (msg.tipo === 'configurar-posto' || msg.tipo === 'remover-posto') {
                    const ip = normalizarIp(msg.ip);
                    if (!isIP(ip)) throw new Error('Endereço IP inválido.');
                    const novosPostos = { ...postos };
                    if (msg.tipo === 'configurar-posto') {
                        if (typeof msg.nome !== 'string' || !msg.nome.trim() || msg.nome.trim().length > 60) throw new Error('Nome inválido (máximo 60 caracteres).');
                        novosPostos[ip] = msg.nome.trim();
                    } else delete novosPostos[ip];
                    guardar(chamadas, novosPostos);
                }
                transmitir();
                enviar(ws, { tipo: 'confirmacao', pedidoId: msg.pedidoId });
                if (nova) eventos.emit('chamada', nova);
                eventos.emit('estado', estado());
            } catch (erro) {
                enviar(ws, { tipo: 'erro', pedidoId: msg?.pedidoId, mensagem: ['Endereço IP inválido.', 'Nome inválido (máximo 60 caracteres).'].includes(erro.message) ? erro.message : 'Não foi possível guardar a alteração. Verifique o disco e tente novamente.' });
                console.error('Pedido recusado:', erro.message);
            }
        });
        ws.on('error', erro => console.error('Ligação:', erro.message));
    });
    const heartbeat = setInterval(() => {
        for (const ws of wss.clients) {
            if (!ws.vivo) { ws.terminate(); continue; }
            ws.vivo = false; ws.ping();
        }
    }, 15000);
    server.on('close', () => clearInterval(heartbeat));
    return {
        eventos, estado, pastaDados,
        iniciar: () => new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(porta, host, () => { server.removeListener('error', reject); resolve(server.address().port); });
        }),
        fechar: () => new Promise(resolve => { clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(() => server.close(resolve)); })
    };
}
module.exports = { criarServidor };
if (require.main === module) {
    const servico = criarServidor({ porta: Number(process.env.PORT || 3000), pastaDados: process.env.CHAMADAS_DATA_DIR || path.join(__dirname, 'dados') });
    servico.iniciar().then(porta => console.log(`Sistema de Chamadas: http://localhost:${porta}`)).catch(erro => { console.error(erro.message); process.exitCode = 1; });
}
