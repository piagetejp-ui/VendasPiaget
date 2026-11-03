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

async function loadVendasDoEvento(db, eventoId, vendaInicio, vendaFim) {
  const inicioUtc = `${vendaInicio}T00:00:00.000Z`;
  const fimDate = new Date(`${vendaFim}T00:00:00.000Z`); fimDate.setUTCDate(fimDate.getUTCDate() + 2);
  const fimUtc = fimDate.toISOString();
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
    if (!item.vendaInicio || !item.vendaFim) {
      return json(res, 409, { ok: false, error: 'Configure a data de início e fim das vendas deste evento no catálogo para habilitar o painel.' });
    }
    const confirmacoes = await loadVendasDoEvento(db, eventoId, item.vendaInicio, item.vendaFim);
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
