/* Fluxo público de confirmação em eventos - sem login no Meu Piaget.
   O responsável identifica a família digitando a matrícula de um dos filhos (número
   difícil de adivinhar, ao contrário de nome/turma); o servidor devolve só nome e turma
   dos irmãos (nada de CPF, saldo ou outro dado sensível) e um token de curta duração,
   assinado pelo servidor, que autoriza cobrar exatamente aqueles alunos naquele evento -
   isso evita que alguém gere cobrança para um aluno que não é da sua família.
   Não existe "inscrição" como estado próprio: confirmado = existe uma venda do item de
   catálogo deste evento para aquele aluno (gerada aqui, por venda presencial da secretaria,
   ou por link avulso que a secretaria mandar) - os três caminhos alimentam o mesmo painel. */
const { initFirebase, json, parseBody, nowIso, buildCheckoutOperation, createCheckoutLink, catalogSaleWindowAllowed, catalogTurmaAllowed, audit } = require('../server/_utils');
const { normalizeMatricula, studentsForResponsible, enforceAccessRateLimit, randomToken, tokenHash } = require('../server/_family-utils');

const TOKEN_TTL_MINUTOS = 20;

function cents(v) { const n = Number(v || 0); return Number.isFinite(n) ? Math.round(n) : 0; }

async function loadEventoAtivo(db, eventoId) {
  const id = String(eventoId || '').trim();
  if (!id) return null;
  const snap = await db.collection('catalogo_itens').doc(id).get();
  if (!snap.exists) return null;
  const item = { id: snap.id, ...snap.data() };
  if (item.tipoOperacional !== 'evento' || item.ativo === false) return null;
  return item;
}
/* Tabela por tamanho de família: faixas de 1 a 5 cadastradas pela secretaria no item do
   catálogo; faixa em branco = sem desconto configurado para aquele tamanho, então o valor
   é o preço avulso vezes a quantidade (nunca um desconto inventado). Família maior que 5
   usa a faixa "5 pessoas ou mais" quando cadastrada; sem ela, continua linear. */
function familyPriceCentavos(item, quantidade) {
  const tabela = item.precoPorQuantidadeFamilia || {};
  const qtd = Math.max(1, Math.round(quantidade));
  const chave = qtd > 5 ? 5 : qtd;
  if (tabela[chave] != null) return cents(tabela[chave]);
  return cents(item.precoCentavos) * qtd;
}
/* "Confirmado" é lido direto das vendas reais - nunca de um registro de inscrição próprio -
   para que os três caminhos de pagamento (página pública, presencial, link direcionado da
   secretaria) sempre concordem entre si. */
async function alunoJaConfirmado(db, alunoId, eventoId) {
  const [porAluno, porFamilia] = await Promise.all([
    db.collection('vendas').where('alunoId', '==', alunoId).get(),
    db.collection('vendas').where('alunosIds', 'array-contains', alunoId).get()
  ]);
  const seen = new Set();
  for (const doc of [...porAluno.docs, ...porFamilia.docs]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const v = doc.data() || {};
    if (String(v.status || '').toLowerCase().includes('cancel')) continue;
    if ((Array.isArray(v.itens) ? v.itens : []).some(it => String(it.catalogoItemId || '') === String(eventoId))) return true;
  }
  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Método não permitido.' });
  try {
    const db = initFirebase();
    const body = parseBody(req);
    const acao = String(body.acao || '');

    if (acao === 'consultar_evento') {
      const item = await loadEventoAtivo(db, body.eventoId);
      if (!item) return json(res, 404, { ok: false, error: 'Evento não encontrado ou indisponível.' });
      return json(res, 200, {
        ok: true,
        evento: {
          id: item.id,
          nome: item.nome || 'Evento',
          descricao: item.descricao || '',
          dataEvento: item.dataEvento || null,
          vendaInicio: item.vendaInicio || null,
          vendaFim: item.vendaFim || null,
          vendasAbertas: catalogSaleWindowAllowed(item),
          precoBaseCentavos: cents(item.precoCentavos),
          tabelaFamilia: item.precoPorQuantidadeFamilia || null
        }
      });
    }

    if (acao === 'buscar_familia') {
      await enforceAccessRateLimit(db, req, 'evento_busca_matricula', { limit: 20, windowMinutes: 10 });
      const matricula = normalizeMatricula(body.matricula);
      const eventoId = String(body.eventoId || '').trim();
      if (!matricula || !eventoId) return json(res, 400, { ok: false, error: 'Informe a matrícula do aluno.' });
      const item = await loadEventoAtivo(db, eventoId);
      if (!item) return json(res, 404, { ok: false, error: 'Evento não encontrado ou indisponível.' });
      if (!catalogSaleWindowAllowed(item)) return json(res, 409, { ok: false, error: 'As confirmações deste evento não estão abertas no momento.' });
      const alunoSnap = await db.collection('alunos').where('matricula', '==', matricula).limit(1).get();
      if (!alunoSnap.docs.length) return json(res, 404, { ok: false, error: 'Matrícula não encontrada. Confira o número e tente novamente.' });
      const aluno = { id: alunoSnap.docs[0].id, ...alunoSnap.docs[0].data() };
      if (aluno.ativo === false) return json(res, 404, { ok: false, error: 'Matrícula não encontrada. Confira o número e tente novamente.' });
      const responsavelId = String(aluno.responsavelFinanceiroId || aluno.contaFinanceiraId || '');
      let irmaos = [aluno];
      if (responsavelId) {
        try { const found = await studentsForResponsible(db, responsavelId); if (found.length) irmaos = found; } catch (_) { /* mantém só o próprio aluno */ }
      }
      const alunos = await Promise.all(irmaos.map(async a => ({
        id: a.id, nome: a.nome || 'Aluno', turma: a.turma || '',
        elegivel: catalogTurmaAllowed(item, a.turma, a.anoLetivo),
        confirmado: await alunoJaConfirmado(db, a.id, eventoId)
      })));
      let responsavelNome = aluno.responsavelFinanceiro || 'Responsável';
      if (responsavelId) {
        try { const rs = await db.collection('responsaveis_financeiros').doc(responsavelId).get(); if (rs.exists && rs.data()?.nome) responsavelNome = rs.data().nome; } catch (_) { /* mantém o nome do aluno */ }
      }
      // Sugere os dados do comprador já salvos (de uma compra anterior qualquer da família),
      // igual às outras telas de pagamento - o responsável só confirma, não digita tudo de novo.
      let compradorSugerido = null;
      for (const a of alunos) {
        try {
          const dp = await db.collection('dados_pagamento_responsavel').doc(a.id).get();
          if (dp.exists && dp.data()?.customer?.name) { compradorSugerido = dp.data().customer; break; }
        } catch (_) { /* segue sem sugestão */ }
      }
      const token = randomToken(24), tokenRef = db.collection('confirmacoes_evento_tokens').doc();
      const expiraEm = new Date(Date.now() + TOKEN_TTL_MINUTOS * 60000).toISOString();
      await tokenRef.set({
        id: tokenRef.id, eventoId, responsavelId: responsavelId || null,
        alunoBuscadoNome: aluno.nome || null,
        alunoIds: alunos.filter(a => a.elegivel).map(a => a.id), tokenHash: tokenHash(token),
        usado: false, criadoEm: nowIso(), expiraEm
      });
      return json(res, 200, { ok: true, tokenId: tokenRef.id, token, expiraEm, responsavelNome, alunoBuscadoNome: aluno.nome || null, alunos, compradorSugerido });
    }

    if (acao === 'gerar_cobranca') {
      await enforceAccessRateLimit(db, req, 'evento_gerar_cobranca', { limit: 15, windowMinutes: 10 });
      const tokenId = String(body.tokenId || ''), token = String(body.token || ''), eventoId = String(body.eventoId || '').trim();
      const selecionados = [...new Set((Array.isArray(body.alunoIds) ? body.alunoIds : []).map(String).filter(Boolean))];
      if (!tokenId || !token || !eventoId || !selecionados.length) return json(res, 400, { ok: false, error: 'Selecione ao menos um aluno para confirmar.' });
      const tokenRef = db.collection('confirmacoes_evento_tokens').doc(tokenId);
      const tokenSnap = await tokenRef.get();
      if (!tokenSnap.exists) return json(res, 400, { ok: false, error: 'Esta confirmação expirou. Busque novamente pela matrícula.' });
      const t = tokenSnap.data() || {};
      const tokenValido = !t.usado && String(t.eventoId || '') === eventoId && t.tokenHash === tokenHash(token) && t.expiraEm && new Date(t.expiraEm) > new Date();
      if (!tokenValido) return json(res, 400, { ok: false, error: 'Esta confirmação expirou. Busque novamente pela matrícula.' });
      const autorizados = new Set((t.alunoIds || []).map(String));
      if (!selecionados.every(id => autorizados.has(id))) return json(res, 403, { ok: false, error: 'Seleção inválida para esta confirmação.' });
      const item = await loadEventoAtivo(db, eventoId);
      if (!item || !catalogSaleWindowAllowed(item)) return json(res, 409, { ok: false, error: 'As confirmações deste evento não estão abertas no momento.' });
      const aCobrar = [];
      for (const id of selecionados) { if (!(await alunoJaConfirmado(db, id, eventoId))) aCobrar.push(id); }
      if (!aCobrar.length) return json(res, 409, { ok: false, error: 'Os alunos selecionados já estão confirmados neste evento.' });
      const totalFamiliaCentavos = familyPriceCentavos(item, aCobrar.length);
      const base = Math.floor(totalFamiliaCentavos / aCobrar.length), resto = totalFamiliaCentavos - base * aCobrar.length;
      const itens = aCobrar.map((id, i) => ({
        tipo: 'catalogo_item', catalogoItemId: eventoId, alunoId: id, quantidade: 1,
        precoUnitarioCentavos: base + (i === aCobrar.length - 1 ? resto : 0)
      }));
      await tokenRef.set({ usado: true, usadoEm: nowIso() }, { merge: true });
      const op = await buildCheckoutOperation(db, {
        tipo: 'venda_online_secretaria',
        alunoId: aCobrar[0],
        itens,
        customer: body.customer || {},
        subjectOverride: t.alunoBuscadoNome ? `Família de ${t.alunoBuscadoNome}` : undefined,
        criadoPorId: 'evento_publico', criadoPorNome: 'Página pública do evento', criadoPorPerfil: 'responsavel'
      });
      const resultado = await createCheckoutLink(db, req, op, {});
      await audit(db, 'confirmacao_evento_cobranca_gerada', {
        eventoId, eventoNome: item.nome || null, alunoIds: aCobrar, valorCentavos: totalFamiliaCentavos,
        orderNsu: resultado.order_nsu || null,
        descricaoHumana: `Cobrança de ${aCobrar.length} aluno(s) gerada pela página pública do evento "${item.nome || eventoId}".`
      });
      return json(res, 200, { ok: true, totalCentavos: totalFamiliaCentavos, checkoutUrl: resultado.checkout_url, orderNsu: resultado.order_nsu });
    }

    return json(res, 400, { ok: false, error: 'Ação inválida.' });
  } catch (e) {
    console.error('evento-publico', e);
    return json(res, e.status || 500, { ok: false, error: e.status ? e.message : 'Não foi possível concluir a operação agora.' });
  }
};
module.exports.familyPriceCentavos = familyPriceCentavos;
module.exports.alunoJaConfirmado = alunoJaConfirmado;
