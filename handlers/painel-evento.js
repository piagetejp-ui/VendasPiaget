/* Painel de acompanhamento de um evento, só para a equipe (admin/gestão/secretaria).
   "Confirmado" é sempre lido direto das vendas reais do item de catálogo do evento - os
   três caminhos de pagamento (página pública, presencial, link direcionado da secretaria)
   caem todos aqui, sem nenhum registro de inscrição à parte para manter sincronizado.
   A leitura é limitada a partir da criação do item (nunca um scan da escola inteira).

   RC2.7.80: eventos com ingresso físico (possuiIngresso) também controlam aqui se o
   ingresso já foi retirado/entregue - isso é um estado separado de "confirmado" (pagou),
   porque o ingresso costuma ser entregue depois, numa secretaria ou na entrada do evento.
   Cada linha de venda carrega seus próprios coParticipantesIds (alunos de outras famílias
   agrupados só para a conta de tamanho de família daquele ingresso - não são cobrados
   separadamente, então não aparecem como confirmações próprias, só listados dentro da
   confirmação do titular). */
const { initFirebase, json, parseBody, catalogSaleWindowAllowed, getStudent } = require('../server/_utils');
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
    const itens = Array.isArray(v.itens) ? v.itens : [];
    for (let idx = 0; idx < itens.length; idx++) {
      const it = itens[idx];
      if (String(it.catalogoItemId || '') !== String(eventoId)) continue;
      /* RC2.7.81: turma vem do item (it.turma), não do nível da venda (v.turma). v.turma só
         reflete o titular da venda - numa venda familiar com vários alunos, ou numa venda
         online/checkout (que nem grava turma no nível da venda), as confirmações de quem não é
         o titular apareciam com turma em branco. Cada item já carrega sua própria turma desde
         normalizeFamilySecretaryMixedSale (studentAssignmentMeta), então basta usá-la. */
      confirmacoes.push({
        vendaId: v.id, itemIndex: idx, alunoId: it.alunoId || v.alunoId || null, alunoNome: it.alunoNome || v.alunoNome || 'Aluno',
        turma: it.turma || v.turma || null, valorCentavos: cents(it.totalCentavos != null ? it.totalCentavos : it.valorCentavos),
        dataHora: v.criadoEm || null, canal: v.origem || v.canal || null,
        ingressoTipo: it.ingressoTipo || 'normal',
        ingressoEntregue: Boolean(it.ingressoEntregue),
        ingressoEntregueEm: it.ingressoEntregueEm || null,
        coParticipantesIds: Array.isArray(it.coParticipantesIds) ? it.coParticipantesIds : []
      });
    }
  }
  return confirmacoes;
}

async function resolveCoParticipantes(db, confirmacoes) {
  const ids = [...new Set(confirmacoes.flatMap(c => c.coParticipantesIds))];
  if (!ids.length) return confirmacoes;
  const students = await Promise.all(ids.map(id => getStudent(db, id).catch(() => null)));
  const map = new Map(ids.map((id, i) => [id, students[i]]));
  for (const c of confirmacoes) {
    c.coParticipantes = c.coParticipantesIds.map(id => ({ id, nome: map.get(id)?.nome || 'Aluno', turma: map.get(id)?.turma || null }));
  }
  return confirmacoes;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { ok: false, error: 'Método não permitido.' });
  try {
    const db = initFirebase();
    const staff = await verifyStaff(db, req, ['admin', 'gestao', 'secretaria']);
    const body = req.method === 'POST' ? parseBody(req) : {};
    const q = req.query || {};
    const acao = String(body.acao || q.acao || '').trim();

    if (acao === 'marcar_ingresso') {
      const vendaId = String(body.vendaId || '').trim(), itemIndex = Number(body.itemIndex);
      const entregue = body.entregue !== false;
      if (!vendaId || !Number.isInteger(itemIndex) || itemIndex < 0) return json(res, 400, { ok: false, error: 'Informe a venda e o ingresso.' });
      const ref = db.collection('vendas').doc(vendaId);
      const snap = await ref.get();
      if (!snap.exists) return json(res, 404, { ok: false, error: 'Venda não encontrada.' });
      const v = snap.data() || {}, itens = Array.isArray(v.itens) ? [...v.itens] : [];
      if (!itens[itemIndex]) return json(res, 404, { ok: false, error: 'Ingresso não encontrado nesta venda.' });
      const now = new Date().toISOString();
      itens[itemIndex] = {
        ...itens[itemIndex],
        ingressoEntregue: entregue,
        ingressoEntregueEm: entregue ? now : null,
        ingressoEntreguePorId: entregue ? (staff.id || null) : null,
        ingressoEntreguePorNome: entregue ? (staff.nome || 'Equipe') : null
      };
      await ref.set({ itens, atualizadoEm: now }, { merge: true });
      return json(res, 200, { ok: true, ingressoEntregue: entregue });
    }

    const eventoId = String(body.eventoId || q.eventoId || '').trim();
    if (!eventoId) return json(res, 400, { ok: false, error: 'Informe o evento.' });
    const snap = await db.collection('catalogo_itens').doc(eventoId).get();
    if (!snap.exists || snap.data()?.tipoOperacional !== 'evento') return json(res, 404, { ok: false, error: 'Evento não encontrado.' });
    const item = { id: snap.id, ...snap.data() };
    const inicioUtc = item.criadoEm ? new Date(item.criadoEm).toISOString() : '1970-01-01T00:00:00.000Z';
    const fimDate = new Date(); fimDate.setUTCDate(fimDate.getUTCDate() + 1);
    let confirmacoes = await loadVendasDoEvento(db, eventoId, inicioUtc, fimDate.toISOString());
    confirmacoes.sort((a, b) => String(a.dataHora || '').localeCompare(String(b.dataHora || '')));
    if (item.possuiIngresso) confirmacoes = await resolveCoParticipantes(db, confirmacoes);
    const totalArrecadadoCentavos = confirmacoes.reduce((s, c) => s + c.valorCentavos, 0);
    const totalPessoas = confirmacoes.reduce((s, c) => s + 1 + (c.coParticipantesIds?.length || 0), 0);
    return json(res, 200, {
      ok: true,
      evento: { id: item.id, nome: item.nome, dataEvento: item.dataEvento || null, vendaInicio: item.vendaInicio, vendaFim: item.vendaFim, vendasAbertas: catalogSaleWindowAllowed(item), possuiIngresso: Boolean(item.possuiIngresso), precoIngressoExtraCentavos: item.precoIngressoExtraCentavos ?? null },
      totalConfirmados: confirmacoes.length,
      totalPessoas,
      totalArrecadado: reais(totalArrecadadoCentavos),
      confirmacoes
    });
  } catch (e) {
    console.error('painel-evento', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'Não foi possível carregar o painel do evento.' });
  }
};
