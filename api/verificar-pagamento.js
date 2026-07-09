const { json, processPaidPayment } = require('../lib/payment-utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const orderNsu = String(body.order_nsu || '').trim();
    const transactionNsu = String(body.transaction_nsu || '').trim();
    const slug = String(body.slug || '').trim();
    if (!orderNsu) return json(res, 400, { error: 'order_nsu ausente.' });
    const payload = { handle: process.env.INFINITEPAY_HANDLE || 'piaget', order_nsu: orderNsu };
    if (transactionNsu) payload.transaction_nsu = transactionNsu;
    if (slug) payload.slug = slug;
    const response = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    const paid = Boolean(data.paid || data.success === true || String(data.status || '').toLowerCase() === 'paid');
    if (paid) await processPaidPayment(orderNsu, { ...data, transaction_nsu: transactionNsu || data.transaction_nsu, slug });
    return json(res, 200, { ok: true, paid, infinitepay: data });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error.message || 'Erro ao verificar pagamento.' });
  }
};
