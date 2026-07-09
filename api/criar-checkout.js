const {
  getDb, nowIso, dateKeyInFortaleza, timeMinutesInFortaleza, makeOrderNsu,
  json, normalizePhone, activeReservations, resolveProducts, releaseOrderReservations
} = require('../lib/payment-utils');

function baseUrl(req) {
  return (process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
}
function validDateString(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  const db = getDb();
  let payment = null;
  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const tipo = String(body.tipo || '');
    const alunoId = String(body.alunoId || '').trim();
    if (!['pedido', 'quitar_divida', 'adicionar_credito'].includes(tipo)) return json(res, 400, { error: 'Tipo de pagamento inválido.' });
    if (!alunoId) return json(res, 400, { error: 'Aluno ausente.' });
    const alunoSnap = await db.collection('alunos').doc(alunoId).get();
    if (!alunoSnap.exists) return json(res, 404, { error: 'Aluno não encontrado.' });
    const aluno = { id: alunoSnap.id, ...alunoSnap.data() };
    const accountSnap = await db.collection('contas_alunos').doc(alunoId).get();
    const account = accountSnap.exists ? accountSnap.data() : {};
    const configSnap = await db.collection('configuracoes').doc('sistema').get();
    const config = configSnap.exists ? configSnap.data() : { quantidadePadraoSalgados: 30, diasSemAula: [] };
    const orderNsu = makeOrderNsu('VP');
    const now = nowIso();
    let total = 0;
    let description = '';
    let orderId = null;
    let reservations = [];

    if (tipo === 'quitar_divida') {
      total = Number(account.dividaCentavos || 0);
      if (total <= 0) return json(res, 400, { error: 'Não há dívida em aberto.' });
      description = `Conta da cantina - ${aluno.nome}`;
    } else if (tipo === 'adicionar_credito') {
      total = Math.round(Number(body.valorCentavos || 0));
      if (total <= 0) return json(res, 400, { error: 'Informe um valor válido.' });
      description = `Pagamento e crédito da cantina - ${aluno.nome}`;
    } else {
      const draft = body.pedido || {};
      const rawItems = Array.isArray(draft.itens) ? draft.itens : [];
      if (!rawItems.length) return json(res, 400, { error: 'O pedido está vazio.' });
      if (rawItems.length > 31) return json(res, 400, { error: 'O pedido excede o número máximo de datas.' });
      const { direct, price, expand } = await resolveProducts(db, rawItems);
      const today = dateKeyInFortaleza();
      const currentMinutes = timeMinutesInFortaleza();
      const daysOff = new Set(config.diasSemAula || []);
      const grouped = [];
      const salgadoByDate = new Map();
      for (const line of rawItems) {
        const day = String(line.dataChave || '');
        const product = direct.get(String(line.produtoId || ''));
        const qty = Math.max(1, Math.floor(Number(line.quantidade || 1)));
        if (!validDateString(day) || !product || !product.ativo || !product.portal) throw new Error('Item ou data indisponível.');
        const date = new Date(`${day}T12:00:00-03:00`);
        if ([0, 6].includes(date.getDay()) || daysOff.has(day) || day < today) throw new Error(`A data ${day} não está disponível.`);
        if (day === today) {
          const [h, m] = String(aluno.recreioFim || '00:00').split(':').map(Number);
          if (currentMinutes > h * 60 + m) throw new Error('O recreio desta turma já encerrou hoje.');
        }
        const expanded = expand(product, qty);
        const value = price(product) * qty;
        total += value;
        const occurrenceId = `occ_${orderNsu}_${grouped.length + 1}`;
        grouped.push({
          id: occurrenceId, alunoId, alunoNome: aluno.nome, turma: aluno.turma,
          dataChave: day, grupoRecreio: aluno.grupoRecreio, turno: aluno.turno,
          produtoOriginalId: product.id, produtoOriginalNome: product.nome,
          itens: expanded, valorCentavos: value
        });
        const salgadoQty = expanded.filter(x => x.produtoId === 'salgado').reduce((sum, x) => sum + Number(x.quantidade || 0), 0);
        if (salgadoQty) salgadoByDate.set(day, Number(salgadoByDate.get(day) || 0) + salgadoQty);
      }
      if (total <= 0) throw new Error('Total inválido.');
      orderId = orderNsu;
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      await db.runTransaction(async tx => {
        for (const [day, qty] of salgadoByDate.entries()) {
          const ref = db.collection('disponibilidade_salgados').doc(day);
          const snap = await tx.get(ref);
          const data = snap.exists ? snap.data() : {};
          const reservationInfo = activeReservations(data.reservas || {});
          const planned = Number(data.quantidadePlanejada || config.quantidadePadraoSalgados || 30);
          const committed = Number(data.pedidosConfirmados || 0) + Number(data.consumoConta || 0) + Number(data.vendidoDinheiro || 0);
          if (committed + reservationInfo.total + qty > planned) throw new Error(`Não há salgados suficientes em ${day}.`);
          const reservationsMap = { ...reservationInfo.cleaned, [orderNsu]: { quantidade: qty, expiraEm: expiresAt, status: 'aguardando_pagamento' } };
          tx.set(ref, { dataChave: day, quantidadePlanejada: planned, reservas: reservationsMap, atualizadoEm: now }, { merge: true });
          reservations.push({ dataChave: day, quantidade: qty, expiraEm: expiresAt });
        }
        const orderRef = db.collection('pedidos').doc(orderId);
        tx.set(orderRef, {
          id: orderId, alunoId, alunoNome: aluno.nome, turma: aluno.turma,
          modalidade: String(draft.modalidade || 'avulso'), totalCentavos: total,
          statusPagamento: 'aguardando_pagamento', statusPedido: 'aguardando_pagamento',
          ocorrencias: grouped, origem: 'portal_responsavel', criadoEm: now, atualizadoEm: now
        });
      });
      description = `Pedido de lanche - ${aluno.nome} - ${grouped.length} dia(s)`;
    }

    payment = {
      id: orderNsu, tipo, alunoId, alunoNome: aluno.nome, pedidoId: orderId,
      valorCentavos: total, status: 'aguardando_pagamento', reservasSalgados: reservations,
      criadoEm: now, atualizadoEm: now
    };
    await db.collection('pagamentos').doc(orderNsu).set(payment);

    const payload = {
      handle: process.env.INFINITEPAY_HANDLE || 'piaget',
      order_nsu: orderNsu,
      redirect_url: `${baseUrl(req)}/obrigado.html`,
      webhook_url: `${baseUrl(req)}/api/webhook-infinitepay`,
      items: [{ quantity: 1, price: total, description }]
    };
    const phone = normalizePhone(aluno.celularResponsavel);
    if (phone) payload.customer = { name: aluno.responsavelFinanceiro || aluno.nome, phone_number: phone };

    const response = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!response.ok) {
      if (tipo === 'pedido') await releaseOrderReservations(db, payment);
      await db.collection('pagamentos').doc(orderNsu).set({ status: 'erro_link', erroInfinitePay: data, atualizadoEm: nowIso() }, { merge: true });
      return json(res, 502, { error: 'A InfinitePay não conseguiu gerar o checkout.', details: data });
    }
    const checkoutUrl = data.checkout_url || data.url || data.link || data.payment_url || data.redirect_url || data.data?.checkout_url || data.data?.url || data.data?.link || data.data?.payment_url;
    if (!checkoutUrl) {
      if (tipo === 'pedido') await releaseOrderReservations(db, payment);
      return json(res, 502, { error: 'A InfinitePay não retornou a URL do checkout.', details: data });
    }
    await db.collection('pagamentos').doc(orderNsu).set({ checkoutUrl, respostaCriacaoLink: data, atualizadoEm: nowIso() }, { merge: true });
    return json(res, 200, { ok: true, order_nsu: orderNsu, checkout_url: checkoutUrl, total_centavos: total });
  } catch (error) {
    console.error(error);
    if (payment?.tipo === 'pedido') await releaseOrderReservations(db, payment).catch(() => {});
    return json(res, 500, { error: error.message || 'Erro interno.' });
  }
};
