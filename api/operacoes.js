const handlers = {
  'cancelar-venda-presencial': require('../handlers/cancelar-venda-presencial'),
  'configuracao-operacional': require('../handlers/configuracao-operacional'),
  'gerenciar-programacao-lanche': require('../handlers/gerenciar-programacao-lanche'),
  'registrar-operacao-presencial': require('../handlers/registrar-operacao-presencial'),
  'resumo-operacional': require('../handlers/resumo-operacional')
};

module.exports = async function handler(req, res) {
  const modulo = String(req.query?.modulo || '').trim().toLowerCase();
  const target = handlers[modulo];
  if (!target) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Rota operacional não encontrada.' }));
  }
  return target(req, res);
};
