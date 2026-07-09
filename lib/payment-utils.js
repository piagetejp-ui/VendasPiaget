const { admin, getDb } = require('./firebase-admin');

function nowIso() { return new Date().toISOString(); }
function dateKeyInFortaleza(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function timeMinutesInFortaleza(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  const h = Number(parts.find(p => p.type === 'hour')?.value || 0);
  const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
  return h * 60 + m;
}
function makeOrderNsu(prefix = 'VP') {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.floor(Math.random()*9000+1000)}`;
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
}
function activeReservations(map) {
  const now = Date.now();
  const cleaned = {};
  let total = 0;
  for (const [key, value] of Object.entries(map || {})) {
    const expiry = new Date(value.expiraEm || 0).getTime();
    if (expiry > now && value.status !== 'cancelada') {
      cleaned[key] = value;
      total += Number(value.quantidade || 0);
    }
  }
  return { cleaned, total };
}
async function resolveProducts(db, rawItems) {
  const ids = [...new Set(rawItems.map(x => String(x.produtoId || '')).filter(Boolean))];
  const direct = new Map();
  for (const id of ids) {
    const snap = await db.collection('produtos').doc(id).get();
    if (!snap.exists) throw new Error(`Produto não encontrado: ${id}.`);
    direct.set(id, { id, ...snap.data() });
  }
  const componentIds = [...new Set([...direct.values()].flatMap(p => (p.componentes || []).map(c => c.produtoId)))];
  for (const id of componentIds) {
    if (direct.has(id)) continue;
    const snap = await db.collection('produtos').doc(id).get();
    if (!snap.exists) throw new Error(`Componente não encontrado: ${id}.`);
    direct.set(id, { id, ...snap.data() });
  }
  const price = product => {
    if (!product.combo) return Number(product.precoCentavos || 0);
    return (product.componentes || []).reduce((sum, c) => {
      const cp = direct.get(c.produtoId);
      return sum + price(cp) * Number(c.quantidade || 1);
    }, 0);
  };
  const expand = (product, qty) => {
    if (!product.combo) return [{ produtoId: product.id, nome: product.nome, quantidade: qty, precoUnitarioCentavos: price(product) }];
    return product.componentes.map(c => {
      const cp = direct.get(c.produtoId);
      return { produtoId: cp.id, nome: cp.nome, quantidade: qty * Number(c.quantidade || 1), precoUnitarioCentavos: price(cp) };
    });
  };
  return { direct, price, expand };
}
async function releaseOrderReservations(db, payment) {
  const reservations = payment.reservasSalgados || [];
  if (!reservations.length) return;
  await db.runTransaction(async tx => {
    for (const r of reservations) {
      const ref = db.collection('disponibilidade_salgados').doc(r.dataChave);
      const snap = await tx.get(ref);
      if (!snap.exists) continue;
      const data = snap.data();
      const map = { ...(data.reservas || {}) };
      delete map[payment.id];
      tx.set(ref, { reservas: map, atualizadoEm: nowIso() }, { merge: true });
    }
  });
}
async function processPaidPayment(orderNsu, providerPayload = {}) {
  const db = getDb();
  const payRef = db.collection('pagamentos').doc(orderNsu);
  const paySnap = await payRef.get();
  if (!paySnap.exists) throw new Error('Pagamento interno não encontrado.');
  const payment = { id: orderNsu, ...paySnap.data() };
  if (payment.processadoEm) return { alreadyProcessed: true, payment };
  const now = nowIso();

  if (payment.tipo === 'pedido') {
    const orderRef = db.collection('pedidos').doc(payment.pedidoId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error('Pedido vinculado não encontrado.');
    const order = orderSnap.data();
    await db.runTransaction(async tx => {
      const freshPay = await tx.get(payRef);
      if (freshPay.data()?.processadoEm) return;
      for (const reservation of payment.reservasSalgados || []) {
        const ref = db.collection('disponibilidade_salgados').doc(reservation.dataChave);
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const map = { ...(data.reservas || {}) };
        delete map[orderNsu];
        tx.set(ref, {
          dataChave: reservation.dataChave,
          quantidadePlanejada: Number(data.quantidadePlanejada || 30),
          reservas: map,
          pedidosConfirmados: Number(data.pedidosConfirmados || 0) + Number(reservation.quantidade || 0),
          atualizadoEm: now
        }, { merge: true });
      }
      tx.set(orderRef, { statusPagamento: 'pago', statusPedido: 'confirmado', pagamentoConfirmadoEm: now, atualizadoEm: now }, { merge: true });
      tx.set(payRef, {
        status: 'pago', processadoEm: now, confirmadoEm: now,
        transactionNsu: providerPayload.transaction_nsu || payment.transactionNsu || '',
        receiptUrl: providerPayload.receipt_url || payment.receiptUrl || '',
        providerPayload
      }, { merge: true });
      for (const occurrence of order.ocorrencias || []) {
        const ref = db.collection('ocorrencias_entrega').doc(occurrence.id);
        tx.set(ref, { ...occurrence, pedidoId: orderRef.id, status: 'programado', criadoEm: now, atualizadoEm: now });
      }
    });
  } else {
    const accountRef = db.collection('contas_alunos').doc(payment.alunoId);
    const moveRef = db.collection('movimentos_conta').doc();
    await db.runTransaction(async tx => {
      const freshPay = await tx.get(payRef);
      if (freshPay.data()?.processadoEm) return;
      const accountSnap = await tx.get(accountRef);
      const account = accountSnap.exists ? accountSnap.data() : {};
      const amount = Number(payment.valorCentavos || 0);
      const debt = Number(account.dividaCentavos || 0);
      const applied = Math.min(debt, amount);
      const credit = amount - applied;
      const remainingDebt = debt - applied;
      const limit = Number(account.limiteFiadoCentavos || 0);
      tx.set(accountRef, {
        alunoId: payment.alunoId,
        dividaCentavos: remainingDebt,
        saldoCreditoCentavos: Number(account.saldoCreditoCentavos || 0) + credit,
        bloqueadoPorLimite: limit > 0 && remainingDebt >= limit,
        atualizadoEm: now
      }, { merge: true });
      tx.set(moveRef, {
        id: moveRef.id, alunoId: payment.alunoId, tipo: 'pagamento_checkout', valorCentavos: amount,
        aplicadoDividaCentavos: applied, creditoGeradoCentavos: credit,
        pagamentoId: orderNsu, formaPagamento: 'checkout_infinitepay', origem: 'portal_responsavel',
        dataChave: dateKeyInFortaleza(), criadoEm: now
      });
      tx.set(payRef, {
        status: 'pago', processadoEm: now, confirmadoEm: now,
        aplicadoDividaCentavos: applied, creditoGeradoCentavos: credit,
        transactionNsu: providerPayload.transaction_nsu || payment.transactionNsu || '',
        receiptUrl: providerPayload.receipt_url || payment.receiptUrl || '',
        providerPayload
      }, { merge: true });
    });
  }
  return { alreadyProcessed: false, payment };
}

module.exports = {
  admin, getDb, nowIso, dateKeyInFortaleza, timeMinutesInFortaleza, makeOrderNsu,
  json, normalizePhone, activeReservations, resolveProducts, releaseOrderReservations,
  processPaidPayment
};
