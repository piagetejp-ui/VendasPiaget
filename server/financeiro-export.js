/* Agregador da exportação financeira (fonte estruturada para a Base Mestre externa).
   Lê dados já existentes (vendas, movimentos_conta, pedidos, pedidos_farda, pagamentos,
   catálogo) e monta o modelo canônico venda -> itens -> pagamentos -> estornos. Nunca
   inventa, nunca preenche com zero/"Outros" quando a informação não existe no histórico:
   o campo sai null. Não decide classificação contábil (DRE) - só registra o fato comercial. */
const { loadCatalogItemMap, loadCatalogCategoryMap, loadProductMap } = require('./_utils');
const resumoHelpers = require('./handler-resumo-operacional');

function cents(v) { const n = Number(v || 0); return Number.isFinite(n) ? Math.round(n) : 0; }
function reais(v) { if (v === null || v === undefined) return null; return Math.round(cents(v)) / 100; }

/* Horário de Brasília é -03:00 fixo desde o fim do horário de verão em 2019 (lei 13.972/2019);
   não há DST a considerar. criadoEm em Firestore é sempre UTC (new Date().toISOString()). */
function toSaoPauloIso(isoUtc) {
  if (!isoUtc) return null;
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() - 3 * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}-03:00`;
}
function rangeToUtcIso(dataInicio, dataFim) {
  const inicioUtc = `${dataInicio}T03:00:00.000Z`;
  const fimDate = new Date(`${dataFim}T00:00:00.000Z`);
  fimDate.setUTCDate(fimDate.getUTCDate() + 1);
  fimDate.setUTCHours(2, 59, 59, 999);
  return { inicioUtc, fimUtc: fimDate.toISOString() };
}
function validDateKey(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
function validCompetencia(v) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || '')) ? v : null; }

async function pageAllRange(db, collection, field, gte, lte) {
  const out = []; let cursor = null;
  while (true) {
    let q = db.collection(collection).where(field, '>=', gte).where(field, '<=', lte).orderBy(field).limit(500);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    out.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    if (snap.docs.length < 500) break;
    cursor = snap.docs[snap.docs.length - 1].get(field);
  }
  return out;
}

function categoriaSubcategoria(categoriaId, categoryMap) {
  if (!categoriaId) return { categoria: null, subcategoria: null };
  const cat = categoryMap.get(String(categoriaId));
  if (!cat) return { categoria: null, subcategoria: null };
  if (cat.parentId) {
    const root = categoryMap.get(String(cat.parentId));
    return { categoria: root ? (root.nome || null) : null, subcategoria: cat.nome || null };
  }
  return { categoria: cat.nome || null, subcategoria: null };
}
function resolveLineCategoria(line, categoryMap) {
  if (line.categoriaId) {
    const r = categoriaSubcategoria(line.categoriaId, categoryMap);
    if (r.categoria) return r;
  }
  const tipoOp = String(line.tipoOperacional || line.tipo || '').toLowerCase();
  if (tipoOp === 'programacao_lanche') return { categoria: 'Lanche / Cantina', subcategoria: null };
  if (tipoOp === 'fardamento' || line.tipo === 'farda') return { categoria: 'Farda', subcategoria: null };
  return { categoria: null, subcategoria: null };
}
function resolveLegacyProdutoCategoria(produtoId, legacyToCatalog, categoryMap) {
  const item = legacyToCatalog.get(String(produtoId));
  if (item && item.categoriaId) return categoriaSubcategoria(item.categoriaId, categoryMap);
  return { categoria: 'Lanche / Cantina', subcategoria: null }; // produtoId só existe hoje para itens de cantina (ver normalizeOrderInput)
}
function eventoInfo(line, itemMap) {
  const tipoOp = String(line.tipoOperacional || '').toLowerCase();
  if (line.catalogoItemId) {
    const item = itemMap.get(String(line.catalogoItemId));
    if (item && String(item.tipoOperacional || '').toLowerCase() === 'evento') return { id: item.id, nome: item.nome || null };
  }
  if (tipoOp === 'evento') return { id: line.catalogoItemId || null, nome: line.nome || null };
  return { id: null, nome: null };
}

function mapStatusVenda(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('cancel')) return 'cancelada';
  if (s === 'revisao') return 'em_revisao';
  if (['confirmada', 'confirmado', 'aplicado', 'pago', 'reservado_estoque'].includes(s)) return 'concluida';
  if (['pendente', 'aguardando_pagamento', 'reservado', 'preparando_link', 'aguardando_producao'].includes(s)) return 'pendente';
  return s || 'desconhecido';
}
function deriveCanal({ origem, orderNsu, actorPerfil }) {
  const o = String(origem || '').toLowerCase();
  if (o.includes('secretaria_online')) return 'link_publico';
  if (o === 'secretaria' || o === 'secretaria_presencial') return 'secretaria';
  if (o.includes('portal') || actorPerfil === 'responsavel') return 'online';
  if (orderNsu) return 'link_publico';
  return 'outro';
}
function mapMetodo(metodo) {
  const m = String(metodo || '').toLowerCase();
  const map = { dinheiro: 'dinheiro', pix: 'pix', pix_manual: 'pix', pix_banco: 'pix', pix_rede: 'pix', cartao: 'cartao', cartao_rede: 'cartao', maquininha: 'cartao', saldo_conta: 'saldo_conta' };
  return map[m] || m || null;
}
function mapAdquirente(p) {
  if (p.adquirente) return p.adquirente === 'infinitepay' ? 'InfinitePay' : p.adquirente === 'rede_laranjinha' ? 'Rede' : p.adquirente;
  if (p.origemPix === 'infinitepay') return 'InfinitePay';
  if (p.origemPix === 'rede_laranjinha') return 'Rede';
  return null;
}

/* Pagamento presencial: o objeto já vem com a composição completa registrada em
   registrar-operacao-presencial (server/_utils.js, registerInPersonOperation). */
function buildPresencialPagamento(p, id, vendaId, dataHoraVenda, statusVenda) {
  return {
    pagamento_id: id,
    venda_id: vendaId,
    data_hora_pagamento: dataHoraVenda,
    status_pagamento: statusVenda === 'cancelada' ? 'estornado' : 'pago',
    meio_pagamento: mapMetodo(p.metodo),
    adquirente: mapAdquirente(p),
    transacao_id: null,
    referencia_provedor: null,
    nsu: p.nsu || null,
    codigo_autorizacao: null,
    bandeira: null,
    parcelas: p.parcelas || null,
    valor_bruto: reais(p.valorAplicadoCentavos),
    taxa: p.taxaCentavos != null ? reais(p.taxaCentavos) : null,
    valor_liquido: p.valorLiquidoCentavos != null ? reais(p.valorLiquidoCentavos) : (p.metodo === 'dinheiro' ? reais(p.valorAplicadoCentavos) : null),
    data_prevista_liquidacao: null,
    data_liquidacao: null,
    observacao: p.observacao || null
  };
}
/* Pagamento InfinitePay: lido do documento pagamentos/{orderNsu}, criado em
   applyCheckoutConfirmation (server/_utils.js) quando a InfinitePay confirma o recebimento. */
function buildInfinitePayPagamento(doc, vendaId, statusVenda) {
  return {
    pagamento_id: doc.id,
    venda_id: vendaId,
    data_hora_pagamento: toSaoPauloIso(doc.confirmadoEm || doc.criadoEm),
    status_pagamento: statusVenda === 'cancelada' ? 'estornado' : (doc.status === 'confirmado' ? 'pago' : (doc.status || null)),
    meio_pagamento: doc.captureMethod ? String(doc.captureMethod).toLowerCase() : 'checkout_infinitepay',
    adquirente: 'InfinitePay',
    transacao_id: doc.transactionNsu || null,
    referencia_provedor: doc.invoiceSlug || null,
    nsu: null,
    codigo_autorizacao: null,
    bandeira: null,
    parcelas: null,
    valor_bruto: reais(doc.paidAmountCentavos || doc.amountCentavos || doc.valorBrutoCentavos),
    taxa: null,
    valor_liquido: null,
    data_prevista_liquidacao: null,
    data_liquidacao: null,
    observacao: null
  };
}

function buildEstornoFromVenda(venda, vendaId) {
  if (!String(venda.status || '').toLowerCase().includes('cancel')) return null;
  return {
    estorno_id: venda.reembolsoId || `canc_${vendaId}`,
    pagamento_id_original: Array.isArray(venda.pagamentosIds) && venda.pagamentosIds.length ? venda.pagamentosIds.join('|') : (venda.orderNsu || null),
    venda_id: vendaId,
    data_hora_estorno: toSaoPauloIso(venda.canceladoEm) || toSaoPauloIso(venda.atualizadoEm),
    valor_estornado: venda.cancelamentoTipo === 'cancelamento_com_reembolso_ao_pagador' ? reais(venda.valorPagamentoEstornadoCentavos ?? venda.valorBrutoCentavos) : reais(venda.valorBrutoCentavos),
    motivo: venda.motivoCancelamento || venda.motivoCancelamentoCodigo || null,
    operador: venda.canceladoPorNome || null,
    referencia_provedor: venda.referenciaReembolso || null
  };
}

async function buildFinancialExport(db, { dataInicio, dataFim, status = null, meioPagamento = null } = {}) {
  if (!validDateKey(dataInicio) || !validDateKey(dataFim) || dataInicio > dataFim) {
    throw Object.assign(new Error('Informe um período válido (data inicial até data final, no formato AAAA-MM-DD).'), { status: 400 });
  }
  const { inicioUtc, fimUtc } = rangeToUtcIso(dataInicio, dataFim);
  const warnings = [];

  const [vendasDocs, movimentosDocs, pedidosDocs, pedidosFardaDocs, categoryMap, itemMap, productMap] = await Promise.all([
    pageAllRange(db, 'vendas', 'criadoEm', inicioUtc, fimUtc),
    pageAllRange(db, 'movimentos_conta', 'criadoEm', inicioUtc, fimUtc),
    pageAllRange(db, 'pedidos', 'criadoEm', inicioUtc, fimUtc),
    pageAllRange(db, 'pedidos_farda', 'criadoEm', inicioUtc, fimUtc),
    loadCatalogCategoryMap(db),
    loadCatalogItemMap(db),
    loadProductMap(db)
  ]);
  const legacyToCatalog = new Map();
  for (const item of itemMap.values()) if (item.legacyProdutoId) legacyToCatalog.set(String(item.legacyProdutoId), item);

  // Alunos citados nesta janela: um único getAll para turma/responsável, em vez de 1 leitura por venda.
  const alunoIds = new Set();
  for (const v of vendasDocs) if (v.alunoId) alunoIds.add(String(v.alunoId));
  for (const m of movimentosDocs) if (m.alunoId) alunoIds.add(String(m.alunoId));
  for (const p of pedidosDocs) if (p.alunoId) alunoIds.add(String(p.alunoId));
  for (const p of pedidosFardaDocs) if (p.alunoId) alunoIds.add(String(p.alunoId));
  const alunoMap = new Map();
  if (alunoIds.size) {
    const ids = [...alunoIds];
    const refs = ids.map(id => db.collection('alunos').doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s, i) => { if (s.exists) alunoMap.set(ids[i], { id: ids[i], ...s.data() }); });
  }
  function alunoInfo(alunoId, fallbackNome, fallbackTurma) {
    const a = alunoId ? alunoMap.get(String(alunoId)) : null;
    return {
      aluno_id: alunoId || null,
      aluno_nome: a?.nome || fallbackNome || null,
      turma: a?.turma || fallbackTurma || null,
      responsavel_id: a?.responsavelFinanceiroId || a?.contaFinanceiraId || null,
      responsavel_nome: a?.responsavelFinanceiro || null
    };
  }

  // Checkouts citados (para operador de cobranças geradas via link e para o pagamento InfinitePay em si).
  const orderNsus = new Set();
  for (const v of vendasDocs) if (v.orderNsu) orderNsus.add(String(v.orderNsu));
  for (const m of movimentosDocs) if (m.orderNsu && m.tipo === 'entrada_conta_aluno' && !m.vendaId && !m.pedidoId) orderNsus.add(String(m.orderNsu));
  for (const p of pedidosDocs) if (p.orderNsu) orderNsus.add(String(p.orderNsu));
  for (const p of pedidosFardaDocs) if (p.orderNsu) orderNsus.add(String(p.orderNsu));
  const checkoutMap = new Map(), pagamentoInfinitePayMap = new Map();
  if (orderNsus.size) {
    const ids = [...orderNsus];
    const [checkoutSnaps, pagSnaps] = await Promise.all([
      db.getAll(...ids.map(id => db.collection('pagamentos_checkout').doc(id))),
      db.getAll(...ids.map(id => db.collection('pagamentos').doc(id)))
    ]);
    checkoutSnaps.forEach((s, i) => { if (s.exists) checkoutMap.set(ids[i], { id: ids[i], ...s.data() }); });
    pagSnaps.forEach((s, i) => { if (s.exists) pagamentoInfinitePayMap.set(ids[i], { id: ids[i], ...s.data() }); });
  }

  const vendas = [];
  let itemSeq = 0;

  // --- 1) vendas (secretaria presencial + venda_online_secretaria) ---
  for (const v of vendasDocs) {
    const vendaId = v.id;
    const statusVenda = mapStatusVenda(v.status);
    const checkout = v.orderNsu ? checkoutMap.get(String(v.orderNsu)) : null;
    const dataHora = toSaoPauloIso(v.criadoEm);
    const aluno = alunoInfo(v.alunoId, v.alunoNome, v.turma);

    const itens = (Array.isArray(v.itens) ? v.itens : []).map(line => {
      const { categoria, subcategoria } = resolveLineCategoria(line, categoryMap);
      const evento = eventoInfo(line, itemMap);
      const qtd = Number(line.quantidade || 1);
      const unit = reais(line.precoUnitarioCentavos);
      const bruto = reais((line.precoUnitarioCentavos || 0) * qtd);
      const liquido = reais(line.totalCentavos);
      return {
        item_id: `${vendaId}__item${itemSeq++}`,
        venda_id: vendaId,
        produto_id: line.catalogoItemId || null,
        produto_nome: line.nome || null,
        categoria,
        subcategoria,
        projeto_evento_id: evento.id,
        projeto_evento_nome: evento.nome,
        quantidade: qtd,
        valor_unitario: unit,
        valor_bruto: bruto,
        desconto: null,
        valor_liquido: liquido
      };
    });
    // Regularização de saldo embutida no mesmo link (mesma lógica de relatorio_categorias em
    // server/handler-resumo-operacional.js): não vira item de catálogo, mas precisa aparecer
    // na venda para o valor bater com o que foi de fato cobrado no link.
    const regularizacaoEmbutida = Math.max(0, cents(v.valorRecebidoCentavos) - cents(v.valorBrutoCentavos) + cents(v.valorSaldoUtilizadoCentavos));
    if (regularizacaoEmbutida > 0) {
      const breakdownItems = await resumoHelpers.debtCompositionItems(db, v.alunoId, v.criadoEm, regularizacaoEmbutida, categoryMap);
      const explicado = breakdownItems.reduce((s, x) => s + cents(x.valorCentavos), 0);
      const faltante = regularizacaoEmbutida - explicado;
      const composed = faltante > 0 ? [...breakdownItems, { nome: 'Regularização de saldo (origem não identificada no histórico)', categoria: 'Regularização de saldo', valorCentavos: faltante }] : breakdownItems;
      for (const b of composed) {
        itens.push({
          item_id: `${vendaId}__item${itemSeq++}`,
          venda_id: vendaId,
          produto_id: null,
          produto_nome: b.nome || 'Regularização de saldo',
          categoria: b.categoria || null,
          subcategoria: null,
          projeto_evento_id: null,
          projeto_evento_nome: null,
          quantidade: 1,
          valor_unitario: reais(b.valorCentavos),
          valor_bruto: reais(b.valorCentavos),
          desconto: null,
          valor_liquido: reais(b.valorCentavos)
        });
      }
    }
    const totalComRegularizacao = cents(v.valorBrutoCentavos) + regularizacaoEmbutida;

    const pagamentos = [];
    if (Array.isArray(v.pagamentos) && v.pagamentos.length && Array.isArray(v.pagamentosIds)) {
      v.pagamentos.forEach((p, i) => pagamentos.push(buildPresencialPagamento(p, v.pagamentosIds[i] || `${vendaId}__pag${i}`, vendaId, dataHora, statusVenda)));
    } else if (v.orderNsu && pagamentoInfinitePayMap.has(String(v.orderNsu))) {
      pagamentos.push(buildInfinitePayPagamento(pagamentoInfinitePayMap.get(String(v.orderNsu)), vendaId, statusVenda));
    }

    const estorno = buildEstornoFromVenda(v, vendaId);

    vendas.push({
      venda_id: vendaId,
      data_hora_venda: dataHora,
      status_venda: statusVenda,
      canal: deriveCanal({ origem: v.origem || v.canal, orderNsu: v.orderNsu, actorPerfil: checkout?.criadoPorPerfil }),
      aluno_id: aluno.aluno_id,
      aluno_nome: aluno.aluno_nome,
      turma: aluno.turma,
      responsavel_id: aluno.responsavel_id,
      responsavel_nome: aluno.responsavel_nome,
      operador_id: v.operadorId || checkout?.criadoPorId || null,
      operador_nome: v.operadorNome || checkout?.criadoPorNome || null,
      valor_bruto: reais(totalComRegularizacao),
      desconto: null,
      valor_liquido: reais(totalComRegularizacao),
      observacao: v.detalhesCancelamento || null,
      competencia_referencia: singleCompetencia(v.itens),
      itens,
      pagamentos,
      estornos: estorno ? [estorno] : []
    });
  }

  // --- 2) crédito/regularização lançados direto na conta (sem venda, sem pedido) ---
  const manualMoves = movimentosDocs.filter(m => m.tipo === 'entrada_conta_aluno' && !m.vendaId && !m.pedidoId);
  for (const m of manualMoves) {
    const vendaId = `mov_${m.id}`;
    const statusVenda = 'concluida'; // movimento já é o efeito de um pagamento aplicado
    const dataHora = toSaoPauloIso(m.criadoEm);
    const aluno = alunoInfo(m.alunoId, m.alunoNome, m.turma);
    const label = resumoHelpers.MANUAL_MOVEMENT_LABELS[m.subtipo] || (m.subtipo === 'pagamento_checkout_infinitepay' ? 'Crédito via link InfinitePay' : null);
    if (!label && m.subtipo !== 'pagamento_checkout_infinitepay') continue; // outro subtipo de entrada_conta_aluno não coberto aqui (ex.: estorno) fica fora
    const isRegularizacao = m.subtipo === 'regularizacao_saldo_secretaria';
    let itens;
    if (isRegularizacao) {
      const breakdownItems = await resumoHelpers.debtCompositionItems(db, m.alunoId, m.criadoEm, cents(m.valorCentavos), categoryMap);
      const explicado = breakdownItems.reduce((s, x) => s + cents(x.valorCentavos), 0);
      const faltante = cents(m.valorCentavos) - explicado;
      const composed = faltante > 0 ? [...breakdownItems, { nome: 'Regularização de saldo (origem não identificada no histórico)', categoria: 'Regularização de saldo', valorCentavos: faltante }] : breakdownItems;
      itens = composed.map(b => ({
        item_id: `${vendaId}__item${itemSeq++}`, venda_id: vendaId, produto_id: null, produto_nome: b.nome || 'Regularização de saldo',
        categoria: b.categoria || null, subcategoria: null, projeto_evento_id: null, projeto_evento_nome: null,
        quantidade: 1, valor_unitario: reais(b.valorCentavos), valor_bruto: reais(b.valorCentavos), desconto: null, valor_liquido: reais(b.valorCentavos)
      }));
    } else {
      // Crédito adicionado não é produto do catálogo - mecanismo de saldo, não categoria de venda
      // (mesmo princípio já adotado em relatorio_categorias: fica sem categoria, nunca "Outros").
      itens = [{
        item_id: `${vendaId}__item${itemSeq++}`, venda_id: vendaId, produto_id: null, produto_nome: label || 'Crédito adicionado',
        categoria: null, subcategoria: null, projeto_evento_id: null, projeto_evento_nome: null,
        quantidade: 1, valor_unitario: reais(m.valorCentavos), valor_bruto: reais(m.valorCentavos), desconto: null, valor_liquido: reais(m.valorCentavos)
      }];
    }
    const pagamentos = [];
    if (Array.isArray(m.pagamentos) && m.pagamentos.length) {
      m.pagamentos.forEach((p, i) => pagamentos.push(buildPresencialPagamento(p, `${vendaId}__pag${i}`, vendaId, dataHora, statusVenda)));
    } else if (m.orderNsu && pagamentoInfinitePayMap.has(String(m.orderNsu))) {
      pagamentos.push(buildInfinitePayPagamento(pagamentoInfinitePayMap.get(String(m.orderNsu)), vendaId, statusVenda));
    }
    const checkout = m.orderNsu ? checkoutMap.get(String(m.orderNsu)) : null;
    vendas.push({
      venda_id: vendaId,
      data_hora_venda: dataHora,
      status_venda: statusVenda,
      canal: deriveCanal({ origem: m.orderNsu ? null : 'secretaria', orderNsu: m.orderNsu, actorPerfil: checkout?.criadoPorPerfil }),
      aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
      responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
      operador_id: m.usuarioId || checkout?.criadoPorId || null,
      operador_nome: m.usuarioNome || checkout?.criadoPorNome || null,
      valor_bruto: reais(m.valorCentavos), desconto: null, valor_liquido: reais(m.valorCentavos),
      observacao: m.observacao || null, competencia_referencia: null,
      itens, pagamentos, estornos: []
    });
  }

  // --- 3) pedidos de cantina/farda comprados direto pela família (sem venda da secretaria) ---
  for (const p of pedidosDocs) {
    if (p.vendaId) continue; // já coberto como item da venda em (1)
    const vendaId = `ped_${p.id}`;
    const statusVenda = mapStatusVenda(p.statusPedido || p.statusPagamento);
    const dataHora = toSaoPauloIso(p.criadoEm);
    const aluno = alunoInfo(p.alunoId, p.alunoNome, p.turma);
    const itens = [];
    for (const dia of (Array.isArray(p.dias) ? p.dias : [])) {
      for (const it of (Array.isArray(dia.itens) ? dia.itens : [])) {
        const { categoria, subcategoria } = resolveLegacyProdutoCategoria(it.produtoId, legacyToCatalog, categoryMap);
        const produto = productMap.get(String(it.produtoId || ''));
        const qtd = Number(it.quantidade || 1);
        itens.push({
          item_id: `${vendaId}__item${itemSeq++}`, venda_id: vendaId, produto_id: it.produtoId || null,
          produto_nome: produto?.nome || it.nome || null, categoria, subcategoria,
          projeto_evento_id: null, projeto_evento_nome: null, quantidade: qtd,
          valor_unitario: reais(it.precoUnitarioCentavos), valor_bruto: reais((it.precoUnitarioCentavos || 0) * qtd),
          desconto: null, valor_liquido: reais(it.totalCentavos != null ? it.totalCentavos : (it.precoUnitarioCentavos || 0) * qtd)
        });
      }
    }
    const pagamentos = [];
    if (p.orderNsu && pagamentoInfinitePayMap.has(String(p.orderNsu))) pagamentos.push(buildInfinitePayPagamento(pagamentoInfinitePayMap.get(String(p.orderNsu)), vendaId, statusVenda));
    const checkout = p.orderNsu ? checkoutMap.get(String(p.orderNsu)) : null;
    vendas.push({
      venda_id: vendaId, data_hora_venda: dataHora, status_venda: statusVenda,
      canal: deriveCanal({ origem: p.origem, orderNsu: p.orderNsu, actorPerfil: p.criadoPorPerfil }),
      aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
      responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
      operador_id: p.criadoPorId || checkout?.criadoPorId || null, operador_nome: p.criadoPorNome || checkout?.criadoPorNome || null,
      valor_bruto: reais(p.totalCentavos), desconto: null, valor_liquido: reais(p.totalCentavos),
      observacao: p.observacao || null, competencia_referencia: null,
      itens, pagamentos, estornos: []
    });
  }

  // --- 4) fardamento comprado direto pela família ---
  for (const p of pedidosFardaDocs) {
    if (p.vendaId) continue;
    const vendaId = `fda_${p.id}`;
    const statusVenda = mapStatusVenda(p.statusAtendimento || p.statusPagamento);
    const dataHora = toSaoPauloIso(p.criadoEm);
    const aluno = alunoInfo(p.alunoId, p.alunoNome, p.turma);
    const qtd = Number(p.quantidade || 1);
    const itens = [{
      item_id: `${vendaId}__item0`, venda_id: vendaId, produto_id: p.modeloFardaId || null,
      produto_nome: p.produto || null, categoria: 'Farda', subcategoria: null,
      projeto_evento_id: null, projeto_evento_nome: null, quantidade: qtd,
      valor_unitario: reais(p.precoUnitarioCentavos), valor_bruto: reais((p.precoUnitarioCentavos || 0) * qtd),
      desconto: null, valor_liquido: reais(p.totalCentavos)
    }];
    const pagamentos = [];
    if (p.orderNsu && pagamentoInfinitePayMap.has(String(p.orderNsu))) pagamentos.push(buildInfinitePayPagamento(pagamentoInfinitePayMap.get(String(p.orderNsu)), vendaId, statusVenda));
    const checkout = p.orderNsu ? checkoutMap.get(String(p.orderNsu)) : null;
    vendas.push({
      venda_id: vendaId, data_hora_venda: dataHora, status_venda: statusVenda,
      canal: deriveCanal({ origem: p.origem, orderNsu: p.orderNsu, actorPerfil: p.criadoPorPerfil }),
      aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
      responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
      operador_id: p.criadoPorId || checkout?.criadoPorId || null, operador_nome: p.criadoPorNome || checkout?.criadoPorNome || null,
      valor_bruto: reais(p.totalCentavos), desconto: null, valor_liquido: reais(p.totalCentavos),
      observacao: null, competencia_referencia: null,
      itens, pagamentos, estornos: []
    });
  }

  // --- filtros opcionais ---
  let filtered = vendas;
  if (status) filtered = filtered.filter(v => v.status_venda === status);
  if (meioPagamento) filtered = filtered.filter(v => v.pagamentos.some(p => p.meio_pagamento === meioPagamento));
  filtered.sort((a, b) => String(a.data_hora_venda || '').localeCompare(String(b.data_hora_venda || '')));

  // --- validações (não bloqueiam a exportação; entram no relatório para auditoria) ---
  for (const v of filtered) {
    const somaItens = v.itens.reduce((s, i) => s + (i.valor_liquido || 0), 0);
    if (Math.abs(somaItens - (v.valor_liquido || 0)) > 0.01) {
      warnings.push(`venda ${v.venda_id}: soma dos itens (${somaItens.toFixed(2)}) difere do valor líquido da venda (${(v.valor_liquido || 0).toFixed(2)}).`);
    }
    if (v.status_venda === 'concluida') {
      const somaPagamentos = v.pagamentos.reduce((s, p) => s + (p.valor_bruto || 0), 0);
      if (v.pagamentos.length && Math.abs(somaPagamentos - (v.valor_liquido || 0)) > 0.01) {
        warnings.push(`venda ${v.venda_id}: soma dos pagamentos (${somaPagamentos.toFixed(2)}) difere do valor líquido da venda (${(v.valor_liquido || 0).toFixed(2)}).`);
      }
    }
  }

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    gerado_em: toSaoPauloIso(new Date().toISOString()),
    vendas: filtered,
    warnings
  };
}

function singleCompetencia(itens) {
  const vals = new Set((Array.isArray(itens) ? itens : []).map(x => validCompetencia(x?.metadados?.competencia)).filter(Boolean));
  return vals.size === 1 ? [...vals][0] : null;
}

module.exports = { buildFinancialExport, toSaoPauloIso, reais };
