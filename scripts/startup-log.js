'use strict';
const fs = require('node:fs');
const path = require('node:path');
function criarLog(pasta) {
    fs.mkdirSync(pasta, { recursive: true });
    const ficheiro = path.join(pasta, 'arranque.log');
    return { ficheiro, escrever(message) {
        try { fs.appendFileSync(ficheiro, `${new Date().toISOString()} ${message}\n`, 'utf8'); }
        catch (erro) { console.error('Não foi possível escrever o log:', erro.message); }
    } };
}
module.exports = { criarLog };
