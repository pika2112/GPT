'use strict';
const fs = require('node:fs');
const path = require('node:path');
function criarLog(pasta, { maxBytes = 1024 * 1024 } = {}) {
    fs.mkdirSync(pasta, { recursive: true });
    const ficheiro = path.join(pasta, 'arranque.log');
    return { ficheiro, escrever(message) {
        try {
            if (fs.existsSync(ficheiro) && fs.statSync(ficheiro).size >= maxBytes) fs.renameSync(ficheiro, path.join(pasta, 'arranque.anterior.log'));
            fs.appendFileSync(ficheiro, `${new Date().toISOString()} ${message}\n`, 'utf8'); }
        catch (erro) { console.error('Não foi possível escrever o log:', erro.message); }
    } };
}
module.exports = { criarLog };
