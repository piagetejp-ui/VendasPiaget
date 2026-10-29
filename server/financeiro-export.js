/* Agregador da exportação financeira (fonte estruturada para a Base Mestre externa).
   Lê dados já existentes (vendas, movimentos_conta, lancamentos_manuais, pedidos,
   pedidos_farda, pagamentos, catálogo) e monta o modelo canônico venda -> itens ->
   pagamentos -> estornos. Nunca inventa, nunca preenche com zero/"Outros" quando a
   informação não existe no histórico: o campo sai null. Não decide classificação
   contábil (DRE) - só registra o fato comercial.

   Pendências ("Lançar pendência anterior") viram vendas com status_venda='a_receber'
   até serem quitadas. Quando um pagamento posterior (link InfinitePay via "Gerar
   cobrança", ou regularização presencial) quita uma ou mais pendências, o pagamento é
   ALOCADO contra a(s) venda(s) original(is) - nunca vira uma venda sintética nova. Só
   quando sobra valor sem nenhuma pendência para explicar (crédito avulso, ou dívida
   antiga sem lançamento formal) é que nasce uma venda própria para esse resto. */
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
/* Cadeia de fallback: categoriaId do catálogo (fonte atual) -> campo texto "categoria" que
   vendas antigas às vezes guardavam antes do catálogo existir -> tipoOperacional conhecido.
   Só vira null quando nenhuma dessas pistas existe no documento. */
function resolveLineCategoria(line, categoryMap) {
  if (line.categoriaId) {
    const r = categoriaSubcategoria(line.categoriaId, categoryMap);
    if (r.categoria) return r;
  }
  const tipoOp = String(line.tipoOperacional || line.tipo || '').toLowerCase();
  if (tipoOp === 'programacao_lanche') return { categoria: 'Lanche / Cantina', subcategoria: null };
  if (tipoOp === 'fardamento' || line.tipo === 'farda') return { categoria: 'Farda', subcategoria: null };
  if (line.categoria && typeof line.categoria === 'string' && line.categoria.trim()) return { categoria: line.categoria.trim(), subcategoria: null };
  return { categoria: null, subcategoria: null };
}
function resolveLegacyProdutoCategoria(produtoId, legacyToCatalog, categoryMap) {
  const item = legacyToCatalog.get(String(produtoId));
  if (item && item.categoriaId) return categoriaSubcategoria(item.categoriaId, categoryMap);
  return { categoria: 'Lanche / Cantina', subcategoria: null }; // produtoId só existe hoje para itens de cantina (ver normalizeOrderInput)
}
/* Cadeia de fallback de valores: totalCentavos (padrão atual) -> valorCentavos (campo genérico
   que alguns lançamentos antigos usavam) -> unitário derivado do total quando só ele existe.
   Nunca inventa um valor que não possa ser calculado a partir do que está realmente gravado. */
function resolveLineValores(line, qtd) {
  const totalRaw = line.totalCentavos != null ? line.totalCentavos : (line.valorCentavos != null ? line.valorCentavos : null);
  const total = totalRaw != null ? Math.abs(cents(totalRaw)) : null;
  const unit = line.precoUnitarioCentavos != null ? cents(line.precoUnitarioCentavos) : (total != null && qtd > 0 ? Math.round(total / qtd) : null);
  const bruto = unit != null ? unit * qtd : total;
  return { valor_unitario: reais(unit), valor_bruto: reais(bruto), valor_liquido: reais(total) };
}
function lineName(line) { return line.nome || line.produto || line.descricao || null; }
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
/* "Manter adquirente=Rede" para rede_laranjinha, conforme pedido. */
function mapAdquirente(p) {
  if (p.adquirente) return p.adquirente === 'infinitepay' ? 'InfinitePay' : p.adquirente === 'rede_laranjinha' ? 'Rede' : p.adquirente;
  if (p.origemPix === 'infinitepay') return 'InfinitePay';
  if (p.origemPix === 'rede_laranjinha') return 'Rede';
  return null;
}

/* Pagamento presencial: o objeto já vem com a composição completa registrada em
   registrar-operacao-presencial (server/_utils.js, registerInPersonOperation). Quando o
   mesmo pagamento é dividido entre várias vendas (ver allocatePayment), valorBrutoOverride
   entra com a fração alocada a ESTA venda - nesse caso taxa/valor líquido saem null, porque
   o sistema não registra separadamente quanto da taxa pertence a cada venda quitada. */
function buildPresencialPagamento(p, id, vendaId, dataHoraVenda, statusPago, valorBrutoOverrideCentavos) {
  const isSplit = valorBrutoOverrideCentavos != null;
  return {
    pagamento_id: id,
    venda_id: vendaId,
    data_hora_pagamento: dataHoraVenda,
    status_pagamento: statusPago,
    meio_pagamento: mapMetodo(p.metodo),
    adquirente: mapAdquirente(p),
    transacao_id: null,
    referencia_provedor: null,
    nsu: p.nsu || null,
    codigo_autorizacao: null,
    bandeira: null,
    parcelas: p.parcelas || null,
    valor_bruto: reais(isSplit ? valorBrutoOverrideCentavos : p.valorAplicadoCentavos),
    taxa: isSplit ? null : (p.taxaCentavos != null ? reais(p.taxaCentavos) : null),
    valor_liquido: isSplit ? null : (p.valorLiquidoCentavos != null ? reais(p.valorLiquidoCentavos) : (p.metodo === 'dinheiro' ? reais(p.valorAplicadoCentavos) : null)),
    data_prevista_liquidacao: null,
    data_liquidacao: null,
    observacao: p.observacao || null
  };
}
/* Pagamento InfinitePay: lido do documento pagamentos/{orderNsu}, criado em
   applyCheckoutConfirmation (server/_utils.js) quando a InfinitePay confirma o recebimento.
   valorBrutoOverride tem o mesmo papel do presencial: fração alocada a esta venda quando o
   mesmo pagamento quita mais de uma. */
function buildInfinitePayPagamento(doc, vendaId, statusPago, pagamentoIdOverride, valorBrutoOverrideCentavos) {
  return {
    pagamento_id: pagamentoIdOverride || doc.id,
    venda_id: vendaId,
    data_hora_pagamento: toSaoPauloIso(doc.confirmadoEm || doc.criadoEm),
    status_pagamento: statusPago,
    meio_pagamento: doc.captureMethod ? String(doc.captureMethod).toLowerCase() : 'checkout_infinitepay',
    adquirente: 'InfinitePay',
    transacao_id: doc.transactionNsu || null,
    referencia_provedor: doc.invoiceSlug || null,
    nsu: null,
    codigo_autorizacao: null,
    bandeira: null,
    parcelas: null,
    valor_bruto: reais(valorBrutoOverrideCentavos != null ? valorBrutoOverrideCentavos : (doc.paidAmountCentavos || doc.amountCentavos || doc.valorBrutoCentavos)),
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

/* Reconstrói, para um aluno, quais lancamentos_manuais (pendências "a_receber") cada
   pagamento de conta (sem vendaId/pedidoId) quitou - em ordem cronológica, igual à regra que
   o próprio sistema usa em applyAccountPaymentTx (server/_utils.js) para o caminho via link
   InfinitePay (ali já vem pronto em pendenciasQuitadasIds). Para regularização presencial, que
   não grava esse vínculo, a mesma regra FIFO é aplicada aqui para manter os dois caminhos
   consistentes. "Crédito adicionado" presencial nunca consome pendência (é decisão explícita
   do operador de só adicionar saldo, não quitar uma dívida específica). */
async function simulateAlunoLedger(db, alunoId) {
  const [lancSnap, movSnap] = await Promise.all([
    db.collection('lancamentos_manuais').where('alunoId', '==', alunoId).get(),
    db.collection('movimentos_conta').where('alunoId', '==', alunoId).get()
  ]);
  const lancamentos = lancSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  const repayments = movSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.tipo === 'entrada_conta_aluno' && !m.vendaId && !m.pedidoId)
    .sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  const remaining = new Map(lancamentos.map(l => [l.id, cents(l.totalCentavos)]));
  const allocationsByMovId = new Map();
  for (const m of repayments) {
    let budget = cents(m.valorCentavos);
    const allocs = [];
    if (Array.isArray(m.pendenciasQuitadasIds) && m.pendenciasQuitadasIds.length) {
      for (const lid of m.pendenciasQuitadasIds) {
        const left = remaining.get(lid);
        if (left == null || left <= 0) continue;
        const take = Math.min(left, budget);
        if (take > 0) { allocs.push({ lancamentoId: lid, valor: take }); remaining.set(lid, left - take); budget -= take; }
      }
    } else if (m.subtipo === 'regularizacao_saldo_secretaria') {
      for (const l of lancamentos) {
        if (budget <= 0) break;
        const left = remaining.get(l.id);
        if (!left) continue;
        const take = Math.min(left, budget);
        allocs.push({ lancamentoId: l.id, valor: take });
        remaining.set(l.id, left - take);
        budget -= take;
      }
    }
    allocationsByMovId.set(m.id, { allocs, remainder: budget });
  }
  return { lancamentos, allocationsByMovId };
}

function lancamentoVendaId(lancamentoId) { return `lan_${lancamentoId}`; }
function buildLancamentoVenda(l, aluno, categoryMap) {
  const vendaId = lancamentoVendaId(l.id);
  const { categoria, subcategoria } = resolveLineCategoria({ categoriaId: l.categoriaId }, categoryMap);
  const qtd = Number(l.quantidade || 1);
  const valores = resolveLineValores(l, qtd);
  const dataHora = l.dataOperacao || toSaoPauloIso(l.criadoEm);
  const statusVenda = l.status === 'cancelado' ? 'cancelada' : (l.statusPagamento === 'pago' ? 'concluida' : 'a_receber');
  return {
    venda_id: vendaId,
    data_hora_venda: dataHora,
    status_venda: statusVenda,
    canal: 'secretaria',
    aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
    responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
    operador_id: l.registradoPorId || null,
    operador_nome: l.registradoPorNome || null,
    valor_bruto: valores.valor_liquido, desconto: null, valor_liquido: valores.valor_liquido,
    observacao: 'Lançamento retroativo: venda que aconteceu fora do sistema e foi registrada depois na conta do aluno (fica pendente até o pagamento ser alocado a ela).',
    competencia_referencia: null,
    itens: [{
      item_id: `${vendaId}__item0`, venda_id: vendaId, produto_id: l.itemCatalogoId || null,
      produto_nome: l.descricao || null, categoria, subcategoria,
      projeto_evento_id: null, projeto_evento_nome: null, quantidade: qtd,
      valor_unitario: valores.valor_unitario, valor_bruto: valores.valor_bruto, desconto: null, valor_liquido: valores.valor_liquido
    }],
    pagamentos: [],
    estornos: []
  };
}

async function buildFinancialExport(db, { dataInicio, dataFim, status = null, meioPagamento = null } = {}) {
  if (!validDateKey(dataInicio) || !validDateKey(dataFim) || dataInicio > dataFim) {
    throw Object.assign(new Error('Informe um período válido (data inicial até data final, no formato AAAA-MM-DD).'), { status: 400 });
  }
  const { inicioUtc, fimUtc } = rangeToUtcIso(dataInicio, dataFim);
  const warnings = [];

  const [vendasDocs, movimentosDocs, pedidosDocs, pedidosFardaDocs, lancamentosInWindow, categoryMap, itemMap, productMap] = await Promise.all([
    pageAllRange(db, 'vendas', 'criadoEm', inicioUtc, fimUtc),
    pageAllRange(db, 'movimentos_conta', 'criadoEm', inicioUtc, fimUtc),
    pageAllRange(db, 'pedidos', 'criadoEm', inicioUtc, fimUtc),
    pageAllRange(db, 'pedidos_farda', 'criadoEm', inicioUtc, fimUtc),
    pageAllRange(db, 'lancamentos_manuais', 'criadoEm', inicioUtc, fimUtc),
    loadCatalogCategoryMap(db),
    loadCatalogItemMap(db),
    loadProductMap(db)
  ]);
  const legacyToCatalog = new Map();
  for (const item of itemMap.values()) if (item.legacyProdutoId) legacyToCatalog.set(String(item.legacyProdutoId), item);

  const standaloneRepayments = movimentosDocs.filter(m => m.tipo === 'entrada_conta_aluno' && !m.vendaId && !m.pedidoId);

  // Alunos citados nesta janela: um único getAll para turma/responsável, em vez de 1 leitura por venda.
  const alunoIds = new Set();
  for (const v of vendasDocs) if (v.alunoId) alunoIds.add(String(v.alunoId));
  for (const m of movimentosDocs) if (m.alunoId) alunoIds.add(String(m.alunoId));
  for (const p of pedidosDocs) if (p.alunoId) alunoIds.add(String(p.alunoId));
  for (const p of pedidosFardaDocs) if (p.alunoId) alunoIds.add(String(p.alunoId));
  for (const l of lancamentosInWindow) if (l.alunoId) alunoIds.add(String(l.alunoId));
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
  for (const m of standaloneRepayments) if (m.orderNsu) orderNsus.add(String(m.orderNsu));
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

  // Ledger por aluno: só para quem tem pendência criada na janela, ou pagamento de conta
  // (checkout ou regularização presencial) que pode estar quitando pendência - "crédito
  // adicionado" presencial nunca consome ledger, não precisa simular.
  const ledgerAlunoIds = new Set();
  for (const l of lancamentosInWindow) if (l.alunoId) ledgerAlunoIds.add(String(l.alunoId));
  for (const m of standaloneRepayments) if (m.alunoId && (m.subtipo === 'pagamento_checkout_infinitepay' || m.subtipo === 'regularizacao_saldo_secretaria')) ledgerAlunoIds.add(String(m.alunoId));
  const ledgerByAluno = new Map();
  for (const alunoId of ledgerAlunoIds) ledgerByAluno.set(alunoId, await simulateAlunoLedger(db, alunoId));

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
      const valores = resolveLineValores(line, qtd);
      return {
        item_id: `${vendaId}__item${itemSeq++}`,
        venda_id: vendaId,
        produto_id: line.catalogoItemId || null,
        produto_nome: lineName(line),
        categoria,
        subcategoria,
        projeto_evento_id: evento.id,
        projeto_evento_nome: evento.nome,
        quantidade: qtd,
        valor_unitario: valores.valor_unitario,
        valor_bruto: valores.valor_bruto,
        desconto: null,
        valor_liquido: valores.valor_liquido
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
      const statusPagto = statusVenda === 'cancelada' ? 'estornado' : 'pago';
      v.pagamentos.forEach((p, i) => pagamentos.push(buildPresencialPagamento(p, v.pagamentosIds[i] || `${vendaId}__pag${i}`, vendaId, dataHora, statusPagto)));
    } else if (v.orderNsu && pagamentoInfinitePayMap.has(String(v.orderNsu))) {
      const statusPagto = statusVenda === 'cancelada' ? 'estornado' : 'pago';
      pagamentos.push(buildInfinitePayPagamento(pagamentoInfinitePayMap.get(String(v.orderNsu)), vendaId, statusPagto));
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

  // --- 2) pendências lançadas na conta do aluno (lancamentos_manuais) ---
  const vendaByLancamentoId = new Map();
  function pushLancamentoVenda(l) {
    if (vendaByLancamentoId.has(l.id)) return vendaByLancamentoId.get(l.id);
    const venda = buildLancamentoVenda(l, alunoInfo(l.alunoId, l.alunoNome, l.turma), categoryMap);
    vendas.push(venda);
    vendaByLancamentoId.set(l.id, venda);
    return venda;
  }
  for (const l of lancamentosInWindow) pushLancamentoVenda(l);

  // --- 3) pagamentos de conta (sem vendaId/pedidoId): alocados contra as pendências que
  //        quitam; o que sobra sem pendência para explicar vira "Crédito adicionado" (ou,
  //        para regularização, a reconstrução por categoria do catálogo já existente). ---
  for (const m of standaloneRepayments) {
    const dataHora = toSaoPauloIso(m.criadoEm);
    const ledger = ledgerByAluno.get(String(m.alunoId));
    const allocInfo = ledger?.allocationsByMovId.get(m.id);
    const checkout = m.orderNsu ? checkoutMap.get(String(m.orderNsu)) : null;
    const isCheckout = Boolean(m.orderNsu) && pagamentoInfinitePayMap.has(String(m.orderNsu));
    const basePagDoc = isCheckout ? pagamentoInfinitePayMap.get(String(m.orderNsu)) : null;
    const presencialPayments = Array.isArray(m.pagamentos) && m.pagamentos.length ? m.pagamentos : null;
    const totalCentavosMov = cents(m.valorCentavos);
    const allocs = allocInfo?.allocs || [];
    const remainder = allocInfo ? allocInfo.remainder : totalCentavosMov;
    const isFullSingleAlloc = allocs.length === 1 && remainder === 0;

    for (const a of allocs) {
      let venda = vendaByLancamentoId.get(a.lancamentoId);
      if (!venda) {
        const l = ledger.lancamentos.find(x => x.id === a.lancamentoId);
        if (!l) continue; // não deveria acontecer: todo id em allocs vem de ledger.lancamentos
        venda = pushLancamentoVenda(l);
      }
      const statusPagto = venda.status_venda === 'cancelada' ? 'estornado' : 'pago';
      if (isCheckout) {
        venda.pagamentos.push(buildInfinitePayPagamento(basePagDoc, venda.venda_id, statusPagto, `${basePagDoc.id}__${a.lancamentoId}`, isFullSingleAlloc ? null : a.valor));
      } else if (presencialPayments) {
        presencialPayments.forEach((p, i) => {
          const fracao = totalCentavosMov > 0 ? cents(p.valorAplicadoCentavos) / totalCentavosMov : 0;
          const valorDestaFracao = isFullSingleAlloc && presencialPayments.length === 1 ? null : Math.round(a.valor * fracao);
          venda.pagamentos.push(buildPresencialPagamento(p, `${m.id}__pag${i}__${a.lancamentoId}`, venda.venda_id, dataHora, statusPagto, valorDestaFracao));
        });
      }
      // A regularização presencial quita a pendência de fato, mas não atualiza
      // lancamentos_manuais.statusPagamento no sistema hoje (só o caminho via link faz isso) -
      // recalcula aqui a partir do que foi de fato pago, em vez de confiar num campo que pode
      // estar desatualizado para esse caminho.
      if (venda.status_venda !== 'cancelada') {
        const somaPaga = venda.pagamentos.reduce((s, p) => s + (p.valor_bruto || 0), 0);
        if (venda.pagamentos.length && Math.abs(somaPaga - (venda.valor_liquido || 0)) <= 0.01) venda.status_venda = 'concluida';
      }
    }

    if (remainder > 0) {
      const vendaId = `mov_${m.id}`;
      const aluno = alunoInfo(m.alunoId, m.alunoNome, m.turma);
      let itens;
      if (m.subtipo === 'regularizacao_saldo_secretaria') {
        const breakdownItems = await resumoHelpers.debtCompositionItems(db, m.alunoId, m.criadoEm, remainder, categoryMap);
        const explicado = breakdownItems.reduce((s, x) => s + cents(x.valorCentavos), 0);
        const faltante = remainder - explicado;
        const composed = faltante > 0 ? [...breakdownItems, { nome: 'Regularização de saldo (origem não identificada no histórico)', categoria: 'Regularização de saldo', valorCentavos: faltante }] : breakdownItems;
        itens = composed.map(b => ({
          item_id: `${vendaId}__item${itemSeq++}`, venda_id: vendaId, produto_id: null, produto_nome: b.nome || 'Regularização de saldo',
          categoria: b.categoria || null, subcategoria: null, projeto_evento_id: null, projeto_evento_nome: null,
          quantidade: 1, valor_unitario: reais(b.valorCentavos), valor_bruto: reais(b.valorCentavos), desconto: null, valor_liquido: reais(b.valorCentavos)
        }));
      } else {
        // Crédito adicionado não é produto do catálogo - mecanismo de saldo, não categoria de
        // venda (mesmo princípio já adotado em relatorio_categorias: fica sem categoria, nunca
        // "Outros"). Só chega aqui quando não há nenhuma pendência em aberto para explicar.
        itens = [{
          item_id: `${vendaId}__item${itemSeq++}`, venda_id: vendaId, produto_id: null, produto_nome: 'Crédito adicionado',
          categoria: null, subcategoria: null, projeto_evento_id: null, projeto_evento_nome: null,
          quantidade: 1, valor_unitario: reais(remainder), valor_bruto: reais(remainder), desconto: null, valor_liquido: reais(remainder)
        }];
      }
      const pagamentos = [];
      const isFullRemainder = remainder === totalCentavosMov;
      if (isCheckout) {
        pagamentos.push(buildInfinitePayPagamento(basePagDoc, vendaId, 'pago', isFullRemainder ? undefined : `${basePagDoc.id}__sobra`, isFullRemainder ? null : remainder));
      } else if (presencialPayments) {
        presencialPayments.forEach((p, i) => {
          const fracao = totalCentavosMov > 0 ? cents(p.valorAplicadoCentavos) / totalCentavosMov : 0;
          const valorDestaFracao = isFullRemainder && presencialPayments.length === 1 ? null : Math.round(remainder * fracao);
          pagamentos.push(buildPresencialPagamento(p, `${m.id}__pag${i}__sobra`, vendaId, dataHora, 'pago', valorDestaFracao));
        });
      }
      vendas.push({
        venda_id: vendaId,
        data_hora_venda: dataHora,
        status_venda: 'concluida',
        canal: deriveCanal({ origem: m.orderNsu ? null : 'secretaria', orderNsu: m.orderNsu, actorPerfil: checkout?.criadoPorPerfil }),
        aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
        responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
        operador_id: m.usuarioId || checkout?.criadoPorId || null,
        operador_nome: m.usuarioNome || checkout?.criadoPorNome || null,
        valor_bruto: reais(remainder), desconto: null, valor_liquido: reais(remainder),
        observacao: m.observacao || null, competencia_referencia: null,
        itens, pagamentos, estornos: []
      });
    }
  }

  // --- 4) pedidos de cantina comprados direto pela família (sem venda da secretaria) ---
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
        const valores = resolveLineValores(it, qtd);
        itens.push({
          item_id: `${vendaId}__item${itemSeq++}`, venda_id: vendaId, produto_id: it.produtoId || null,
          produto_nome: produto?.nome || lineName(it), categoria, subcategoria,
          projeto_evento_id: null, projeto_evento_nome: null, quantidade: qtd,
          valor_unitario: valores.valor_unitario, valor_bruto: valores.valor_bruto, desconto: null, valor_liquido: valores.valor_liquido
        });
      }
    }
    const pagamentos = [];
    if (p.orderNsu && pagamentoInfinitePayMap.has(String(p.orderNsu))) pagamentos.push(buildInfinitePayPagamento(pagamentoInfinitePayMap.get(String(p.orderNsu)), vendaId, statusVenda === 'cancelada' ? 'estornado' : 'pago'));
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

  // --- 5) fardamento comprado direto pela família ---
  for (const p of pedidosFardaDocs) {
    if (p.vendaId) continue;
    const vendaId = `fda_${p.id}`;
    const statusVenda = mapStatusVenda(p.statusAtendimento || p.statusPagamento);
    const dataHora = toSaoPauloIso(p.criadoEm);
    const aluno = alunoInfo(p.alunoId, p.alunoNome, p.turma);
    const qtd = Number(p.quantidade || 1);
    const valores = resolveLineValores(p, qtd);
    const itens = [{
      item_id: `${vendaId}__item0`, venda_id: vendaId, produto_id: p.modeloFardaId || null,
      produto_nome: lineName(p), categoria: 'Farda', subcategoria: null,
      projeto_evento_id: null, projeto_evento_nome: null, quantidade: qtd,
      valor_unitario: valores.valor_unitario, valor_bruto: valores.valor_bruto, desconto: null, valor_liquido: valores.valor_liquido
    }];
    const pagamentos = [];
    if (p.orderNsu && pagamentoInfinitePayMap.has(String(p.orderNsu))) pagamentos.push(buildInfinitePayPagamento(pagamentoInfinitePayMap.get(String(p.orderNsu)), vendaId, statusVenda === 'cancelada' ? 'estornado' : 'pago'));
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
    // "a_receber" pode legitimamente não ter pagamento ainda - só vendas concluídas (pagas)
    // precisam fechar o valor em pagamentos.
    if (v.status_venda === 'concluida' && v.pagamentos.length) {
      const somaPagamentos = v.pagamentos.reduce((s, p) => s + (p.valor_bruto || 0), 0);
      if (Math.abs(somaPagamentos - (v.valor_liquido || 0)) > 0.01) {
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
