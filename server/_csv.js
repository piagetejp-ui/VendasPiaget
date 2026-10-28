/* CSV simples (RFC4180): delimitador vírgula, separador decimal ponto, UTF-8 com BOM
   (para evitar acento quebrado ao abrir no Excel, sem depender de biblioteca externa). */
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(rows, columns) {
  const header = columns.map(c => csvCell(c.header)).join(',');
  const lines = rows.map(row => columns.map(c => csvCell(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','));
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n';
}
module.exports = { toCsv, csvCell };
