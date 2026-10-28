const { initFirebase, parseBody, json, audit } = require('../server/_utils');
const { verifyStaff } = require('../server/_family-utils');
const { buildFinancialExport } = require('../server/financeiro-export');
const { toCsv } = require('../server/_csv');
const { buildZip } = require('../server/_zip');

const VENDAS_COLS = [
  { key: 'venda_id', header: 'venda_id' },
  { key: 'data_hora_venda', header: 'data_hora_venda' },
  { key: 'status_venda', header: 'status_venda' },
  { key: 'canal', header: 'canal' },
  { key: 'aluno_id', header: 'aluno_id' },
  { key: 'aluno_nome', header: 'aluno_nome' },
  { key: 'turma', header: 'turma' },
  { key: 'responsavel_id', header: 'responsavel_id' },
  { key: 'responsavel_nome', header: 'responsavel_nome' },
  { key: 'operador_id', header: 'operador_id' },
  { key: 'operador_nome', header: 'operador_nome' },
  { key: 'valor_bruto', header: 'valor_bruto' },
  { key: 'desconto', header: 'desconto' },
  { key: 'valor_liquido', header: 'valor_liquido' },
  { key: 'observacao', header: 'observacao' },
  { key: 'competencia_referencia', header: 'competencia_referencia' }
];
const ITENS_COLS = [
  { key: 'item_id', header: 'item_id' },
  { key: 'venda_id', header: 'venda_id' },
  { key: 'produto_id', header: 'produto_id' },
  { key: 'produto_nome', header: 'produto_nome' },
  { key: 'categoria', header: 'categoria' },
  { key: 'subcategoria', header: 'subcategoria' },
  { key: 'projeto_evento_id', header: 'projeto_evento_id' },
  { key: 'projeto_evento_nome', header: 'projeto_evento_nome' },
  { key: 'quantidade', header: 'quantidade' },
  { key: 'valor_unitario', header: 'valor_unitario' },
  { key: 'valor_bruto', header: 'valor_bruto' },
  { key: 'desconto', header: 'desconto' },
  { key: 'valor_liquido', header: 'valor_liquido' }
];
const PAGAMENTOS_COLS = [
  { key: 'pagamento_id', header: 'pagamento_id' },
  { key: 'venda_id', header: 'venda_id' },
  { key: 'data_hora_pagamento', header: 'data_hora_pagamento' },
  { key: 'status_pagamento', header: 'status_pagamento' },
  { key: 'meio_pagamento', header: 'meio_pagamento' },
  { key: 'adquirente', header: 'adquirente' },
  { key: 'transacao_id', header: 'transacao_id' },
  { key: 'referencia_provedor', header: 'referencia_provedor' },
  { key: 'nsu', header: 'nsu' },
  { key: 'codigo_autorizacao', header: 'codigo_autorizacao' },
  { key: 'bandeira', header: 'bandeira' },
  { key: 'parcelas', header: 'parcelas' },
  { key: 'valor_bruto', header: 'valor_bruto' },
  { key: 'taxa', header: 'taxa' },
  { key: 'valor_liquido', header: 'valor_liquido' },
  { key: 'data_prevista_liquidacao', header: 'data_prevista_liquidacao' },
  { key: 'data_liquidacao', header: 'data_liquidacao' },
  { key: 'observacao', header: 'observacao' }
];
const ESTORNOS_COLS = [
  { key: 'estorno_id', header: 'estorno_id' },
  { key: 'pagamento_id_original', header: 'pagamento_id_original' },
  { key: 'venda_id', header: 'venda_id' },
  { key: 'data_hora_estorno', header: 'data_hora_estorno' },
  { key: 'valor_estornado', header: 'valor_estornado' },
  { key: 'motivo', header: 'motivo' },
  { key: 'operador', header: 'operador' },
  { key: 'referencia_provedor', header: 'referencia_provedor' }
];

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { ok: false, error: 'Método não permitido.' });
  try {
    const db = initFirebase();
    const actor = await verifyStaff(db, req, ['admin', 'gestao']);
    const body = req.method === 'POST' ? parseBody(req) : {};
    const q = req.query || {};
    const dataInicio = String(body.dataInicio || q.dataInicio || '').trim();
    const dataFim = String(body.dataFim || q.dataFim || '').trim();
    const status = String(body.status || q.status || '').trim() || null;
    const meioPagamento = String(body.meioPagamento || q.meioPagamento || '').trim() || null;

    const result = await buildFinancialExport(db, { dataInicio, dataFim, status, meioPagamento });

    const vendasRows = result.vendas.map(v => ({ ...v }));
    const itensRows = result.vendas.flatMap(v => v.itens);
    const pagamentosRows = result.vendas.flatMap(v => v.pagamentos);
    const estornosRows = result.vendas.flatMap(v => v.estornos);

    const files = [
      { name: 'financeiro.json', content: JSON.stringify(result, null, 2) },
      { name: 'vendas.csv', content: toCsv(vendasRows, VENDAS_COLS) },
      { name: 'itens.csv', content: toCsv(itensRows, ITENS_COLS) },
      { name: 'pagamentos.csv', content: toCsv(pagamentosRows, PAGAMENTOS_COLS) }
    ];
    if (estornosRows.length) files.push({ name: 'estornos.csv', content: toCsv(estornosRows, ESTORNOS_COLS) });

    const zipBuffer = buildZip(files);
    const filename = `financeiro_${dataInicio}_${dataFim}.zip`;

    await audit(db, 'exportacao_financeira_gerada', {
      usuarioId: actor.id, usuarioNome: actor.nome, usuarioPerfil: actor.perfil,
      dataInicio, dataFim, status: status || null, meioPagamento: meioPagamento || null,
      quantidadeVendas: result.vendas.length, quantidadeAvisos: result.warnings.length,
      descricaoHumana: `${actor.nome} gerou a exportação financeira de ${dataInicio} a ${dataFim} (${result.vendas.length} venda(s)).`
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(zipBuffer.length));
    return res.end(zipBuffer);
  } catch (e) {
    console.error('exportar-financeiro', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'Não foi possível gerar a exportação financeira.' });
  }
};
