const { json, processPaidPayment } = require('../lib/payment-utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const orderNsu = String(body.order_nsu || body.orderNsu || '').trim();
    if (!orderNsu) return json(res, 400, { error: 'order_nsu ausente.' });
    await processPaidPayment(orderNsu, body);
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 400, { error: error.message || 'Erro no webhook.' });
  }
};
