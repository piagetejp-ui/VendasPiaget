/* Painel de acompanhamento de um evento, só para a equipe (admin/gestão/secretaria).
   "Confirmado" é sempre lido direto das vendas reais do item de catálogo do evento - os
   três caminhos de pagamento (página pública, presencial, link direcionado da secretaria)
   caem todos aqui, sem nenhum registro de inscrição à parte para manter sincronizado.
   A leitura é limitada à janela de vendas do próprio evento (não é um scan da escola
   inteira) - por isso a janela (vendaInicio/vendaFim) precisa estar configurada no item. */
const { initFirebase, json, parseBody, catalogSaleWindowAllowed } = require('../server/_utils');
const { verifyStaff } = require('../server/_family-utils');

function cents(v) { const n = Number(v || 0); return Number.isFinite(n) ? Math.round(n) : 0; }
function reais(v) { return Math.round(cents(v)) / 100; }

async function loadVendasDoEvento(db, eventoId, inicioUtc, fimUtc) {
  const out = []; let cursor = null;
  while (true) {
    let q = db.collection('vendas').where('criadoEm', '>=', inicioUtc).where('criadoEm', '<=', fimUtc).orderBy('criadoEm').limit(500);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    out.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    if (snap.docs.length < 500) break;
    cursor = snap.docs[snap.docs.length - 1].get('criadoEm');
  }
  const confirmacoes = [];
  for (const v of out) {
    if (String(v.status || '').toLowerCase().includes('cancel')) continue;
    for (const it of (Array.isArray(v.itens) ? v.itens : [])) {
      if (String(it.catalogoItemId || '') !== String(eventoId)) continue;
      confirmacoes.push({
        vendaId: v.id, alunoId: it.alunoId || v.alunoId || null, alunoNome: it.alunoNome || v.alunoNome || 'Aluno',
        turma: v.turma || null, valorCentavos: cents(it.totalCentavos != null ? it.totalCentavos : it.valorCentavos),
        dataHora: v.criadoEm || null, canal: v.origem || v.canal || null
      });
    }
  }
  return confirmacoes;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { ok: false, error: 'Método não permitido.' });
  try {
    const db = initFirebase();
    await verifyStaff(db, req, ['admin', 'gestao', 'secretaria']);
    const body = req.method === 'POST' ? parseBody(req) : {};
    const q = req.query || {};
    const eventoId = String(body.eventoId || q.eventoId || '').trim();
    if (!eventoId) return json(res, 400, { ok: false, error: 'Informe o evento.' });
    const snap = await db.collection('catalogo_itens').doc(eventoId).get();
    if (!snap.exists || snap.data()?.tipoOperacional !== 'evento') return json(res, 404, { ok: false, error: 'Evento não encontrado.' });
    const item = { id: snap.id, ...snap.data() };
    /* RC2.7.78: o painel não depende mais de vendaInicio/vendaFim estarem configurados - esses
       campos controlam quando a venda do evento fica aberta para NOVAS compras, não até onde
       o painel consegue enxergar. Para o painel, a busca de vendas é limitada a partir da
       criação do próprio item no catálogo (nenhuma venda pode existir antes disso) até agora -
       assim eventos já encerrados, ou que nunca tiveram a janela de vendas preenchida,
       mostram seu histórico completo de confirmações automaticamente, sem precisar configurar
       nada retroativamente. */
    const inicioUtc = item.criadoEm ? new Date(item.criadoEm).toISOString() : '1970-01-01T00:00:00.000Z';
    const fimDate = new Date(); fimDate.setUTCDate(fimDate.getUTCDate() + 1);
    const confirmacoes = await loadVendasDoEvento(db, eventoId, inicioUtc, fimDate.toISOString());
    confirmacoes.sort((a, b) => String(a.dataHora || '').localeCompare(String(b.dataHora || '')));
    const totalArrecadadoCentavos = confirmacoes.reduce((s, c) => s + c.valorCentavos, 0);
    return json(res, 200, {
      ok: true,
      evento: { id: item.id, nome: item.nome, dataEvento: item.dataEvento || null, vendaInicio: item.vendaInicio, vendaFim: item.vendaFim, vendasAbertas: catalogSaleWindowAllowed(item) },
      totalConfirmados: confirmacoes.length,
      totalArrecadado: reais(totalArrecadadoCentavos),
      confirmacoes
    });
  } catch (e) {
    console.error('painel-evento', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'Não foi possível carregar o painel do evento.' });
  }
};
