/* Agregador da exportação financeira (fonte estruturada para a Base Mestre externa).
   Lê dados já existentes (vendas, movimentos_conta, lancamentos_manuais, pedidos,
   pedidos_farda, pagamentos, catálogo) e monta um modelo relacional simples:

     vendas            fato comercial real (venda, pendência lançada, pedido de cantina/farda)
     itens             linhas de cada venda
     pagamentos        um registro por EVENTO de pagamento real (nunca duplicado por venda)
     alocacoes         ligação N:N entre pagamentos e vendas (pagamento_id, venda_id, valor_alocado)
     movimentacoes_conta  crédito/débito na conta do aluno sem produto específico (nunca é venda)
     estornos          cancelamentos de vendas pagas

   Nunca inventa, nunca preenche com zero/"Outros" quando a informação não existe no
   histórico: o campo sai null. Não decide classificação contábil (DRE) - só registra o
   fato comercial.

   Pendências ("Lançar pendência anterior") viram vendas com status_venda='a_receber' até
   serem quitadas; nunca partem de um campo armazenado que pode estar desatualizado
   (lancamentos_manuais.statusPagamento só é mantido pelo caminho via link InfinitePay) - o
   status só sobe para 'concluida' quando esta exportação encontra, de fato, pagamento(s)
   alocado(s) cobrindo o valor. Um pagamento que quita uma ou mais pendências é ALOCADO
   contra a(s) venda(s) original(is) - nunca vira uma venda sintética nova ("Crédito via
   link InfinitePay"/"Crédito adicionado" não são vendas). Valor sem nenhuma pendência para
   explicar vira um registro em movimentacoes_conta, não uma venda. */
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
/* Cadeia de fallback: categoriaId do catálogo (fonte atual) -> tipoOperacional conhecido ->
   campo texto "categoria" que vendas antigas às vezes guardavam antes do catálogo existir ->
   produtoId legado (produtos de cantina de antes do catálogo), só quando há correspondência
   objetiva em catalogo_itens.legacyProdutoId. Sem nenhuma dessas pistas, sai null - nunca um
   "Outros" inventado. */
function resolveLineCategoria(line, categoryMap, legacyToCatalog) {
  if (line.categoriaId) {
    const r = categoriaSubcategoria(line.categoriaId, categoryMap);
    if (r.categoria) return r;
  }
  const tipoOp = String(line.tipoOperacional || line.tipo || '').toLowerCase();
  if (tipoOp === 'programacao_lanche') return { categoria: 'Lanche / Cantina', subcategoria: null };
  if (tipoOp === 'fardamento' || line.tipo === 'farda') return { categoria: 'Farda', subcategoria: null };
  if (line.categoria && typeof line.categoria === 'string' && line.categoria.trim()) return { categoria: line.categoria.trim(), subcategoria: null };
  if (legacyToCatalog && line.produtoId != null) {
    const item = legacyToCatalog.get(String(line.produtoId));
    if (item && item.categoriaId) return categoriaSubcategoria(item.categoriaId, categoryMap);
  }
  return { categoria: null, subcategoria: null };
}
/* produto_id só aponta para o catálogo atual (catalogo_itens). Um produtoId legado só é usado
   quando resolve objetivamente para um item do catálogo atual; sem essa correspondência, sai
   null em vez de misturar dois espaços de IDs diferentes no mesmo campo. */
function resolveLineProdutoId(line, legacyToCatalog) {
  if (line.catalogoItemId) return line.catalogoItemId;
  if (line.itemCatalogoId) return line.itemCatalogoId;
  if (legacyToCatalog && line.produtoId != null) {
    const item = legacyToCatalog.get(String(line.produtoId));
    if (item) return item.id;
  }
  return null;
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
/* "Manter adquirente=Rede" para rede_laranjinha, conforme pedido - lido do campo real
   gravado na operação presencial (p.adquirente), nunca deduzido de meio_pagamento. */
function mapAdquirente(p) {
  if (p.adquirente) return p.adquirente === 'infinitepay' ? 'InfinitePay' : p.adquirente === 'rede_laranjinha' ? 'Rede' : p.adquirente;
  if (p.origemPix === 'infinitepay') return 'InfinitePay';
  if (p.origemPix === 'rede_laranjinha') return 'Rede';
  return null;
}
/* Um documento em pagamentos/{orderNsu} só representa um pagamento InfinitePay real quando a
   InfinitePay de fato confirmou o recebimento - um link gerado e nunca pago/expirado não pode
   ser tratado como a origem do dinheiro de uma venda ou pendência. */
function isConfirmedInfinitePay(doc) {
  if (!doc) return false;
  const s = String(doc.status || '').toLowerCase();
  return s === 'confirmado' || Boolean(doc.confirmadoEm);
}

/* Pagamento presencial: o objeto já vem com a composição completa registrada em
   registrar-operacao-presencial (server/_utils.js, registerInPersonOperation).
   valorAplicadoCentavos é o valor de fato aplicado contra a(s) venda(s)/pendência(s) (valor
   de venda); valorBrutoPassadoCentavos é o que foi passado na maquininha, que pode incluir
   acréscimo de parcelamento pago pelo cliente; valorLiquidoCentavos é o que o sistema
   registra como recebido. valor_venda/acrescimo_financeiro só são calculados depois, quando
   já se sabe contra quantas vendas este pagamento foi alocado (um mesmo pagamento pode
   quitar mais de uma pendência). */
function buildPresencialPagamentoRow(p, id, dataHora, statusPago, aluno) {
  const cobrado = p.valorBrutoPassadoCentavos != null ? cents(p.valorBrutoPassadoCentavos) : cents(p.valorAplicadoCentavos);
  const liquido = p.valorLiquidoCentavos != null ? cents(p.valorLiquidoCentavos) : cents(p.valorAplicadoCentavos);
  return {
    pagamento_id: id,
    data_hora_pagamento: dataHora,
    status_pagamento: statusPago,
    meio_pagamento: mapMetodo(p.metodo),
    adquirente: mapAdquirente(p),
    transacao_id: null,
    referencia_provedor: null,
    nsu: p.nsu || null,
    codigo_autorizacao: null,
    bandeira: null,
    parcelas: p.parcelas || null,
    data_prevista_liquidacao: null,
    data_liquidacao: null,
    observacao: p.observacao || null,
    aluno_id: aluno?.aluno_id || null,
    aluno_nome: aluno?.aluno_nome || null,
    _valorCobradoClienteCentavos: cobrado,
    _valorLiquidoRecebidoCentavos: liquido,
    _valorAplicadoCentavos: cents(p.valorAplicadoCentavos)
  };
}
/* Pagamento InfinitePay: lido do documento pagamentos/{orderNsu}, criado em
   applyCheckoutConfirmation (server/_utils.js) quando a InfinitePay confirma o recebimento.
   O sistema não informa separadamente o valor líquido após a taxa própria da InfinitePay -
   valor_liquido_recebido sai null para este meio em vez de ser inventado. */
function buildInfinitePayPagamentoRow(doc, dataHora, statusPago, aluno) {
  const cobrado = doc.paidAmountCentavos != null ? cents(doc.paidAmountCentavos) : (doc.amountCentavos != null ? cents(doc.amountCentavos) : null);
  return {
    pagamento_id: doc.id,
    data_hora_pagamento: dataHora || toSaoPauloIso(doc.confirmadoEm || doc.criadoEm),
    status_pagamento: statusPago,
    meio_pagamento: doc.captureMethod ? String(doc.captureMethod).toLowerCase() : 'checkout_infinitepay',
    adquirente: 'InfinitePay',
    transacao_id: doc.transactionNsu || null,
    referencia_provedor: doc.invoiceSlug || null,
    nsu: null,
    codigo_autorizacao: null,
    bandeira: null,
    parcelas: null,
    data_prevista_liquidacao: null,
    data_liquidacao: null,
    observacao: null,
    aluno_id: aluno?.aluno_id || null,
    aluno_nome: aluno?.aluno_nome || null,
    _valorCobradoClienteCentavos: cobrado,
    _valorLiquidoRecebidoCentavos: null,
    _valorAplicadoCentavos: cobrado
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
   InfinitePay (ali já vem pronto em pendenciasQuitadasIds). Para quitação presencial, que não
   grava esse vínculo, a mesma regra FIFO é aplicada aqui para manter os dois caminhos
   consistentes. Isso cobre tanto "regularizar débito" (regularizacao_saldo_secretaria) quanto
   "adicionar crédito" (credito_secretaria) presencial: na prática a secretaria usa as duas
   ações para quitar uma pendência específica, então as duas tentam primeiro consumir
   pendências em aberto; só o que sobrar sem pendência para explicar é que é crédito de fato. */
async function simulateAlunoLedger(db, alunoId) {
  const [lancSnap, movSnap] = await Promise.all([
    db.collection('lancamentos_manuais').where('alunoId', '==', alunoId).get(),
    db.collection('movimentos_conta').where('alunoId', '==', alunoId).get()
  ]);
  const lancamentos = lancSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  const repayments = movSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.tipo === 'entrada_conta_aluno' && !m.vendaId && !m.pedidoId)
    .sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  // Pendência cancelada não é dívida em aberto - não pode "consumir" um pagamento posterior.
  const remaining = new Map(lancamentos.map(l => [l.id, l.status === 'cancelado' ? 0 : cents(l.totalCentavos)]));
  const allocationsByMovId = new Map();
  const FIFO_SUBTIPOS = new Set(['regularizacao_saldo_secretaria', 'credito_secretaria']);
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
    } else if (FIFO_SUBTIPOS.has(m.subtipo)) {
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
  // (checkout ou presencial) que pode estar quitando pendência.
  const ledgerAlunoIds = new Set();
  for (const l of lancamentosInWindow) if (l.alunoId) ledgerAlunoIds.add(String(l.alunoId));
  for (const m of standaloneRepayments) if (m.alunoId && (m.subtipo === 'pagamento_checkout_infinitepay' || m.subtipo === 'regularizacao_saldo_secretaria' || m.subtipo === 'credito_secretaria')) ledgerAlunoIds.add(String(m.alunoId));
  const ledgerByAluno = new Map();
  for (const alunoId of ledgerAlunoIds) ledgerByAluno.set(alunoId, await simulateAlunoLedger(db, alunoId));

  const vendas = [];
  const itens = [];
  const pagamentos = [];
  const alocacoes = [];
  const movimentacoesConta = [];
  const estornos = [];
  let itemSeq = 0;
  const seenPagamentoIds = new Set();
  const pagamentoAllocCentavos = new Map();
  const pagamentoRemanescenteCentavos = new Map();
  const vendaAllocCentavos = new Map();

  function pushPagamento(row) {
    if (seenPagamentoIds.has(row.pagamento_id)) return;
    seenPagamentoIds.add(row.pagamento_id);
    pagamentos.push(row);
  }
  function pushAlocacao(pagamentoId, vendaId, valorCentavos) {
    if (!(valorCentavos > 0)) return;
    alocacoes.push({ pagamento_id: pagamentoId, venda_id: vendaId, valor_alocado: reais(valorCentavos) });
    pagamentoAllocCentavos.set(pagamentoId, (pagamentoAllocCentavos.get(pagamentoId) || 0) + valorCentavos);
    vendaAllocCentavos.set(vendaId, (vendaAllocCentavos.get(vendaId) || 0) + valorCentavos);
  }
  function pushMovimentacao(entry, pagamentoId, valorCentavos) {
    if (!(valorCentavos > 0)) return;
    movimentacoesConta.push(entry);
    if (pagamentoId) pagamentoRemanescenteCentavos.set(pagamentoId, (pagamentoRemanescenteCentavos.get(pagamentoId) || 0) + valorCentavos);
  }

  // --- 1) vendas (secretaria presencial + venda_online_secretaria) ---
  for (const v of vendasDocs) {
    const vendaId = v.id;
    const statusVenda = mapStatusVenda(v.status);
    const checkout = v.orderNsu ? checkoutMap.get(String(v.orderNsu)) : null;
    const infinitePayDoc = v.orderNsu ? pagamentoInfinitePayMap.get(String(v.orderNsu)) : null;
    const dataHora = toSaoPauloIso(v.criadoEm);
    const aluno = alunoInfo(v.alunoId, v.alunoNome, v.turma);

    for (const line of (Array.isArray(v.itens) ? v.itens : [])) {
      const { categoria, subcategoria } = resolveLineCategoria(line, categoryMap, legacyToCatalog);
      const evento = eventoInfo(line, itemMap);
      const qtd = Number(line.quantidade || 1);
      const valores = resolveLineValores(line, qtd);
      itens.push({
        item_id: `${vendaId}__item${itemSeq++}`,
        venda_id: vendaId,
        produto_id: resolveLineProdutoId(line, legacyToCatalog),
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
      });
    }
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
    const statusPagto = statusVenda === 'cancelada' ? 'estornado' : 'pago';

    if (Array.isArray(v.pagamentos) && v.pagamentos.length && Array.isArray(v.pagamentosIds)) {
      v.pagamentos.forEach((p, i) => {
        const id = v.pagamentosIds[i] || `${vendaId}__pag${i}`;
        pushPagamento(buildPresencialPagamentoRow(p, id, dataHora, statusPagto, aluno));
        pushAlocacao(id, vendaId, cents(p.valorAplicadoCentavos));
      });
    } else if (isConfirmedInfinitePay(infinitePayDoc)) {
      pushPagamento(buildInfinitePayPagamentoRow(infinitePayDoc, toSaoPauloIso(infinitePayDoc.confirmadoEm || infinitePayDoc.criadoEm), statusPagto, aluno));
      pushAlocacao(infinitePayDoc.id, vendaId, cents(infinitePayDoc.amountCentavos != null ? infinitePayDoc.amountCentavos : totalComRegularizacao));
    }

    const estorno = buildEstornoFromVenda(v, vendaId);
    if (estorno) estornos.push(estorno);

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
      competencia_referencia: singleCompetencia(v.itens)
    });
  }

  // --- 2) pendências lançadas na conta do aluno (lancamentos_manuais) ---
  // Nasce sempre como 'a_receber' (ou 'cancelada'): nunca confia em l.statusPagamento, que só
  // é mantido pelo caminho de quitação via link InfinitePay e fica desatualizado para
  // quitação presencial. Só sobe para 'concluida' em (3), quando um pagamento é de fato
  // alocado cobrindo o valor.
  const vendaByLancamentoId = new Map();
  function pushLancamentoVenda(l) {
    if (vendaByLancamentoId.has(l.id)) return vendaByLancamentoId.get(l.id);
    const vendaId = lancamentoVendaId(l.id);
    const aluno = alunoInfo(l.alunoId, l.alunoNome, l.turma);
    const { categoria, subcategoria } = resolveLineCategoria({ categoriaId: l.categoriaId }, categoryMap, legacyToCatalog);
    const qtd = Number(l.quantidade || 1);
    const valores = resolveLineValores(l, qtd);
    const dataHora = l.dataOperacao || toSaoPauloIso(l.criadoEm);
    const statusVenda = l.status === 'cancelado' ? 'cancelada' : 'a_receber';
    const venda = {
      venda_id: vendaId,
      data_hora_venda: dataHora,
      status_venda: statusVenda,
      canal: 'secretaria',
      aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
      responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
      operador_id: l.registradoPorId || null,
      operador_nome: l.registradoPorNome || null,
      valor_bruto: valores.valor_liquido, desconto: null, valor_liquido: valores.valor_liquido,
      observacao: 'Lançamento retroativo: venda que aconteceu fora do sistema e foi registrada depois na conta do aluno (fica a_receber até o pagamento ser alocado a ela).',
      competencia_referencia: null
    };
    vendas.push(venda);
    itens.push({
      item_id: `${vendaId}__item0`, venda_id: vendaId,
      produto_id: resolveLineProdutoId({ itemCatalogoId: l.itemCatalogoId }, legacyToCatalog),
      produto_nome: l.descricao || null, categoria, subcategoria,
      projeto_evento_id: null, projeto_evento_nome: null, quantidade: qtd,
      valor_unitario: valores.valor_unitario, valor_bruto: valores.valor_bruto, desconto: null, valor_liquido: valores.valor_liquido
    });
    vendaByLancamentoId.set(l.id, venda);
    return venda;
  }
  for (const l of lancamentosInWindow) pushLancamentoVenda(l);

  // --- 3) pagamentos de conta (sem vendaId/pedidoId): alocados contra as pendências que
  //        quitam. O que sobra sem pendência para explicar vira movimentacao_conta (crédito),
  //        nunca uma venda nova. ---
  for (const m of standaloneRepayments) {
    const dataHora = toSaoPauloIso(m.criadoEm);
    const aluno = alunoInfo(m.alunoId, m.alunoNome, m.turma);
    const ledger = ledgerByAluno.get(String(m.alunoId));
    const allocInfo = ledger?.allocationsByMovId.get(m.id);
    const infinitePayDoc = m.orderNsu ? pagamentoInfinitePayMap.get(String(m.orderNsu)) : null;
    const isCheckout = isConfirmedInfinitePay(infinitePayDoc);
    const presencialPayments = Array.isArray(m.pagamentos) && m.pagamentos.length ? m.pagamentos : null;
    const totalCentavosMov = cents(m.valorCentavos);
    const allocs = allocInfo?.allocs || [];
    const remainder = allocInfo ? allocInfo.remainder : totalCentavosMov;

    // Linhas de pagamento REAIS deste movimento - uma por meio efetivamente usado, nunca
    // duplicadas por pendência quitada (isso é papel das alocações).
    const rows = [];
    if (isCheckout) {
      const row = buildInfinitePayPagamentoRow(infinitePayDoc, toSaoPauloIso(infinitePayDoc.confirmadoEm || infinitePayDoc.criadoEm) || dataHora, 'pago', aluno);
      pushPagamento(row);
      rows.push({ id: row.pagamento_id, aplicadoCentavos: totalCentavosMov || row._valorCobradoClienteCentavos || 0 });
    } else if (presencialPayments) {
      presencialPayments.forEach((p, i) => {
        const id = `${m.id}__pag${i}`;
        const row = buildPresencialPagamentoRow(p, id, dataHora, 'pago', aluno);
        pushPagamento(row);
        rows.push({ id, aplicadoCentavos: cents(p.valorAplicadoCentavos) });
      });
    }
    const somaAplicado = rows.reduce((s, r) => s + r.aplicadoCentavos, 0);

    for (const a of allocs) {
      let venda = vendaByLancamentoId.get(a.lancamentoId);
      if (!venda) {
        const l = ledger.lancamentos.find(x => x.id === a.lancamentoId);
        if (!l) continue; // não deveria acontecer: todo id em allocs vem de ledger.lancamentos
        venda = pushLancamentoVenda(l);
      }
      let distribuido = 0;
      rows.forEach((r, idx) => {
        const fracao = somaAplicado > 0 ? r.aplicadoCentavos / somaAplicado : (idx === 0 ? 1 : 0);
        const valor = idx === rows.length - 1 ? (a.valor - distribuido) : Math.round(a.valor * fracao);
        distribuido += valor;
        pushAlocacao(r.id, venda.venda_id, valor);
      });
      if (venda.status_venda !== 'cancelada') {
        const somaAlocada = vendaAllocCentavos.get(venda.venda_id) || 0;
        const vendaValorCentavos = Math.round((venda.valor_liquido || 0) * 100);
        if (somaAlocada > 0 && Math.abs(somaAlocada - vendaValorCentavos) <= 1) venda.status_venda = 'concluida';
      }
    }

    if (remainder > 0) {
      if (!rows.length) {
        warnings.push(`movimento ${m.id} (aluno ${m.alunoId || '?'}): valor de ${reais(remainder)} sem pendência aberta para associar e sem meio de pagamento identificado - revisar manualmente.`);
        continue;
      }
      let descricaoRegularizacao = null;
      if (m.subtipo === 'regularizacao_saldo_secretaria') {
        const breakdownItems = await resumoHelpers.debtCompositionItems(db, m.alunoId, m.criadoEm, remainder, categoryMap);
        const explicado = breakdownItems.reduce((s, x) => s + cents(x.valorCentavos), 0);
        const faltante = remainder - explicado;
        const partes = breakdownItems.map(b => `${b.nome || b.categoria || 'item'} (R$ ${(reais(b.valorCentavos) || 0).toFixed(2)})`);
        if (faltante > 0) partes.push(`origem não identificada no histórico (R$ ${(reais(faltante) || 0).toFixed(2)})`);
        descricaoRegularizacao = partes.length ? `Composição provável: ${partes.join('; ')}.` : null;
      }
      let distribuido = 0;
      rows.forEach((r, idx) => {
        const fracao = somaAplicado > 0 ? r.aplicadoCentavos / somaAplicado : (idx === 0 ? 1 : 0);
        const valor = idx === rows.length - 1 ? (remainder - distribuido) : Math.round(remainder * fracao);
        distribuido += valor;
        if (!(valor > 0)) return;
        const observacaoBase = m.subtipo === 'regularizacao_saldo_secretaria' || m.subtipo === 'credito_secretaria'
          ? 'Valor recebido sem pendência formal em aberto para associar nesta janela - crédito na conta do aluno, não é venda.'
          : (m.observacao || null);
        pushMovimentacao({
          movimentacao_id: rows.length > 1 ? `mov_${m.id}__${r.id}` : `mov_${m.id}`,
          data_hora: dataHora,
          tipo: 'credito',
          aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
          responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
          valor: reais(valor),
          pagamento_id: r.id,
          operador_id: m.usuarioId || null,
          operador_nome: m.usuarioNome || null,
          origem: m.subtipo || null,
          observacao: [observacaoBase, descricaoRegularizacao].filter(Boolean).join(' ') || null
        }, r.id, valor);
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
    for (const dia of (Array.isArray(p.dias) ? p.dias : [])) {
      for (const it of (Array.isArray(dia.itens) ? dia.itens : [])) {
        const { categoria, subcategoria } = resolveLineCategoria(it, categoryMap, legacyToCatalog);
        const produto = productMap.get(String(it.produtoId || ''));
        const qtd = Number(it.quantidade || 1);
        const valores = resolveLineValores(it, qtd);
        itens.push({
          item_id: `${vendaId}__item${itemSeq++}`, venda_id: vendaId, produto_id: resolveLineProdutoId(it, legacyToCatalog),
          produto_nome: produto?.nome || lineName(it), categoria, subcategoria,
          projeto_evento_id: null, projeto_evento_nome: null, quantidade: qtd,
          valor_unitario: valores.valor_unitario, valor_bruto: valores.valor_bruto, desconto: null, valor_liquido: valores.valor_liquido
        });
      }
    }
    const checkout = p.orderNsu ? checkoutMap.get(String(p.orderNsu)) : null;
    const infinitePayDoc = p.orderNsu ? pagamentoInfinitePayMap.get(String(p.orderNsu)) : null;
    if (isConfirmedInfinitePay(infinitePayDoc)) {
      const statusPagto = statusVenda === 'cancelada' ? 'estornado' : 'pago';
      pushPagamento(buildInfinitePayPagamentoRow(infinitePayDoc, toSaoPauloIso(infinitePayDoc.confirmadoEm || infinitePayDoc.criadoEm), statusPagto, aluno));
      pushAlocacao(infinitePayDoc.id, vendaId, cents(infinitePayDoc.amountCentavos != null ? infinitePayDoc.amountCentavos : p.totalCentavos));
    }
    vendas.push({
      venda_id: vendaId, data_hora_venda: dataHora, status_venda: statusVenda,
      canal: deriveCanal({ origem: p.origem, orderNsu: p.orderNsu, actorPerfil: p.criadoPorPerfil }),
      aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
      responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
      operador_id: p.criadoPorId || checkout?.criadoPorId || null, operador_nome: p.criadoPorNome || checkout?.criadoPorNome || null,
      valor_bruto: reais(p.totalCentavos), desconto: null, valor_liquido: reais(p.totalCentavos),
      observacao: p.observacao || null, competencia_referencia: null
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
    itens.push({
      item_id: `${vendaId}__item0`, venda_id: vendaId, produto_id: p.modeloFardaId || null,
      produto_nome: lineName(p), categoria: 'Farda', subcategoria: null,
      projeto_evento_id: null, projeto_evento_nome: null, quantidade: qtd,
      valor_unitario: valores.valor_unitario, valor_bruto: valores.valor_bruto, desconto: null, valor_liquido: valores.valor_liquido
    });
    const checkout = p.orderNsu ? checkoutMap.get(String(p.orderNsu)) : null;
    const infinitePayDoc = p.orderNsu ? pagamentoInfinitePayMap.get(String(p.orderNsu)) : null;
    if (isConfirmedInfinitePay(infinitePayDoc)) {
      const statusPagto = statusVenda === 'cancelada' ? 'estornado' : 'pago';
      pushPagamento(buildInfinitePayPagamentoRow(infinitePayDoc, toSaoPauloIso(infinitePayDoc.confirmadoEm || infinitePayDoc.criadoEm), statusPagto, aluno));
      pushAlocacao(infinitePayDoc.id, vendaId, cents(infinitePayDoc.amountCentavos != null ? infinitePayDoc.amountCentavos : p.totalCentavos));
    }
    vendas.push({
      venda_id: vendaId, data_hora_venda: dataHora, status_venda: statusVenda,
      canal: deriveCanal({ origem: p.origem, orderNsu: p.orderNsu, actorPerfil: p.criadoPorPerfil }),
      aluno_id: aluno.aluno_id, aluno_nome: aluno.aluno_nome, turma: aluno.turma,
      responsavel_id: aluno.responsavel_id, responsavel_nome: aluno.responsavel_nome,
      operador_id: p.criadoPorId || checkout?.criadoPorId || null, operador_nome: p.criadoPorNome || checkout?.criadoPorNome || null,
      valor_bruto: reais(p.totalCentavos), desconto: null, valor_liquido: reais(p.totalCentavos),
      observacao: null, competencia_referencia: null
    });
  }

  // --- finaliza os valores de pagamento, agora que já se sabe quanto cada pagamento alocou
  //     a vendas (valor_venda) e quanto sobrou como crédito de conta (não é venda nem acréscimo). ---
  for (const row of pagamentos) {
    const allocCent = pagamentoAllocCentavos.get(row.pagamento_id) || 0;
    const remCent = pagamentoRemanescenteCentavos.get(row.pagamento_id) || 0;
    const cobradoCent = row._valorCobradoClienteCentavos;
    row.valor_venda = reais(allocCent);
    row.valor_cobrado_cliente = cobradoCent != null ? reais(cobradoCent) : null;
    row.acrescimo_financeiro = cobradoCent != null ? reais(Math.max(0, cobradoCent - allocCent - remCent)) : null;
    row.taxa_provedor = null; // o sistema não captura separadamente o que o adquirente retém
    row.valor_liquido_recebido = row._valorLiquidoRecebidoCentavos != null ? reais(row._valorLiquidoRecebidoCentavos) : null;
    delete row._valorCobradoClienteCentavos;
    delete row._valorLiquidoRecebidoCentavos;
    delete row._valorAplicadoCentavos;
  }

  // --- filtros opcionais ---
  let vendaIdsFiltradas = null;
  let filteredVendas = vendas;
  if (status) filteredVendas = filteredVendas.filter(v => v.status_venda === status);
  if (meioPagamento) {
    const vendaIdsComMeio = new Set(
      alocacoes.filter(a => {
        const pag = pagamentos.find(p => p.pagamento_id === a.pagamento_id);
        return pag && pag.meio_pagamento === meioPagamento;
      }).map(a => a.venda_id)
    );
    filteredVendas = filteredVendas.filter(v => vendaIdsComMeio.has(v.venda_id));
  }
  filteredVendas.sort((a, b) => String(a.data_hora_venda || '').localeCompare(String(b.data_hora_venda || '')));
  if (status || meioPagamento) vendaIdsFiltradas = new Set(filteredVendas.map(v => v.venda_id));
  const filteredItens = vendaIdsFiltradas ? itens.filter(i => vendaIdsFiltradas.has(i.venda_id)) : itens;
  const filteredEstornos = vendaIdsFiltradas ? estornos.filter(e => vendaIdsFiltradas.has(e.venda_id)) : estornos;

  // --- validações (não bloqueiam a exportação; entram no relatório para auditoria) ---
  const itensPorVenda = new Map();
  for (const i of filteredItens) itensPorVenda.set(i.venda_id, (itensPorVenda.get(i.venda_id) || 0) + (i.valor_liquido || 0));
  for (const v of filteredVendas) {
    const somaItens = itensPorVenda.get(v.venda_id) || 0;
    if (Math.abs(somaItens - (v.valor_liquido || 0)) > 0.01) {
      warnings.push(`venda ${v.venda_id}: soma dos itens (${somaItens.toFixed(2)}) difere do valor líquido da venda (${(v.valor_liquido || 0).toFixed(2)}).`);
    }
    // "a_receber" pode legitimamente não ter alocação ainda - só vendas concluídas (pagas)
    // precisam fechar o valor em alocações de pagamento.
    if (v.status_venda === 'concluida') {
      const somaAlocada = reais(vendaAllocCentavos.get(v.venda_id) || 0) || 0;
      if (Math.abs(somaAlocada - (v.valor_liquido || 0)) > 0.01) {
        warnings.push(`venda ${v.venda_id}: soma das alocações de pagamento (${somaAlocada.toFixed(2)}) difere do valor líquido da venda (${(v.valor_liquido || 0).toFixed(2)}).`);
      }
    }
  }

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    gerado_em: toSaoPauloIso(new Date().toISOString()),
    vendas: filteredVendas,
    itens: filteredItens,
    pagamentos,
    alocacoes,
    movimentacoes_conta: movimentacoesConta,
    estornos: filteredEstornos,
    warnings
  };
}

function singleCompetencia(itens) {
  const vals = new Set((Array.isArray(itens) ? itens : []).map(x => validCompetencia(x?.metadados?.competencia)).filter(Boolean));
  return vals.size === 1 ? [...vals][0] : null;
}

module.exports = { buildFinancialExport, toSaoPauloIso, reais };
