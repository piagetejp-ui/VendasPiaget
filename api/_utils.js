const admin = require('firebase-admin');

const INFINITE_LINKS_URL = 'https://api.checkout.infinitepay.io/links';
const INFINITE_PAYMENT_CHECK_URL = 'https://api.checkout.infinitepay.io/payment_check';

function initFirebase(){
  if(admin.apps.length) return admin.firestore();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if(!projectId || !clientEmail || !privateKey){
    throw new Error('Variáveis Firebase ausentes na Vercel. Confira FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.');
  }
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  return admin.firestore();
}

function json(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function parseBody(req){
  if(typeof req.body === 'object' && req.body !== null) return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function nowIso(){ return new Date().toISOString(); }
function dateKey(d=new Date()){
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function cents(v){ return Math.round(Number(v || 0)); }
function brl(c){ return `R$ ${(cents(c)/100).toFixed(2).replace('.', ',')}`; }
function normalizeHandle(){ return String(process.env.INFINITEPAY_HANDLE || 'piaget').trim().replace(/^\$/,''); }
function getBaseUrl(req){ return String(process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`).replace(/\/$/,''); }
function makeOrderNsu(tipo='CONTA'){
  const d=new Date(), p=n=>String(n).padStart(2,'0');
  const stamp=`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand=Math.floor(Math.random()*9000+1000);
  return `PIAGET-${tipo}-${stamp}-${rand}`;
}
function normalizePhone(input){
  const digits=String(input||'').replace(/\D/g,'');
  if(!digits) return '';
  if(digits.startsWith('55')) return `+${digits}`;
  return `+55${digits}`;
}
function normalizeEmail(input){ return String(input||'').trim().toLowerCase(); }
function extractCheckoutUrl(data){
  return data.checkout_url || data.checkoutUrl || data.url || data.link || data.payment_url || data.paymentUrl || data.redirect_url ||
    (data.data && (data.data.checkout_url || data.data.checkoutUrl || data.data.url || data.data.link || data.data.payment_url || data.data.paymentUrl));
}
function accountNet(acc={}){
  if(typeof acc.saldoContaCentavos === 'number') return cents(acc.saldoContaCentavos);
  return cents(acc.saldoCreditoCentavos) - cents(acc.dividaCentavos);
}
function splitNet(net){
  net = cents(net);
  return {
    saldoCreditoCentavos: Math.max(0, net),
    dividaCentavos: Math.max(0, -net),
    saldoContaCentavos: net
  };
}
function actorFromBody(body={}){
  return {
    id: body.criadoPorId || body.usuarioId || 'portal_responsavel',
    nome: body.criadoPorNome || body.usuarioNome || 'Responsável',
    perfil: body.criadoPorPerfil || body.usuarioPerfil || 'responsavel'
  };
}
async function safeAdd(collectionRef, data){
  try { return await collectionRef.add(data); } catch(e){ console.warn('safeAdd failed:', e.message); return null; }
}
async function safeSet(docRef, data, options={merge:true}){
  try { await docRef.set(data, options); } catch(e){ console.warn('safeSet failed:', e.message); }
}
async function audit(db, action, data={}){
  const now=nowIso();
  const titleMap={
    checkout_link_gerado:'Link de pagamento gerado',
    checkout_pagamento_confirmado:'Pagamento confirmado pela InfinitePay',
    pagamento_presencial_conta_aluno:'Pagamento presencial registrado',
    bloqueio_semanal_saldo:'Bloqueio semanal aplicado'
  };
  await safeAdd(db.collection('historico_auditoria'), {
    acao: action,
    acaoTecnica: action,
    dados: data,
    tituloHumano: titleMap[action] || action,
    descricaoHumana: data.descricaoHumana || data.descricao || '',
    categoria: 'Pagamentos e conta do aluno',
    severidade: data.severidade || 'info',
    icone: data.icone || '💳',
    usuarioId: data.usuarioId || data.criadoPorId || 'sistema_checkout',
    usuarioNome: data.usuarioNome || data.criadoPorNome || 'Sistema de pagamento',
    usuarioPerfil: data.usuarioPerfil || data.criadoPorPerfil || 'sistema',
    alunoId: data.alunoId || null,
    pagamentoId: data.pagamentoId || data.orderNsu || null,
    criadoEm: now,
    versao: '1.4.1-checkout'
  });
}
async function notify(db, payload={}){
  const now=nowIso();
  await safeAdd(db.collection('notificacoes'), {
    tipo: payload.tipo || 'checkout_evento',
    titulo: payload.titulo || 'Atualização de pagamento',
    mensagem: payload.mensagem || '',
    prioridade: payload.prioridade || 'normal',
    status: payload.status || 'pendente',
    destinatariosPerfis: payload.destinatariosPerfis || ['admin','gestao','secretaria'],
    destinatariosUsuarios: payload.destinatariosUsuarios || [],
    alunoId: payload.alunoId || null,
    alunoNome: payload.alunoNome || null,
    matricula: payload.matricula || null,
    pagamentoId: payload.pagamentoId || null,
    acaoPrincipal: payload.acaoPrincipal || 'abrir_cobrancas',
    acaoLabel: payload.acaoLabel || 'Ver pagamentos',
    criadoEm: now,
    atualizadoEm: now,
    criadoPorNome: payload.criadoPorNome || 'Sistema de pagamento'
  });
}
async function getStudent(db, alunoId){
  if(!alunoId) return null;
  const snap = await db.collection('alunos').doc(alunoId).get();
  return snap.exists ? { id:snap.id, ...snap.data() } : null;
}
async function getAccount(db, alunoId){
  const snap = await db.collection('contas_alunos').doc(alunoId).get();
  const base = snap.exists ? { id:snap.id, ...snap.data() } : { alunoId, saldoCreditoCentavos:0, dividaCentavos:0, limiteFiadoCentavos:0, bloqueioManual:false, bloqueadoPorLimite:false, bloqueioSaldoSemanal:false };
  base.saldoContaCentavos = accountNet(base);
  return base;
}
async function getConfig(db){
  const snap = await db.collection('configuracoes').doc('sistema').get();
  const cfg = snap.exists ? snap.data() : {};
  return {
    limiteMaximoFiadoCentavos: 5000,
    valorMinimoCheckoutPositivoCentavos: 100,
    permitirMultiplosLinksPendentes: true,
    bloqueioSemanalSaldoAtivo: true,
    diaBloqueioSemanalSaldo: 'sexta',
    ...cfg
  };
}
function normalizePaymentType(t){
  const s=String(t||'').trim().toLowerCase();
  if(['entrada_conta_aluno','conta_aluno','adicionar_credito','quitar_divida','regularizar_saldo'].includes(s)) return 'entrada_conta_aluno';
  if(s==='teste_avulso') return 'teste_avulso';
  return s;
}
function buildCustomerFromBody(body={}, student=null){
  const input = body.comprador || body.customer || {};
  const name = String(input.nome || input.name || body.nomeComprador || student?.responsavelFinanceiro || '').trim();
  const email = normalizeEmail(input.email || body.emailComprador || '');
  const phone = normalizePhone(input.telefone || input.phone_number || input.phone || body.telefoneComprador || student?.celularResponsavel || '');
  const customer={};
  if(name) customer.name=name;
  if(email) customer.email=email;
  if(phone) customer.phone_number=phone;
  return Object.keys(customer).length ? customer : null;
}
async function buildCheckoutOperation(db, body){
  const tipo=normalizePaymentType(body.tipo || body.type);
  const actor=actorFromBody(body);
  const now=nowIso();
  if(tipo === 'teste_avulso'){
    const total=Math.max(100, cents(body.valorCentavos || 100));
    return { tipo, actor, totalCentavos:total, minimoCentavos:100, descricao:'Teste checkout Escola Piaget', alunoId:null, alunoNome:null, itensCheckout:[{quantity:1, price:total, description:'Teste checkout Escola Piaget'}], customer:null, payload:{}, criadoEm:now };
  }
  if(tipo !== 'entrada_conta_aluno') throw new Error('Nesta versão, o checkout ativo é apenas para entrada na conta do aluno.');
  const aluno=await getStudent(db, body.alunoId);
  if(!aluno) throw new Error('Aluno não encontrado para gerar o checkout.');
  const acc=await getAccount(db, aluno.id);
  const cfg=await getConfig(db);
  const saldoAtual=accountNet(acc);
  const minimo = saldoAtual < 0 ? Math.abs(saldoAtual) : Math.max(100, cents(cfg.valorMinimoCheckoutPositivoCentavos || 100));
  const total=cents(body.valorCentavos || body.amount || body.totalCentavos);
  if(total <= 0) throw new Error('Informe um valor válido para o pagamento.');
  if(total < minimo){
    const msg = saldoAtual < 0
      ? `O valor mínimo para regularizar este saldo é ${brl(minimo)}.`
      : `O valor mínimo para adicionar crédito é ${brl(minimo)}.`;
    const err = new Error(msg); err.status = 400; throw err;
  }
  const descricao = saldoAtual < 0 ? `Regularização de saldo - ${aluno.nome}` : `Crédito cantina - ${aluno.nome}`;
  const customer=buildCustomerFromBody(body, aluno);
  if(body.salvarComprador && customer){
    await safeSet(db.collection('dados_pagamento_responsavel').doc(aluno.id), {
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      matricula: aluno.matricula || null,
      customer,
      atualizadoEm: now,
      atualizadoPorId: actor.id,
      atualizadoPorNome: actor.nome,
      atualizadoPorPerfil: actor.perfil
    });
  }
  return {
    tipo, actor, totalCentavos:total, minimoCentavos:minimo, descricao,
    alunoId:aluno.id, alunoNome:aluno.nome, turma:aluno.turma || null, matricula:aluno.matricula || null,
    responsavelFinanceiro:aluno.responsavelFinanceiro || null,
    saldoNoMomentoCentavos:saldoAtual,
    saldoEmAbertoNoMomentoCentavos:Math.max(0,-saldoAtual),
    itensCheckout:[{quantity:1, price:total, description:descricao}],
    customer,
    payload:{ saldoNoMomentoCentavos:saldoAtual, minimoCentavos:minimo },
    criadoEm:now
  };
}
async function createCheckoutLink(db, req, op){
  const handle=normalizeHandle();
  const baseUrl=getBaseUrl(req);
  const orderNsu=makeOrderNsu(op.tipo === 'entrada_conta_aluno' ? 'CONTA' : 'TESTE');
  const redirectUrl=`${baseUrl}/obrigado.html`;
  const webhookUrl=`${baseUrl}/api/webhook-infinitepay`;
  const payload={ handle, order_nsu:orderNsu, redirect_url:redirectUrl, webhook_url:webhookUrl, items:op.itensCheckout };
  if(op.customer) payload.customer=op.customer;
  const checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu);
  await checkoutRef.set({
    id: orderNsu,
    orderNsu,
    handle,
    tipo: op.tipo,
    alunoId: op.alunoId || null,
    alunoNome: op.alunoNome || null,
    turma: op.turma || null,
    matricula: op.matricula || null,
    descricao: op.descricao,
    totalCentavos: op.totalCentavos,
    minimoCentavos: op.minimoCentavos || 0,
    saldoNoMomentoCentavos: op.saldoNoMomentoCentavos || 0,
    saldoEmAbertoNoMomentoCentavos: op.saldoEmAbertoNoMomentoCentavos || 0,
    status: 'aguardando_pagamento',
    statusAplicacao: 'pendente',
    payloadOperacional: op.payload || {},
    itensCheckout: op.itensCheckout,
    customer: op.customer || null,
    redirectUrl,
    webhookUrl,
    origem: 'checkout_infinitepay',
    criadoPorId: op.actor.id,
    criadoPorNome: op.actor.nome,
    criadoPorPerfil: op.actor.perfil,
    criadoEm: nowIso(),
    atualizadoEm: nowIso()
  }, { merge:false });
  const response=await fetch(INFINITE_LINKS_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const text=await response.text();
  let data={}; try{ data=JSON.parse(text); }catch{ data={raw:text}; }
  if(!response.ok){
    await checkoutRef.set({ status:'erro_gerar_link', erroInfinitePay:data, atualizadoEm:nowIso() }, { merge:true });
    const err=Object.assign(new Error('A InfinitePay não conseguiu gerar o link.'), { status:502, details:data });
    throw err;
  }
  const url=extractCheckoutUrl(data);
  if(!url){
    await checkoutRef.set({ status:'erro_sem_url', respostaCriacaoLink:data, atualizadoEm:nowIso() }, { merge:true });
    const err=Object.assign(new Error('Resposta da InfinitePay sem URL de checkout identificável.'), { status:502, details:data });
    throw err;
  }
  await checkoutRef.set({ checkoutUrl:url, respostaCriacaoLink:data, atualizadoEm:nowIso() }, { merge:true });
  await audit(db, 'checkout_link_gerado', {
    orderNsu, alunoId:op.alunoId, alunoNome:op.alunoNome, valorCentavos:op.totalCentavos,
    criadoPorId:op.actor.id, criadoPorNome:op.actor.nome, criadoPorPerfil:op.actor.perfil,
    descricaoHumana:`${op.actor.nome} gerou link InfinitePay de ${brl(op.totalCentavos)} para ${op.alunoNome || 'teste'}.`
  });
  return { order_nsu:orderNsu, checkout_url:url, total_centavos:op.totalCentavos, tipo:op.tipo, minimo_centavos:op.minimoCentavos || 0 };
}
function isPaidResponse(data){
  if(!data || typeof data !== 'object') return false;
  const status=String(data.status || data.payment_status || data.invoice_status || '').toLowerCase();
  const paidFlag = data.paid === true || data.is_paid === true || data.approved === true;
  const paidStatus = ['paid','pago','approved','aprovado','confirmed','confirmado','captured'].includes(status);
  const hasTransaction = Boolean(data.transaction_nsu || data.transactionNsu || data.transaction_id || data.receipt_url || data.receiptUrl);
  return paidFlag || paidStatus || (hasTransaction && data.paid !== false && data.success !== false);
}
async function confirmWithInfinitePay(db, params){
  const handle=normalizeHandle();
  const orderNsu=String(params.order_nsu || params.orderNsu || '').trim();
  if(!orderNsu) throw new Error('order_nsu ausente.');
  const payload={ handle, order_nsu:orderNsu };
  if(params.transaction_nsu || params.transactionNsu) payload.transaction_nsu = params.transaction_nsu || params.transactionNsu;
  if(params.slug || params.invoice_slug || params.invoiceSlug) payload.slug = params.slug || params.invoice_slug || params.invoiceSlug;
  const response=await fetch(INFINITE_PAYMENT_CHECK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const text=await response.text();
  let data={}; try{ data=JSON.parse(text); }catch{ data={raw:text}; }
  const paid=isPaidResponse(data);
  if(paid){
    await applyCheckoutConfirmation(db, orderNsu, { ...data, transaction_nsu: params.transaction_nsu || params.transactionNsu || data.transaction_nsu || data.transactionNsu, slug: params.slug || params.invoice_slug || params.invoiceSlug || data.slug });
  }else{
    await safeSet(db.collection('pagamentos_checkout').doc(orderNsu), { ultimoPaymentCheckEm:nowIso(), ultimoPaymentCheckPayload:data, atualizadoEm:nowIso() });
  }
  return { paid, infinitepay:data };
}
async function applyAccountPaymentTx(tx, db, checkout, paymentData={}){
  const accRef=db.collection('contas_alunos').doc(checkout.alunoId);
  const snap=await tx.get(accRef);
  const acc=snap.exists?snap.data():{};
  const total=cents(checkout.totalCentavos);
  const oldNet=accountNet(acc);
  const newNet=oldNet + total;
  const split=splitNet(newNet);
  const movRef=db.collection('movimentos_conta').doc();
  tx.set(accRef, {
    ...split,
    bloqueioSaldoSemanal: newNet < 0 ? Boolean(acc.bloqueioSaldoSemanal) : false,
    bloqueadoPorLimite: newNet < 0 && cents(acc.limiteFiadoCentavos)>0 && Math.abs(newNet) >= cents(acc.limiteFiadoCentavos),
    ultimaRegularizacaoEm: newNet >= 0 ? nowIso() : (acc.ultimaRegularizacaoEm || null),
    atualizadoEm: nowIso()
  }, { merge:true });
  tx.set(movRef, {
    id: movRef.id,
    alunoId: checkout.alunoId,
    tipo: 'entrada_conta_aluno',
    subtipo: 'pagamento_checkout_infinitepay',
    valorCentavos: total,
    saldoAntesCentavos: oldNet,
    saldoDepoisCentavos: newNet,
    aplicadoSaldoEmAbertoCentavos: Math.min(Math.max(0, -oldNet), total),
    creditoGeradoCentavos: Math.max(0, newNet),
    formaPagamento: 'checkout_infinitepay',
    orderNsu: checkout.orderNsu || checkout.id,
    pagamentoCheckoutId: checkout.id,
    status: 'confirmado',
    dataChave: dateKey(),
    criadoEm: nowIso(),
    detalhesPagamento: paymentData || {}
  });
}
async function applyCheckoutConfirmation(db, orderNsu, paymentData={}){
  const checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu);
  const snap=await checkoutRef.get();
  if(!snap.exists) throw new Error('Pedido de checkout não encontrado no sistema.');
  const checkout={id:snap.id, ...snap.data(), orderNsu:snap.id};
  if(checkout.statusAplicacao === 'aplicado'){
    await checkoutRef.set({ status:'pago', ultimoWebhookPayload:paymentData, atualizadoEm:nowIso() }, { merge:true });
    return { ok:true, alreadyApplied:true };
  }
  await db.runTransaction(async tx=>{
    const fresh=await tx.get(checkoutRef);
    const c={id:fresh.id, ...fresh.data(), orderNsu:fresh.id};
    if(c.statusAplicacao === 'aplicado') return;
    if(c.tipo === 'entrada_conta_aluno') await applyAccountPaymentTx(tx, db, c, paymentData);
    const payRef=db.collection('pagamentos').doc(orderNsu);
    tx.set(payRef, {
      id: orderNsu,
      orderNsu,
      alunoId: c.alunoId || null,
      alunoNome: c.alunoNome || null,
      valorBrutoCentavos: c.totalCentavos,
      formaPagamento: 'checkout_infinitepay',
      status: 'confirmado',
      origem: 'checkout_infinitepay',
      tipo: c.tipo,
      transactionNsu: paymentData.transaction_nsu || paymentData.transactionNsu || '',
      invoiceSlug: paymentData.invoice_slug || paymentData.invoiceSlug || paymentData.slug || '',
      captureMethod: paymentData.capture_method || paymentData.captureMethod || '',
      receiptUrl: paymentData.receipt_url || paymentData.receiptUrl || '',
      paidAmountCentavos: cents(paymentData.paid_amount || paymentData.paidAmount || c.totalCentavos),
      amountCentavos: cents(paymentData.amount || c.totalCentavos),
      dataChave: dateKey(),
      criadoEm: nowIso(),
      confirmadoEm: nowIso(),
      payloadInfinitePay: paymentData
    }, { merge:true });
    tx.set(checkoutRef, {
      status:'pago',
      statusAplicacao:'aplicado',
      pagamentoConfirmadoEm:nowIso(),
      transactionNsu: paymentData.transaction_nsu || paymentData.transactionNsu || '',
      invoiceSlug: paymentData.invoice_slug || paymentData.invoiceSlug || paymentData.slug || '',
      captureMethod: paymentData.capture_method || paymentData.captureMethod || '',
      receiptUrl: paymentData.receipt_url || paymentData.receiptUrl || '',
      paidAmountCentavos: cents(paymentData.paid_amount || paymentData.paidAmount || c.totalCentavos),
      amountCentavos: cents(paymentData.amount || c.totalCentavos),
      ultimoWebhookPayload: paymentData,
      atualizadoEm: nowIso()
    }, { merge:true });
  });
  await audit(db, 'checkout_pagamento_confirmado', {
    orderNsu, pagamentoId:orderNsu, tipo:checkout.tipo, alunoId:checkout.alunoId, alunoNome:checkout.alunoNome,
    valorCentavos:checkout.totalCentavos,
    descricaoHumana:`Pagamento InfinitePay de ${brl(checkout.totalCentavos)} confirmado para ${checkout.alunoNome || 'operação avulsa'}.`
  });
  await notify(db, {
    tipo:'checkout_pagamento_confirmado',
    titulo:'Pagamento confirmado',
    mensagem:`Pagamento de ${brl(checkout.totalCentavos)} confirmado para ${checkout.alunoNome || 'operação avulsa'}.`,
    prioridade:'normal',
    alunoId:checkout.alunoId,
    alunoNome:checkout.alunoNome,
    matricula:checkout.matricula,
    pagamentoId:orderNsu,
    destinatariosPerfis:['admin','gestao','secretaria']
  });
  return { ok:true };
}

module.exports = {
  admin,
  initFirebase,
  json,
  parseBody,
  nowIso,
  buildCheckoutOperation,
  createCheckoutLink,
  confirmWithInfinitePay,
  applyCheckoutConfirmation,
  audit,
  notify,
  getConfig,
  accountNet,
  splitNet
};
