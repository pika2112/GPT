/* Genuine Excel 97-2003 (BIFF8) export. SheetJS is bundled locally for offline use. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/xlsx.full.min.js'));
    else root.FariaExcel = factory(root.XLSX);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(XLSX) {
    'use strict';
    function criarWorkbook({ chamadas, postos = {}, agora = Date.now(), folha = 'Chamadas' }) {
        const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
        function serial(iso) {
            if (!iso || Number.isNaN(Date.parse(iso))) return '';
            const parts = formatter.formatToParts(new Date(iso));
            const get = type => Number(parts.find(p => p.type === type).value);
            // Excel stores wall-clock dates without a time zone. Use Lisbon's components.
            return (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Date.UTC(1899, 11, 30)) / 86400000;
        }
        const rows = [['ID', 'Posto / colaborador', 'IP de origem', 'Chamada (Lisboa)', 'Atendida (Lisboa)', 'Espera (segundos)', 'Estado', 'Chamada (UTC)', 'Atendida (UTC)']];
        for (const c of chamadas) {
            const name = c.origemIp ? (postos[c.origemIp] || c.origemNome || 'Posto sem nome') : 'Posto não registado';
            const ms = (c.resolvida ? Date.parse(c.horaResolucao) : agora) - Date.parse(c.horaChamada);
            rows.push([c.id, name, c.origemIp || '', serial(c.horaChamada), serial(c.horaResolucao), Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0, c.resolvida ? 'Atendida' : 'Por atender', c.horaChamada, c.horaResolucao || '']);
        }
        const wb = XLSX.utils.book_new();
        // XLS has a 65,536-row limit per sheet. Keep all records in extra sheets.
        const pageSize = 65535, pages = Math.max(1, Math.ceil(chamadas.length / pageSize));
        for (let page = 0; page < pages; page++) {
            const data = [rows[0], ...rows.slice(1 + page * pageSize, 1 + (page + 1) * pageSize)];
            const ws = XLSX.utils.aoa_to_sheet(data);
            for (let i = 1; i < data.length; i++) for (const col of ['D', 'E']) {
                const cell = ws[col + (i + 1)];
                if (cell && cell.t === 'n') cell.z = 'dd/mm/yyyy hh:mm:ss';
            }
            ws['!cols'] = [36, 26, 20, 24, 24, 20, 16, 27, 27].map(wch => ({ wch }));
            XLSX.utils.book_append_sheet(wb, ws, pages > 1 ? `${folha} ${page + 1}` : folha);
        }
        return wb;
    }
    function criarXls(options) { return XLSX.write(criarWorkbook(options), { bookType: 'biff8', type: 'array' }); }
    return { criarWorkbook, criarXls };
});
