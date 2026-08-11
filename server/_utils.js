const admin = require('firebase-admin');
const crypto = require('crypto');

const INFINITE_LINKS_URL = 'https://api.checkout.infinitepay.io/links';
const INFINITE_PAYMENT_CHECK_URL = 'https://api.checkout.infinitepay.io/payment_check';
const ORDER_RESERVATION_MINUTES_DEFAULT = 5;


function initFirebase(){
  if(admin.apps.length) return admin.firestore();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if(!projectId || !clientEmail || !privateKey){
    throw new Error('A configuração do servidor está incompleta. Entre em contato com o responsável técnico pelo sistema.');
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
function auditEntityKeyV221(type,id){return `${String(type||'entidade').replace(/[^a-zA-Z0-9_-]/g,'_')}__${String(id||'').replace(/[^a-zA-Z0-9_-]/g,'_')}`}
function auditEntitiesV221(data={}){
  const rows=[],push=(tipo,id)=>{id=String(id||'').trim();if(!id)return;const k=`${tipo}:${id}`;if(!rows.some(x=>x._k===k))rows.push({_k:k,tipo,id})};
  if(Array.isArray(data.entidades))for(const e of data.entidades)push(e?.tipo||e?.entidadeTipo,e?.id||e?.entidadeId);
  push('conta_familiar',data.responsavelId||data.responsavelFinanceiroId);push('aluno',data.alunoId);push('venda',data.vendaId);push('pedido',data.pedidoId);push('pagamento',data.pagamentoId||data.orderNsu);push('caixa',data.sessaoCaixaId||data.caixaId);push('estoque',data.estoqueId||data.variacaoEstoqueId);push('movimento_estoque',data.movimentoEstoqueId);push('produto',data.produtoId);push('categoria_catalogo',data.categoriaId);push('item_catalogo',data.itemId);push('fardamento',data.pedidoFardaId);push('modelo_farda',data.modeloFardaId);push('ocorrencia',data.ocorrenciaId);push('fechamento_semanal',data.fechamentoFamiliaId||data.fechamentoId);push('configuracao',data.configuracaoId);
  return rows.map(({tipo,id})=>({tipo,id}));
}
function auditSearchV221(action,data,title,category,actor,entities){return [action,title,category,actor?.nome,actor?.perfil,data?.alunoNome,data?.responsavelNome,data?.descricao,data?.referencia,data?.orderNsu,data?.vendaId,data?.pedidoId,data?.pagamentoId,...(entities||[]).flatMap(e=>[e.tipo,e.id])].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().slice(0,1800)}
async function audit(db, action, data={}){
  /* Se a operação trouxe apenas alunoId, resolve uma única vez a conta familiar afetada.
     Essa leitura pontual substitui futuras varreduras de todas as contas no dashboard. */
  if(!data.responsavelId&&!data.responsavelFinanceiroId&&data.alunoId){
    try{const st=await db.collection('alunos').doc(String(data.alunoId)).get(),sd=st.exists?(st.data()||{}):{};const rid=sd.responsavelFinanceiroId||sd.contaFinanceiraId||null;if(rid)data={...data,responsavelFinanceiroId:rid}}catch(e){console.warn('audit family resolution failed:',e.message)}
  }
  const now=nowIso();
  const titleMap={
    checkout_link_gerado:'Link de pagamento gerado',
    checkout_substituido_nova_cobranca:'Cobrança anterior substituída',
    checkout_pagamento_confirmado:'Pagamento confirmado pela InfinitePay',
    pagamento_presencial_conta_aluno:'Pagamento presencial registrado',
    bloqueio_semanal_saldo:'Bloqueio semanal aplicado',
    pedido_cantina_reservado:'Pedido da cantina reservado',
    pedido_cantina_confirmado:'Pedido da cantina confirmado',
    pedido_cantina_revisao:'Pedido da cantina enviado para revisão',
    pedido_farda_criado:'Pedido de fardamento criado',
    pedido_farda_confirmado:'Pedido de fardamento confirmado',
    venda_presencial_aluno:'Venda presencial registrada',
    venda_presencial_cancelada:'Venda presencial cancelada e estornada',
    venda_cancelada_reembolsada:'Venda cancelada e reembolso registrado',
    entrega_marcada_por_engano_revertida:'Entrega marcada por engano corrigida',
    conciliacao_manual_infinitepay:'Pagamento InfinitePay conciliado manualmente',
    venda_online_link_criado:'Venda online criada',
    venda_online_link_aberto:'Venda online aberta pelo responsável',
    venda_online_link_vencido:'Link de venda online vencido',
    venda_online_link_cancelado:'Link de venda online cancelado',
    venda_online_link_renovado:'Link de venda online renovado',
    acesso_responsavel_reativado:'Acesso do responsável reativado',
    cpf_responsavel_corrigido:'CPF do responsável corrigido',
    login_meu_piaget:'Login no Meu Piaget',
    logout_meu_piaget:'Logout do Meu Piaget',
    senha_meu_piaget_redefinida:'Senha do Meu Piaget redefinida',
    categoria_catalogo_criada:'Categoria do catálogo criada',
    categoria_catalogo_editada:'Categoria do catálogo editada',
    item_catalogo_criado:'Item do catálogo criado',
    item_catalogo_editado:'Item do catálogo editado',
    produto_ativado:'Produto ativado',
    produto_inativado:'Produto inativado',
    bloqueio_manual:'Conta bloqueada manualmente',
    desbloqueio_manual:'Bloqueio manual removido',
    lancamento_manual_aberto:'Lançamento manual em aberto registrado',
    fechamento_semanal_familiar:'Fechamento semanal familiar gerado',
    cobranca_semanal_enviada:'Cobrança semanal marcada como enviada',
    producao_farda_recebida:'Produção de fardamento recebida',
    sessoes_caixa_duplicadas_encerradas:'Sessões duplicadas de caixa encerradas',
    usuario_equipe_criado:'Usuário da equipe criado',
    usuario_equipe_atualizado:'Usuário da equipe atualizado',
    preferencias_financeiras_responsavel_atualizadas:'Preferências financeiras da família atualizadas'
  };
  const actor={id:data.usuarioId||data.criadoPorId||'sistema_checkout',nome:data.usuarioNome||data.criadoPorNome||'Sistema de pagamento',perfil:data.usuarioPerfil||data.criadoPorPerfil||'sistema'};
  const entities=auditEntitiesV221(data),primary=entities.find(e=>['venda','pedido','pagamento','conta_familiar','aluno','caixa','estoque','produto','item_catalogo','categoria_catalogo','modelo_farda','ocorrencia','fechamento_semanal'].includes(e.tipo))||entities[0]||null;
  const title=titleMap[action]||action,category=action.startsWith('pedido_cantina')?'Pedidos da cantina':action.startsWith('pedido_farda')?'Pedidos de fardamento':action.startsWith('venda_online_link_')?'Vendas online':['venda_presencial_aluno','venda_presencial_cancelada','venda_cancelada_reembolsada'].includes(action)?'Vendas da secretaria':action.includes('estoque')?'Estoque':action.includes('catalogo')?'Catálogo':action.includes('farda')?'Farda':action.includes('caixa')?'Caixa':action.includes('responsavel')||action.includes('meu_piaget')?'Responsável e acesso':action.includes('fechamento_semanal')||action.includes('cobranca')||action.includes('bloqueio_manual')?'Financeiro':'Pagamentos e conta do aluno';
  const auditRef=await safeAdd(db.collection('historico_auditoria'), {
    acao:action,acaoTecnica:action,dados:data,tituloHumano:title,descricaoHumana:data.descricaoHumana||data.descricao||'',categoria:category,severidade:data.severidade||'info',icone:data.icone||(action.startsWith('pedido_cantina')?'🍽️':action.startsWith('pedido_farda')?'👕':action==='venda_presencial_aluno'?'🧾':['venda_presencial_cancelada','venda_cancelada_reembolsada'].includes(action)?'↩️':'💳'),
    usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,alunoId:data.alunoId||null,alunoNome:data.alunoNome||null,responsavelId:data.responsavelId||data.responsavelFinanceiroId||null,responsavelNome:data.responsavelNome||data.responsavelFinanceiro||null,pagamentoId:data.pagamentoId||data.orderNsu||null,vendaId:data.vendaId||null,pedidoId:data.pedidoId||null,caixaId:data.sessaoCaixaId||data.caixaId||null,
    entidadeTipo:primary?.tipo||null,entidadeId:primary?.id||null,entidades:entities,buscaNormalizada:auditSearchV221(action,data,title,category,actor,entities),retencao:'permanente',criadoEm:now,versao:'1.6.0-rc2.7.24'
  });
  /* A trilha registra todas as entidades; a fila operacional é financeira e só contém
     contas familiares, que são consumidas pelo resumo incremental do dashboard. */
  for(const e of entities.filter(x=>x.tipo==='conta_familiar')){await safeSet(db.collection('entidades_pendentes').doc(auditEntityKeyV221(e.tipo,e.id)),{entidadeTipo:e.tipo,entidadeId:String(e.id),responsavelId:data.responsavelId||data.responsavelFinanceiroId||null,alunoId:data.alunoId||null,ultimaAcao:action,ultimaAuditoriaId:auditRef?.id||null,ultimaAlteracaoEm:now,processada:false,versao:'1.6.0-rc2.7.24'},{merge:true});}
}

function notificationPolicyV165(type){
  const matrix={
    responsavel_reset_solicitado:{perfis:['admin','gestao','secretaria'],acionavel:true},
    responsavel_reset_link_gerado:{perfis:['admin','gestao','secretaria'],acionavel:false},
    caixa_divergencia:{perfis:['admin','gestao'],acionavel:true},
    caixa_fechado:{perfis:['admin','gestao'],acionavel:false},
    retorno_cantina_pendente:{perfis:['admin','gestao','secretaria'],acionavel:true},
    aluno_limite_atingido:{perfis:['admin','gestao','secretaria'],acionavel:true},
    farda_pendente:{perfis:['admin','gestao','secretaria'],acionavel:true},
    pedido_farda_confirmado:{perfis:['admin','gestao','secretaria'],acionavel:false},
    pedido_cantina_confirmado:{perfis:['cantina','secretaria','admin','gestao'],acionavel:false},
    pedido_cantina_revisao:{perfis:['secretaria','admin','gestao'],acionavel:true},
    programacao_lanche_remarcada:{perfis:['cantina','secretaria','admin','gestao'],acionavel:false},
    programacao_lanche_cancelada:{perfis:['cantina','secretaria','admin','gestao'],acionavel:false},
    venda_online_confirmada:{perfis:['secretaria','admin','gestao'],acionavel:false},
    venda_online_revisao:{perfis:['secretaria','admin','gestao'],acionavel:true},
    checkout_pagamento_confirmado:{perfis:['secretaria','admin','gestao'],acionavel:false},
    checkout_descartado_pago_creditado:{perfis:['secretaria','admin','gestao'],acionavel:false},
    estoque_critico:{perfis:['cantina','secretaria','admin','gestao'],acionavel:true},
    alteracao_sensivel:{perfis:['admin','gestao'],acionavel:false}
  };
  return matrix[type]||{perfis:['admin','gestao'],acionavel:false};
}
async function notify(db, payload={}){
  const now=nowIso(),type=payload.tipo||'checkout_evento',policy=notificationPolicyV165(type);
  let student=null;
  if(payload.alunoId){try{student=await getStudent(db,payload.alunoId)}catch(_){student=null}}
  const actionable=typeof payload.acionavel==='boolean'?payload.acionavel:policy.acionavel;
  await safeAdd(db.collection('notificacoes'), {
    tipo:type,
    titulo:payload.titulo||'Atualização do sistema',
    mensagem:payload.mensagem||'',
    prioridade:payload.prioridade||'normal',
    status:payload.status||(actionable?'pendente':'informativa'),
    acionavel:actionable,
    destinatariosPerfis:Array.isArray(payload.destinatariosPerfis)?payload.destinatariosPerfis:policy.perfis,
    destinatariosUsuarios:Array.isArray(payload.destinatariosUsuarios)?payload.destinatariosUsuarios:[],
    destinatariosAlunos:Array.isArray(payload.destinatariosAlunos)?payload.destinatariosAlunos:[],
    alunoId:payload.alunoId||null,
    alunoNome:payload.alunoNome||student?.nome||null,
    turma:payload.turma||student?.turma||null,
    matricula:payload.matricula||student?.matricula||null,
    origem:payload.origem||payload.canal||payload.criadoPorPerfil||'sistema',
    canal:payload.canal||null,
    pagamentoId:payload.pagamentoId||null,
    pedidoId:payload.pedidoId||null,
    vendaId:payload.vendaId||null,
    caixaId:payload.caixaId||payload.sessaoCaixaId||null,
    ocorrenciaId:payload.ocorrenciaId||null,
    movimentacaoId:payload.movimentacaoId||null,
    acaoPrincipal:payload.acaoPrincipal||null,
    acaoLabel:payload.acaoLabel||null,
    criadoEm:now,
    atualizadoEm:now,
    criadoPorId:payload.criadoPorId||null,
    criadoPorNome:payload.criadoPorNome||'Sistema',
    criadoPorPerfil:payload.criadoPorPerfil||'sistema',
    lidoPor:[],
    resolvidoEm:null,
    resolvidoPorId:null,
    resolvidoPorNome:null,
    versao:'1.6.0-rc2.7.24'
  });
}
async function getStudent(db, alunoId){
  if(!alunoId) return null;
  const snap = await db.collection('alunos').doc(alunoId).get();
  return snap.exists ? { id:snap.id, ...snap.data() } : null;
}
async function accountRefForStudent(db, alunoId, student=null){
  const aluno=student||await getStudent(db,alunoId);
  const responsavelId=aluno?.contaFinanceiraId||aluno?.responsavelFinanceiroId||null;
  return responsavelId?db.collection('contas_responsaveis').doc(String(responsavelId)):db.collection('contas_alunos').doc(String(alunoId));
}
async function getAccount(db, alunoId){
  const student=await getStudent(db,alunoId);
  const ref=await accountRefForStudent(db,alunoId,student);
  const snap=await ref.get();
  const base = snap.exists ? { id:snap.id, ...snap.data() } : { alunoId, responsavelId:student?.responsavelFinanceiroId||null, saldoCreditoCentavos:0, dividaCentavos:0, limiteFiadoCentavos:0, bloqueioManual:false, bloqueadoPorLimite:false, bloqueioSaldoSemanal:false };
  base.alunoId=alunoId;
  if(student?.responsavelFinanceiroId)base.responsavelId=student.responsavelFinanceiroId;
  base.saldoContaCentavos = accountNet(base);
  return base;
}
async function findOpenCashSession(db, caixaId='', point='secretaria', shift='', actorId='', responsibilityId=''){
  let rows=[];
  if(caixaId){
    const snap=await db.collection('sessoes_caixa').doc(String(caixaId)).get();
    if(snap.exists)rows=[{id:snap.id,...(snap.data()||{})}];
  }
  if(!rows.length){
    // RC2.7.24: consulta somente sessões abertas, mas sem teto oculto de 20 registros.
    // O tamanho 100 é apenas página de transporte; se houver mais, todas as páginas são percorridas.
    const docs=await allDocsByEquality(db,'sessoes_caixa','status','aberto',100);
    rows=docs.map(d=>({id:d.id,...d.data()}));
  }
  rows=rows.filter(x=>x.status==='aberto'&&(!point||x.ponto===point)&&(!(point==='cantina'&&shift)||!x.turno||x.turno===shift));
  rows.sort((a,b)=>String(b.abertoEm||b.atualizadoEm||'').localeCompare(String(a.abertoEm||a.atualizadoEm||'')));
  const cash=rows[0]||null;if(!cash)return null;
  const responsible=String(cash.responsavelAtualId||cash.operadorId||cash.abertoPorId||'');
  if(actorId&&responsible&&responsible!==String(actorId))return null;
  if(responsibilityId&&cash.periodoAtualId&&String(cash.periodoAtualId)!==String(responsibilityId))return null;
  return cash;
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
    quantidadePadraoSalgados: 30,
    reservaPedidoMinutos: ORDER_RESERVATION_MINUTES_DEFAULT,
    diasSemAula: [],
    ...cfg
  };
}
function normalizePaymentType(t){
  const s=String(t||'').trim().toLowerCase();
  if(['entrada_conta_aluno','conta_aluno','adicionar_credito','quitar_divida','regularizar_saldo'].includes(s)) return 'entrada_conta_aluno';
  if(['pedido','pedido_cantina','cantina_pedido','compra_cantina'].includes(s)) return 'pedido_cantina';
  if(['pedido_farda','farda','compra_farda','fardamento'].includes(s)) return 'pedido_farda';
  if(['venda_online_secretaria','venda_online','secretaria_online','venda_secretaria_online'].includes(s)) return 'venda_online_secretaria';
  return s;
}
function buildCustomerFromBody(body={}, student=null){
  const input = body.comprador || body.customer || {};
  const name = String(input.nome || input.name || body.nomeComprador || '').trim();
  const email = normalizeEmail(input.email || body.emailComprador || '');
  const phone = normalizePhone(input.telefone || input.phone_number || input.phone || body.telefoneComprador || '');
  const customer={};
  if(name) customer.name=name;
  if(email) customer.email=email;
  if(phone) customer.phone_number=phone;
  return Object.keys(customer).length ? customer : null;
}

async function getSavedBuyer(db, alunoId){
  try{
    const snap=await db.collection('dados_pagamento_responsavel').doc(alunoId).get();
    return snap.exists ? (snap.data().customer||{}) : {};
  }catch(e){ return {}; }
}
function mergeCustomer(saved={}, provided=null, student=null){
  const p=provided||{};
  const customer={};
  const name=String(p.name||saved.name||student?.responsavelFinanceiro||'').trim();
  const email=normalizeEmail(p.email||saved.email||'');
  const phone=normalizePhone(p.phone_number||p.phone||saved.phone_number||saved.phone||student?.celularResponsavel||'');
  if(name)customer.name=name;
  if(email)customer.email=email;
  if(phone)customer.phone_number=phone;
  return Object.keys(customer).length?customer:null;
}
function uniformStockId(modelId,size,gender=''){
  const clean=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'unico';
  return `farda__${clean(modelId)}__${clean(size)}__${clean(gender||'unico')}`;
}
function uniformVariantPrice(doc={},model={},size=''){
  return Math.max(0,cents(doc.precoCentavos));
}
function allocateUniformRequirement(doc={},requirement={},lines=[],now=nowIso()){
  const qty=Math.max(1,cents(requirement.quantidade||1)),available=doc.configurado?Math.max(0,cents(doc.quantidadeFisica)-cents(doc.quantidadeReservada)):0;
  let reserveLeft=Math.min(available,qty),reservedNow=0,productionNow=0;
  for(const line of lines){
    if(line.tipo!=='farda')continue;
    const sid=uniformStockId(line.modeloFardaId||'camisa_padrao',line.tamanho,line.modelo||'');if(sid!==requirement.stockId)continue;
    const lq=Math.max(1,cents(line.quantidade||1)),r=Math.min(reserveLeft,lq),prod=lq-r;reserveLeft-=r;reservedNow+=r;productionNow+=prod;
    line.quantidadeReservadaEstoque=r;line.quantidadeAguardandoProducao=prod;line.statusAtendimento=prod>0?'aguardando_producao':'reservado_estoque';line.estoqueReservado=r>0;
  }
  const ordered=cents(doc.quantidadeEmProducao),committed=cents(doc.quantidadeComprometidaProducao),freeProduction=Math.max(0,ordered-committed),missing=Math.max(0,productionNow-freeProduction),addProduction=missing>0?Math.max(5,missing):0;
  return {quantidadeReservada:cents(doc.quantidadeReservada)+reservedNow,quantidadeComprometidaProducao:committed+productionNow,quantidadeEmProducao:ordered+addProduction,atualizadoEm:now};
}
async function reserveUniformOrder(db, body, actor, student, customer){
  const input=body.farda||body.uniforme||body.pedido||{},modelId=String(input.modeloId||input.modelId||'camisa_padrao').trim(),size=String(input.tamanho||input.size||'').trim().toUpperCase(),gender=String(input.genero||input.modelo||input.gender||'').trim().toLowerCase(),qty=Math.max(1,cents(input.quantidade||input.quantity||1));
  if(!size)throw Object.assign(new Error('Selecione o tamanho da farda.'),{status:400});if(qty>10)throw Object.assign(new Error('A quantidade máxima por pedido de fardamento é 10.'),{status:400});
  const [modelSnap,acc,stockSnap]=await Promise.all([db.collection('modelos_farda').doc(modelId).get(),getAccount(db,student.id),db.collection('estoques').doc(uniformStockId(modelId,size,['P','M','G','GG','XGG'].includes(size)?gender:'')).get()]);
  if(!modelSnap.exists)throw Object.assign(new Error('Fardamento não encontrado.'),{status:404});const model={id:modelSnap.id,...modelSnap.data()};if(model.ativo===false||model.portal===false)throw Object.assign(new Error('O fardamento não está disponível no portal no momento.'),{status:400});
  const adult=(model.tamanhosAdultos||['P','M','G','GG','XGG']).map(x=>String(x).toUpperCase()).includes(size),normalizedGender=adult?gender:'';if(adult&&!['masculino','feminino'].includes(normalizedGender))throw Object.assign(new Error('Selecione Masculino ou Feminino (Baby Look) para tamanhos adultos.'),{status:400});
  const stock=stockSnap.exists?stockSnap.data():{},available=stock.configurado?Math.max(0,cents(stock.quantidadeFisica)-cents(stock.quantidadeReservada)):0,unit=uniformVariantPrice(stock,model,size);if(unit<=0)throw Object.assign(new Error('Preço desta variação ainda não foi configurado.'),{status:409});
  const total=unit*qty,saldoAtual=accountNet(acc),useBalance=body.usarSaldo===true,creditUsed=useBalance?Math.min(Math.max(0,saldoAtual),total):0,debtRequired=Math.max(0,-saldoAtual),required=total-creditUsed+debtRequired,orderRef=db.collection('pedidos_farda').doc(),now=nowIso(),reservePreview=Math.min(available,qty),productionPreview=Math.max(0,qty-reservePreview);
  await orderRef.set({id:orderRef.id,tipoPedido:'farda',alunoId:student.id,alunoNome:student.nome,turma:student.turma||null,turno:student.turno||null,matricula:student.matricula||null,responsavelFinanceiro:student.responsavelFinanceiro||null,produto:model.nome||'Camisa de farda',modeloFardaId:model.id,tamanho:size,modelo:normalizedGender,quantidade:qty,precoUnitarioCentavos:unit,totalCentavos:total,usarSaldo:useBalance,valorSaldoPrevistoCentavos:creditUsed,valorRegularizacaoPrevistoCentavos:debtRequired,statusPagamento:required>0?'aguardando_pagamento':'pago_com_saldo',statusAtendimento:'aguardando_pagamento',statusAplicacao:'pendente',quantidadePrevistaReserva:reservePreview,quantidadePrevistaProducao:productionPreview,saldoNoMomentoCentavos:saldoAtual,valorCheckoutPrevistoCentavos:required,customer:customer||null,origem:actor.perfil==='responsavel'?'portal_responsavel':'operacao_interna',solicitadoVia:actor.perfil==='responsavel'?'portal_responsavel':'secretaria',criadoPor:actor.id,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'});
  await audit(db,'pedido_farda_criado',{pedidoId:orderRef.id,alunoId:student.id,alunoNome:student.nome,valorCentavos:total,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,descricaoHumana:`${actor.nome} criou um pedido de fardamento para ${student.nome}.`});
  return {pedidoId:orderRef.id,totalCentavos:total,checkoutTotal:required,saldoAtual,useBalance,creditUsed,debtRequired,model,size,gender:normalizedGender,qty,unit,estoqueDisponivel:available,quantidadePrevistaProducao:productionPreview};
}
function isValidDateKey(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v||'')); }
function isActiveReservation(r, now=Date.now()){
  return Boolean(r && new Date(r.expiraEm || 0).getTime() > now);
}
function activeReservationTotal(reservas={}, ignorePedidoId=''){
  const now=Date.now();
  return Object.entries(reservas || {}).reduce((sum,[key,r])=>{
    if(key===ignorePedidoId) return sum;
    return isActiveReservation(r,now) ? sum+cents(r.quantidade) : sum;
  },0);
}
function dailyUsed(data={}, ignorePedidoId=''){
  return cents(data.vendidoDinheiro)+cents(data.vendidoAvulso)+cents(data.consumoConta)+cents(data.pedidosConfirmados)+activeReservationTotal(data.reservas, ignorePedidoId);
}
function lunchDayDefaultActive(day){
  if(!isValidDateKey(day)) return false;
  const d=new Date(`${day}T12:00:00`);
  return ![0,6].includes(d.getDay());
}
function lunchDayInfo(day,data={},cfg={}){
  const planned=Math.max(0,cents(data.quantidadePlanejada ?? cfg.quantidadePadraoSalgados ?? 30));
  const receivedDefined=data.quantidadeRecebida!==undefined && data.quantidadeRecebida!==null && data.quantidadeRecebida!=='';
  const received=receivedDefined?Math.max(0,cents(data.quantidadeRecebida)):null;
  const capacity=receivedDefined?received:planned;
  const defaultActive=lunchDayDefaultActive(day)&&!(Array.isArray(cfg.diasSemAula)?cfg.diasSemAula:[]).includes(day);
  const active=typeof data.vendaAtiva==='boolean'?data.vendaAtiva:defaultActive;
  const used=dailyUsed(data);
  return {active,planned,received,capacity,used,available:Math.max(0,capacity-used),deficit:Math.max(0,used-capacity)};
}
function productPrice(product, map, seen=new Set()){
  if(!product) return 0;
  if(!product.combo) return cents(product.precoCentavos);
  if(seen.has(product.id)) throw new Error(`Combo circular detectado no produto ${product.nome || product.id}.`);
  const next=new Set(seen); next.add(product.id);
  return (product.componentes||[]).reduce((sum,c)=>{
    const cp=map.get(c.produtoId);
    if(!cp) throw new Error(`Componente ${c.produtoId} não encontrado no catálogo.`);
    return sum + productPrice(cp,map,next)*Math.max(1,cents(c.quantidade||1));
  },0);
}
function expandProduct(product, qty, map, target=new Map(), seen=new Set()){
  if(!product) throw new Error('Produto não encontrado.');
  const quantity=Math.max(1,cents(qty||1));
  if(!product.combo){
    const current=target.get(product.id)||{produtoId:product.id,nome:product.nome,quantidade:0,precoUnitarioCentavos:productPrice(product,map)};
    current.quantidade+=quantity;
    target.set(product.id,current);
    return target;
  }
  if(seen.has(product.id)) throw new Error(`Combo circular detectado no produto ${product.nome || product.id}.`);
  const next=new Set(seen);next.add(product.id);
  for(const component of product.componentes||[]){
    const cp=map.get(component.produtoId);
    if(!cp) throw new Error(`Componente ${component.produtoId} não encontrado no catálogo.`);
    expandProduct(cp, quantity*Math.max(1,cents(component.quantidade||1)), map, target, next);
  }
  return target;
}
let _catalogCacheV218={at:0,products:null,items:null,categories:null};
const CATALOG_CACHE_TTL_V218=60*1000;
async function allDocsById(db,collection,pageSize=250){
  const out=[];let cursor=null;
  while(true){
    let q=db.collection(collection).orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if(cursor)q=q.startAfter(cursor);
    const snap=await q.get();out.push(...snap.docs);
    if(snap.docs.length<pageSize)break;
    cursor=snap.docs[snap.docs.length-1];
  }
  return out;
}
async function allDocsByEquality(db,collection,field,value,pageSize=100){
  const out=[];let cursor=null;
  while(true){
    let q=db.collection(collection).where(field,'==',value).orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if(cursor)q=q.startAfter(cursor);
    const snap=await q.get();out.push(...snap.docs);
    if(snap.docs.length<pageSize)break;
    cursor=snap.docs[snap.docs.length-1];
  }
  return out;
}
async function loadProductMap(db){
  if(_catalogCacheV218.products&&Date.now()-_catalogCacheV218.at<CATALOG_CACHE_TTL_V218)return _catalogCacheV218.products;
  const docs=await allDocsById(db,'produtos');
  const map=new Map(docs.map(d=>[d.id,{id:d.id,...d.data()}]));_catalogCacheV218={..._catalogCacheV218,at:Date.now(),products:map};return map;
}
async function loadCatalogItemMap(db){
  if(_catalogCacheV218.items&&Date.now()-_catalogCacheV218.at<CATALOG_CACHE_TTL_V218)return _catalogCacheV218.items;
  const docs=await allDocsById(db,'catalogo_itens');
  const map=new Map(docs.map(d=>[d.id,{id:d.id,...d.data()}]));_catalogCacheV218={..._catalogCacheV218,at:Date.now(),items:map};return map;
}
async function loadCatalogCategoryMap(db){
  if(_catalogCacheV218.categories&&Date.now()-_catalogCacheV218.at<CATALOG_CACHE_TTL_V218)return _catalogCacheV218.categories;
  const docs=await allDocsById(db,'catalogo_categorias');
  const map=new Map(docs.map(d=>[d.id,{id:d.id,...d.data()}]));_catalogCacheV218={..._catalogCacheV218,at:Date.now(),categories:map};return map;
}
function catalogChannelAllowed(item,channel){
  const c=item?.canais||{};
  return channel==='online'?c.secretariaOnline!==false:c.secretariaPresencial!==false;
}
function catalogCategoryAllowed(categoryId,categoryMap){
  let current=categoryMap.get(String(categoryId||'')),guard=0;
  while(current&&guard++<10){
    if(current.ativo===false)return false;
    current=current.parentId?categoryMap.get(String(current.parentId)):null;
  }
  return true;
}
function catalogSaleWindowAllowed(item){
  if(item?.tipoOperacional!=='evento')return true;
  const today=dateKey();
  if(item.vendaInicio&&today<String(item.vendaInicio))return false;
  if(item.vendaFim&&today>String(item.vendaFim))return false;
  return true;
}
function normalizeCatalogMetadata(item,raw){
  const meta=raw.metadados&&typeof raw.metadados==='object'?raw.metadados:{};
  if(item.exigirCompetencia&&!String(meta.competencia||'').trim())throw Object.assign(new Error(`Informe a competência de ${item.nome}.`),{status:400});
  if(item.exigirReferencia&&!String(meta.referencia||'').trim())throw Object.assign(new Error(`Informe a referência de ${item.nome}.`),{status:400});
  const normalized={competencia:String(meta.competencia||'').trim(),referencia:String(meta.referencia||'').trim(),tamanho:String(meta.tamanho||raw.tamanho||'').trim(),modelo:String(meta.modelo||raw.modelo||'').trim()};
  if(item.tipoOperacional==='fardamento'){
    const allowed=[...(item.tamanhosInfantis||[]),...(item.tamanhosAdultos||[])].map(String);
    if(!normalized.tamanho)throw Object.assign(new Error(`Informe o tamanho de ${item.nome}.`),{status:400});
    if(allowed.length&&!allowed.includes(normalized.tamanho))throw Object.assign(new Error(`O tamanho informado não está disponível para ${item.nome}.`),{status:400});
  }
  return normalized;
}
function addCatalogStockRequirement(target,item,qty,mode){
  const key=String(item.id),current=target.get(key)||{itemId:key,nome:item.nome,quantidade:0,modo:mode};
  current.quantidade+=Math.max(1,cents(qty||1));
  current.modo=mode;
  target.set(key,current);
}
function expandCatalogStock(item,qty,catalogMap,target=new Map(),seen=new Set()){
  if(!item)return target;
  const quantity=Math.max(1,cents(qty||1));
  if(seen.has(item.id))throw Object.assign(new Error(`Composição circular detectada em ${item.nome||item.id}.`),{status:400});
  if(item.tipoOperacional==='evento'&&cents(item.limiteVagas)>0)addCatalogStockRequirement(target,item,quantity,'capacidade_evento');
  if(item.controleEstoque==='geral')addCatalogStockRequirement(target,item,quantity,'geral');
  if(item.tipoOperacional==='combo'||item.controleEstoque==='componentes'){
    const next=new Set(seen);next.add(item.id);
    for(const component of item.componentesCatalogo||[]){
      const child=catalogMap.get(String(component.itemId||''));
      if(!child||child.ativo===false)throw Object.assign(new Error(`Um componente do combo ${item.nome} não está disponível.`),{status:400});
      expandCatalogStock(child,quantity*Math.max(1,cents(component.quantidade||1)),catalogMap,target,next);
    }
  }
  return target;
}
function catalogAvailableUnits(doc,line){
  if(line.modo==='capacidade_evento')return Math.max(0,cents(doc.limiteVagas)-cents(doc.vagasVendidas));
  return Math.max(0,cents(doc.estoqueAtual));
}
function catalogStockUpdate(doc,line,now){
  if(line.modo==='capacidade_evento')return {vagasVendidas:cents(doc.vagasVendidas)+cents(line.quantidade),atualizadoEm:now};
  return {estoqueAtual:Math.max(0,cents(doc.estoqueAtual)-cents(line.quantidade)),atualizadoEm:now};
}
function addUniformStockRequirement(target,modelId,size,gender,qty,name='Camisa de farda'){
  const normalizedSize=String(size||'').trim().toUpperCase(),adult=['P','M','G','GG','XGG'].includes(normalizedSize),normalizedGender=adult?String(gender||'').trim().toLowerCase():'',stockId=uniformStockId(modelId||'camisa_padrao',normalizedSize,normalizedGender),current=target.get(stockId)||{stockId,modeloFardaId:modelId||'camisa_padrao',tamanho:normalizedSize,modelo:normalizedGender,nome,quantidade:0,permitirProducao:true};current.quantidade+=Math.max(1,cents(qty||1));target.set(stockId,current);return current;
}
async function uniformStockInfoNow(db,line){const snap=await db.collection('estoques').doc(line.stockId).get(),doc=snap.exists?snap.data():{},available=doc.configurado?Math.max(0,cents(doc.quantidadeFisica)-cents(doc.quantidadeReservada)):0;return {doc,available}}
function uniformStockReserveUpdate(doc,line,now){return allocateUniformRequirement(doc,line,[],now)}
async function normalizeSecretarySaleItems(db,raw=[],channel='presencial'){
  const [productMap,catalogMap,categoryMap]=await Promise.all([loadProductMap(db),loadCatalogItemMap(db),loadCatalogCategoryMap(db)]),lines=[],expanded=new Map(),catalogRequirements=new Map(),uniformRequirements=new Map();let total=0;
  for(const rawItem of raw){const item={...rawItem};
    if(item.tipo==='farda'&&!item.catalogoItemId){const qty=Math.max(1,cents(item.quantidade||1)),size=String(item.tamanho||item.metadados?.tamanho||'').trim().toUpperCase(),adult=['P','M','G','GG','XGG'].includes(size),gender=adult?String(item.modelo||item.metadados?.modelo||'').trim().toLowerCase():'',modelId=String(item.modeloFardaId||'camisa_padrao');if(!size)throw Object.assign(new Error('Selecione o tamanho da farda.'),{status:400});if(adult&&!['masculino','feminino'].includes(gender))throw Object.assign(new Error('Selecione Masculino ou Feminino (Baby Look) para tamanhos adultos.'),{status:400});const req=addUniformStockRequirement(uniformRequirements,modelId,size,gender,qty,item.nome||'Camisa de farda'),info=await uniformStockInfoNow(db,req),modelSnap=await db.collection('modelos_farda').doc(modelId).get(),unit=uniformVariantPrice(info.doc,modelSnap.exists?modelSnap.data():{},size);if(unit<=0)throw Object.assign(new Error('Preço desta variação ainda não foi configurado.'),{status:409});const line=unit*qty;total+=line;lines.push({...item,tipo:'farda',modeloFardaId:modelId,tamanho:size,modelo:gender,quantidade:qty,precoUnitarioCentavos:unit,totalCentavos:line,nome:item.nome||'Camisa de farda',permitirProducao:true,statusAtendimento:info.available>=qty?'reservado_estoque':'aguardando_producao'});continue;}
    if(item.tipo==='catalogo_item'||item.catalogoItemId){const cat=catalogMap.get(String(item.catalogoItemId||''));if(!cat||cat.ativo===false||!catalogCategoryAllowed(cat.categoriaId,categoryMap)||!catalogChannelAllowed(cat,channel))throw Object.assign(new Error('Item do catálogo inválido, inativo ou indisponível neste canal.'),{status:400});if(!catalogSaleWindowAllowed(cat))throw Object.assign(new Error(`${cat.nome} não está disponível no período atual.`),{status:409});const qty=Math.max(1,cents(item.quantidade||1));if(qty>100)throw Object.assign(new Error('Quantidade acima do limite permitido.'),{status:400});const meta=normalizeCatalogMetadata(cat,item),adultSize=(cat.tamanhosAdultos||['P','M','G','GG','XGG']).map(x=>String(x).toUpperCase()).includes(String(meta.tamanho||'').toUpperCase());let unit=cat.precoEditavel?cents(item.precoUnitarioCentavos):cents(cat.precoCentavos),uniformInfo=null,modelId=null,uniformModel='';if(cat.tipoOperacional==='fardamento'){modelId=cat.legacyUniformModelId||item.modeloFardaId||'camisa_padrao';uniformModel=adultSize?String(meta.modelo||'').toLowerCase():'';if(adultSize&&!['masculino','feminino'].includes(uniformModel))throw Object.assign(new Error('Selecione Masculino ou Feminino (Baby Look) para tamanhos adultos.'),{status:400});const req=addUniformStockRequirement(uniformRequirements,modelId,meta.tamanho,uniformModel,qty,cat.nome);uniformInfo=await uniformStockInfoNow(db,req);const ms=await db.collection('modelos_farda').doc(modelId).get();unit=uniformVariantPrice(uniformInfo.doc,ms.exists?ms.data():{},meta.tamanho)}if(unit<=0)throw Object.assign(new Error(`Informe um valor válido para ${cat.nome}.`),{status:400});const line=unit*qty;total+=line;const common={catalogoItemId:cat.id,nome:cat.nome,descricao:cat.descricao||'',tipoOperacional:cat.tipoOperacional||'servico',categoriaId:cat.categoriaId||null,categoria:item.categoria||'',quantidade:qty,precoUnitarioCentavos:unit,totalCentavos:line,controleEstoque:cat.controleEstoque||'sem_estoque',metadados:meta,dataEvento:cat.dataEvento||null};if(cat.tipoOperacional==='fardamento')lines.push({...common,tipo:'farda',modeloFardaId:modelId,tamanho:meta.tamanho,modelo:uniformModel,permitirProducao:true,statusAtendimento:uniformInfo.available>=qty?'reservado_estoque':'aguardando_producao'});else lines.push({...common,tipo:'catalogo_item'});if(cat.tipoOperacional!=='fardamento')expandCatalogStock(cat,qty,catalogMap,catalogRequirements);if(cat.legacyProdutoId){const product=productMap.get(cat.legacyProdutoId);if(product)expandProduct(product,qty,productMap,expanded)}continue;}
    const product=productMap.get(String(item.produtoId||''));if(!product||product.ativo===false)throw Object.assign(new Error('Produto inválido ou inativo.'),{status:400});const qty=Math.max(1,cents(item.quantidade||1)),unit=productPrice(product,productMap),line=unit*qty;total+=line;lines.push({tipo:'produto',produtoId:product.id,nome:product.nome,quantidade:qty,precoUnitarioCentavos:unit,totalCentavos:line,categoria:product.categoria||'Cantina'});expandProduct(product,qty,productMap,expanded);
  }
  return {total,lines,expanded,catalogStock:[...catalogRequirements.values()],uniformStock:[...uniformRequirements.values()]};
}
function catalogRootId(categoryId,categoryMap){let id=String(categoryId||''),guard=0;while(id&&guard++<12){const c=categoryMap.get(id);if(!c||!c.parentId)return id;id=String(c.parentId)}return id}
async function normalizeSecretaryMixedSale(db,raw=[],channel='presencial',student=null,cfg=null){
  const scheduleRaw=(raw||[]).filter(x=>x&&((x.tipo==='programacao_lanche')||(x.tipoOperacional==='programacao_lanche'))),normalRaw=(raw||[]).filter(x=>!scheduleRaw.includes(x));
  if(channel==='portal'&&normalRaw.length)throw Object.assign(new Error('Neste fluxo do Meu Piaget, somente programações de lanche são aceitas no carrinho familiar.'),{status:400});
  const normal=normalRaw.length?await normalizeSecretarySaleItems(db,normalRaw,channel):{total:0,lines:[],expanded:new Map(),catalogStock:[],uniformStock:[]};
  const categoryMap=await loadCatalogCategoryMap(db);
  for(const line of normal.lines){if(line.tipo==='produto'||catalogRootId(line.categoriaId,categoryMap)==='cat_cantina')throw Object.assign(new Error('Na Secretaria, itens da Cantina devem ser adicionados pela programação de lanches.'),{status:400});}
  if(scheduleRaw.length&&!student)throw Object.assign(new Error('Aluno não identificado para programar lanches.'),{status:400});
  const config=cfg||await getConfig(db),productMap=scheduleRaw.length?await loadProductMap(db):new Map(),programacoes=[],lines=[...normal.lines];let total=normal.total;
  for(let i=0;i<scheduleRaw.length;i++){
    const rawLine=scheduleRaw[i]||{},pedido=rawLine.pedido||rawLine.programacao||rawLine.metadados?.pedido;
    const normalized=normalizeOrderInput({pedido},productMap,student,config,channel==='portal'?'portal':'secretaria'),dates=normalized.days.map(d=>d.dataChave).sort(),summary={tipo:'programacao_lanche',tipoOperacional:'programacao_lanche',nome:rawLine.nome||'Programação de lanches',categoria:'Cantina',quantidade:1,precoUnitarioCentavos:normalized.totalCentavos,totalCentavos:normalized.totalCentavos,pedido:{modalidade:normalized.modalidade,itens:normalized.days.flatMap(d=>d.itens.map(x=>({dataChave:d.dataChave,produtoId:x.produtoId,quantidade:x.quantidade})))},dias:normalized.days,metadados:{modalidade:normalized.modalidade,quantidadeEntregas:normalized.days.length,primeiraData:dates[0]||null,ultimaData:dates[dates.length-1]||null}};
    total+=normalized.totalCentavos;lines.push(summary);programacoes.push({index:i,...normalized,line:summary});
  }
  return{total,lines,expanded:normal.expanded,catalogStock:normal.catalogStock,uniformStock:normal.uniformStock||[],programacoes};
}

function financialFamilyKey(student={}){return String(student.contaFinanceiraId||student.responsavelFinanceiroId||student.id||'')}
function studentAssignmentMeta(student={}){return {alunoId:student.id||null,alunoNome:student.nome||null,turma:student.turma||null,turno:student.turno||null,matricula:student.matricula||null,responsavelFinanceiroId:student.responsavelFinanceiroId||student.contaFinanceiraId||null}}
function mergeRequirementRows(target,rows,keyField){for(const row of rows||[]){const key=String(row?.[keyField]||'');if(!key)continue;const current=target.get(key);if(current){current.quantidade=cents(current.quantidade)+cents(row.quantidade);target.set(key,current)}else target.set(key,{...row,quantidade:cents(row.quantidade)})}return target}
function mergeExpandedRows(target,expanded){for(const [key,row] of expanded||[]){const current=target.get(key);if(current){current.quantidade=cents(current.quantidade)+cents(row.quantidade);target.set(key,current)}else target.set(key,{...row,quantidade:cents(row.quantidade)})}return target}
async function normalizeFamilySecretaryMixedSale(db,raw=[],channel='presencial',primaryStudent=null,cfg=null){
  if(!primaryStudent)throw Object.assign(new Error('Aluno de referência não identificado.'),{status:400});
  const list=Array.isArray(raw)?raw:[],primaryId=String(primaryStudent.id||''),requestedIds=[...new Set(list.map(x=>String(x?.alunoId||primaryId)).filter(Boolean))];
  const students=new Map([[primaryId,primaryStudent]]);
  for(const id of requestedIds){if(students.has(id))continue;const st=await getStudent(db,id);if(!st)throw Object.assign(new Error('Um dos alunos atribuídos à operação não foi encontrado.'),{status:404});students.set(id,st)}
  const familyKey=financialFamilyKey(primaryStudent);
  for(const st of students.values()){if(financialFamilyKey(st)!==familyKey)throw Object.assign(new Error(`${st.nome||'Um aluno'} não pertence à mesma conta familiar.`),{status:403})}
  const grouped=new Map();for(const item of list){const id=String(item?.alunoId||primaryId);const bucket=grouped.get(id)||[];bucket.push(item);grouped.set(id,bucket)}
  const config=cfg||await getConfig(db),lines=[],programacoes=[],expanded=new Map(),catalogReq=new Map(),uniformReq=new Map();let total=0,programIndex=0;
  for(const [id,bucket] of grouped){const st=students.get(id)||primaryStudent,meta=studentAssignmentMeta(st),normalized=await normalizeSecretaryMixedSale(db,bucket,channel,st,config);total+=normalized.total;
    mergeExpandedRows(expanded,normalized.expanded);mergeRequirementRows(catalogReq,normalized.catalogStock,'itemId');mergeRequirementRows(uniformReq,normalized.uniformStock,'stockId');
    for(const line of normalized.lines)lines.push({...line,...meta});
    for(const program of normalized.programacoes||[]){const decoratedLine={...(program.line||{}),...meta};programacoes.push({...program,index:programIndex++,...meta,line:decoratedLine});}
  }
  return {total,lines,expanded,catalogStock:[...catalogReq.values()],uniformStock:[...uniformReq.values()],programacoes,alunosIds:[...students.keys()],students};
}
function normalizeOrderInput(body, productMap, student, cfg, channel='portal'){
  const pedido=body.pedido || body.order || {};
  const rawItems=Array.isArray(pedido.itens) ? pedido.itens : [];
  if(!rawItems.length) throw Object.assign(new Error('Selecione ao menos um lanche e uma data.'),{status:400});
  const grouped=new Map();
  for(const raw of rawItems){
    const day=String(raw.dataChave || raw.data || raw.date || '').trim();
    const productId=String(raw.produtoId || raw.productId || '').trim();
    const qty=Math.max(1,cents(raw.quantidade || raw.quantity || 1));
    if(qty>10) throw Object.assign(new Error('A quantidade máxima por item e por dia é 10.'),{status:400});
    if(!isValidDateKey(day)) throw Object.assign(new Error('Uma das datas do pedido é inválida.'),{status:400});
    if(day<dateKey()) throw Object.assign(new Error('Não é possível reservar lanche para uma data passada.'),{status:400});
    const product=productMap.get(productId);
    if(!product || product.ativo===false || (channel==='secretaria'?product.vendaSecretaria===false:(product.portal===false||product.vendaResponsavel===false))) throw Object.assign(new Error(channel==='secretaria'?'Um dos produtos selecionados não está disponível para a Secretaria.':'Um dos produtos selecionados não está disponível no portal.'),{status:400});
    const list=grouped.get(day)||[];
    const found=list.find(x=>x.produtoId===productId);
    if(found){found.quantidade+=qty;if(found.quantidade>10)throw Object.assign(new Error('A quantidade máxima do mesmo produto por dia é 10.'),{status:400});}
    else list.push({produtoId:productId,quantidade:qty});
    grouped.set(day,list);
  }
  const days=[];
  let total=0;
  for(const [day,items] of [...grouped.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    const commercial=[];
    const expanded=new Map();
    for(const item of items){
      const product=productMap.get(item.produtoId);
      const unit=productPrice(product,productMap);
      const lineTotal=unit*item.quantidade;
      total+=lineTotal;
      commercial.push({produtoId:product.id,nome:product.nome,quantidade:item.quantidade,precoUnitarioCentavos:unit,totalCentavos:lineTotal,combo:Boolean(product.combo)});
      expandProduct(product,item.quantidade,productMap,expanded);
    }
    const components=[...expanded.values()];
    const salgadoQty=components.filter(x=>x.produtoId==='salgado').reduce((s,x)=>s+cents(x.quantidade),0);
    days.push({
      dataChave:day,
      turno:student.turno || 'manha',
      itens:commercial,
      componentes:components,
      quantidadeSalgados:salgadoQty,
      totalCentavos:commercial.reduce((s,x)=>s+cents(x.totalCentavos),0)
    });
  }
  return {
    modalidade:String(pedido.modalidade || pedido.mode || 'avulso'),
    days,
    totalCentavos:total,
    observacao:String(pedido.observacao || '').trim()
  };
}
async function reserveCantinaOrder(db, body, actor, student, customer, cfg){
  const [productMap,acc]=await Promise.all([loadProductMap(db),getAccount(db,student.id)]),normalized=normalizeOrderInput(body,productMap,student,cfg),saldoAtual=accountNet(acc),useBalance=body.usarSaldo===true,creditUsed=useBalance?Math.min(Math.max(0,saldoAtual),normalized.totalCentavos):0,debtRequired=Math.max(0,-saldoAtual),minCheckout=Math.max(100,cents(cfg.valorMinimoCheckoutPositivoCentavos||100)),required=Math.max(0,normalized.totalCentavos-creditUsed+debtRequired),checkoutTotal=required>0?Math.max(required,minCheckout):0,projectedNet=saldoAtual+checkoutTotal-normalized.totalCentavos,orderRef=db.collection('pedidos').doc(),pedidoId=orderRef.id,minutes=Math.min(10,Math.max(1,cents(cfg.reservaPedidoMinutos||ORDER_RESERVATION_MINUTES_DEFAULT))),expiresAt=new Date(Date.now()+minutes*60*1000).toISOString(),now=nowIso(),capacityRefs=normalized.days.map(day=>({day,ref:db.collection('disponibilidade_salgados').doc(day.dataChave)}));
  await db.runTransaction(async tx=>{const snaps=await Promise.all(capacityRefs.map(x=>tx.get(x.ref)));for(let i=0;i<capacityRefs.length;i++){const {day,ref}=capacityRefs[i],current=snaps[i].exists?snaps[i].data():{},info=lunchDayInfo(day.dataChave,current,cfg);if(!info.active){const err=new Error(`Não haverá venda de lanche em ${day.dataChave.split('-').reverse().join('/')}.`);err.status=409;throw err}if(cents(day.quantidadeSalgados)>0&&info.used+day.quantidadeSalgados>info.capacity){const err=new Error(`Não há salgados suficientes em ${day.dataChave}. Disponíveis: ${info.available}.`);err.status=409;throw err}if(cents(day.quantidadeSalgados)>0){const reservas={...(current.reservas||{})};reservas[pedidoId]={pedidoId,alunoId:student.id,alunoNome:student.nome,quantidade:day.quantidadeSalgados,expiraEm:expiresAt,criadoEm:now};tx.set(ref,{dataChave:day.dataChave,quantidadePlanejada:info.planned,reservas,atualizadoEm:now},{merge:true})}}tx.set(orderRef,{id:pedidoId,tipoPedido:'cantina',modalidade:normalized.modalidade,alunoId:student.id,alunoNome:student.nome,turma:student.turma||null,turno:student.turno||null,matricula:student.matricula||null,responsavelFinanceiro:student.responsavelFinanceiro||null,dias:normalized.days,observacao:normalized.observacao,totalCentavos:normalized.totalCentavos,usarSaldo:useBalance,valorSaldoPrevistoCentavos:creditUsed,valorRegularizacaoPrevistoCentavos:debtRequired,saldoNoMomentoCentavos:saldoAtual,valorCheckoutPrevistoCentavos:checkoutTotal,saldoProjetadoDepoisCentavos:projectedNet,statusPagamento:checkoutTotal>0?'aguardando_pagamento':'pago_com_saldo',statusPedido:checkoutTotal>0?'aguardando_pagamento':'reservado',statusAplicacao:'pendente',reservaMinutos:minutes,reservaExpiraEm:expiresAt,customer:customer||null,origem:actor.perfil==='responsavel'?'portal_responsavel':'operacao_interna',criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'})});
  await audit(db,'pedido_cantina_reservado',{pedidoId,alunoId:student.id,alunoNome:student.nome,valorCentavos:normalized.totalCentavos,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,descricaoHumana:`${actor.nome} reservou ${normalized.days.length} entrega(s) de cantina para ${student.nome}. A reserva expira em ${minutes} minutos.`});
  return{pedidoId,normalized,saldoAtual,useBalance,creditUsed,debtRequired,checkoutTotal,projectedNet,expiresAt,minutes};
}
async function releasePendingOrder(db,pedidoId,status='cancelado_reserva'){
  if(!pedidoId) return;
  const orderRef=db.collection('pedidos').doc(pedidoId);
  await db.runTransaction(async tx=>{
    const orderSnap=await tx.get(orderRef);
    if(!orderSnap.exists) return;
    const order=orderSnap.data();
    if(order.statusAplicacao==='aplicado') return;
    const capacityRefs=(order.dias||[]).map(day=>({day,ref:db.collection('disponibilidade_salgados').doc(day.dataChave)}));
    const snaps=await Promise.all(capacityRefs.map(x=>tx.get(x.ref)));
    for(let i=0;i<capacityRefs.length;i++){
      const current=snaps[i].exists?snaps[i].data():{};
      const reservas={...(current.reservas||{})};
      delete reservas[pedidoId];
      tx.set(capacityRefs[i].ref,{reservas,atualizadoEm:nowIso()},{merge:true});
    }
    tx.set(orderRef,{statusPedido:status,statusPagamento:'nao_concluido',atualizadoEm:nowIso()},{merge:true});
  });
}

function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object')return Object.keys(value).sort().reduce((out,key)=>{if(!['comprador','customer','criadoPorId','criadoPorNome','criadoPorPerfil','salvarComprador','idTentativa','forceNewLink','clientVersion'].includes(key))out[key]=stableValue(value[key]);return out},{})
  return value;
}
function checkoutOperationKey(body={}){
  const tipo=normalizePaymentType(body.tipo||body.type),core={tipo,alunoId:String(body.alunoId||''),usarSaldo:Boolean(body.usarSaldo)};
  if(tipo==='entrada_conta_aluno')core.valorCentavos=cents(body.valorCentavos||body.amount||body.totalCentavos);
  if(tipo==='pedido_cantina')core.pedido=stableValue(body.pedido||{});
  if(tipo==='pedido_farda')core.farda=stableValue(body.farda||body.uniforme||body.pedido||{});
  if(tipo==='venda_online_secretaria'){core.itens=stableValue(body.itens||[]);core.vendaOnlineId=String(body.vendaOnlineId||'');}
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(core))).digest('hex').slice(0,40);
}
function validCheckoutUrl(value){
  try{const url=new URL(String(value||''));if(url.protocol!=='https:')return false;const host=url.hostname.toLowerCase();return host==='infinitepay.io'||host.endsWith('.infinitepay.io')||host.endsWith('.infinitepay.com.br')||host.endsWith('.cloudwalk.io')}catch(error){return false}
}
async function replaceActiveCheckoutsForOperation(db,body,operationKey){
  const alunoId=String(body.alunoId||'').trim();if(!alunoId||!operationKey)return [];
  // RC2.7.24: não limitar a 30 checkouts arbitrários. Percorremos todo o histórico SOMENTE deste aluno,
  // em páginas, e preservamos exatamente a mesma regra de risco/substituição da InfinitePay.
  const docs=await allDocsByEquality(db,'pagamentos_checkout','alunoId',alunoId,100),active=['preparando_link','aguardando_pagamento','erro_timeout','erro_gerar_link','erro_sem_url'];
  const rows=docs.map(doc=>({id:doc.id,ref:doc.ref,...doc.data()})).filter(row=>row.operationKey===operationKey&&active.includes(row.status)&&row.statusAplicacao!=='aplicado');
  const reconciliationRisk=rows.filter(row=>row.conciliacaoStatus==='aguardando_retorno_infinitepay'&&row.identificadoresPendentes!==false);
  if(reconciliationRisk.length){const error=new Error('Existe uma cobrança desta operação em verificação. Confirme na InfinitePay se o pagamento original foi realizado antes de gerar outro link.');error.status=409;error.code='PAYMENT_RECONCILIATION_PENDING';throw error;}
  const now=nowIso();
  for(const row of rows){
    await row.ref.set({statusAnterior:row.status,status:'substituido_nova_cobranca',statusAplicacao:'substituido_sem_pagamento',checkoutUrlAtivo:false,ocultoParaResponsavel:true,substituidoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});
    await invalidateCheckoutAttempt(db,row,'nova_tentativa_mesma_operacao').catch(()=>{});
    if(row.pedidoId&&row.tipo==='pedido_cantina')await releasePendingOrder(db,row.pedidoId,'substituido_nova_cobranca').catch(()=>{});
    if(row.pedidoId&&row.tipo==='pedido_farda')await safeSet(db.collection('pedidos_farda').doc(row.pedidoId),{statusPagamento:'nao_concluido',statusAtendimento:'cancelado',statusAplicacao:'substituido',motivoCancelamento:'Cobrança substituída por uma nova tentativa.',atualizadoEm:now});
    await audit(db,'checkout_substituido_nova_cobranca',{orderNsu:row.orderNsu||row.id,pagamentoId:row.orderNsu||row.id,pedidoId:row.pedidoId||null,alunoId:row.alunoId||alunoId,alunoNome:row.alunoNome||null,responsavelFinanceiroId:row.responsavelFinanceiroId||null,valorCentavos:row.totalCentavos||0,severidade:'warning',descricaoHumana:`A cobrança ${row.orderNsu||row.id} foi encerrada sem aplicação para permitir uma nova tentativa da mesma operação.`});
  }
  return rows.map(row=>row.id);
}


function checkoutDescriptionText(value){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,110);
}
async function familyCheckoutSubject(db,aluno,{forceFamily=false,alunosIds=[]}={}){
  const unique=[...new Set((alunosIds||[]).map(String).filter(Boolean))];
  let family=forceFamily||unique.length>1;
  if(!family&&aluno?.responsavelFinanceiroId){
    try{
      const rs=await db.collection('responsaveis_financeiros').doc(String(aluno.responsavelFinanceiroId)).get();
      family=rs.exists&&Number(rs.data()?.quantidadeAlunosAtivos||0)>1;
    }catch(_){family=false}
  }
  if(family){
    const name=String(aluno?.responsavelFinanceiro||'Responsável').trim();
    return `Família de ${name||'Responsável'}`;
  }
  return String(aluno?.nome||'Aluno').trim()||'Aluno';
}
function familySaleDescription(lines=[],subject='Família'){
  const categories=[...new Set((lines||[]).map(x=>String(x.categoriaId||x.categoria||x.tipoOperacional||'').toLowerCase()).filter(Boolean))];
  const allCantina=categories.length>0&&categories.every(x=>x.includes('cantina')||x.includes('lanche')||x.includes('combo'));
  const allUniform=categories.length>0&&categories.every(x=>x.includes('farda')||x.includes('uniform'));
  return checkoutDescriptionText(`${allCantina?'Lanche':allUniform?'Fardamento':'Compra'} - ${subject}`);
}

async function buildCheckoutOperation(db, body){
  const tipo=normalizePaymentType(body.tipo || body.type);
  const actor=actorFromBody(body);
  const operationKey=checkoutOperationKey(body);
  const now=nowIso();
  const aluno=await getStudent(db, body.alunoId);
  if(!aluno) throw Object.assign(new Error('Aluno não encontrado para gerar a operação.'),{status:404});
  const providedCustomer=buildCustomerFromBody(body, aluno);
  const savedCustomer=await getSavedBuyer(db,aluno.id);
  const customer=mergeCustomer(savedCustomer,providedCustomer,aluno);
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
  if(tipo==='pedido_cantina'){
    const cfg=await getConfig(db);
    const reservation=await reserveCantinaOrder(db,body,actor,aluno,customer,cfg);
    const order=reservation.normalized;
    const descricao=checkoutDescriptionText(`Lanche - ${aluno.nome}`);
    return {
      tipo,
      actor,
      operationKey,
      totalCentavos:reservation.checkoutTotal,
      pedidoTotalCentavos:order.totalCentavos,
      minimoCentavos:reservation.checkoutTotal>0?Math.min(reservation.checkoutTotal,Math.max(100,cents(cfg.valorMinimoCheckoutPositivoCentavos||100))):0,
      descricao,
      alunoId:aluno.id,
      alunoNome:aluno.nome,
      turma:aluno.turma||null,
      turno:aluno.turno||null,
      matricula:aluno.matricula||null,
      responsavelFinanceiro:aluno.responsavelFinanceiro||null,responsavelFinanceiroId:aluno.responsavelFinanceiroId||null,
      saldoNoMomentoCentavos:reservation.saldoAtual,
      saldoEmAbertoNoMomentoCentavos:Math.max(0,-reservation.saldoAtual),
      pedidoId:reservation.pedidoId,
      reservaExpiraEm:reservation.expiresAt,
      reservaMinutos:reservation.minutes,
      itensCheckout:reservation.checkoutTotal>0?[{quantity:1,price:reservation.checkoutTotal,description:descricao}]:[],
      customer,
      payload:{
        pedidoId:reservation.pedidoId,
        pedidoTotalCentavos:order.totalCentavos,
        saldoNoMomentoCentavos:reservation.saldoAtual,
        saldoProjetadoDepoisCentavos:reservation.projectedNet,
        reservaExpiraEm:reservation.expiresAt,
        modalidade:order.modalidade,
        quantidadeEntregas:order.days.length
      },
      criadoEm:now
    };
  }
  if(tipo==='pedido_farda'){
    const reservation=await reserveUniformOrder(db,body,actor,aluno,customer);
    const descricao=checkoutDescriptionText(`Fardamento - ${aluno.nome}`);
    return {tipo,actor,operationKey,totalCentavos:reservation.checkoutTotal,pedidoTotalCentavos:reservation.totalCentavos,minimoCentavos:reservation.checkoutTotal>0?reservation.checkoutTotal:0,descricao,
      alunoId:aluno.id,alunoNome:aluno.nome,turma:aluno.turma||null,turno:aluno.turno||null,matricula:aluno.matricula||null,responsavelFinanceiro:aluno.responsavelFinanceiro||null,responsavelFinanceiroId:aluno.responsavelFinanceiroId||null,
      saldoNoMomentoCentavos:reservation.saldoAtual,saldoEmAbertoNoMomentoCentavos:Math.max(0,-reservation.saldoAtual),pedidoId:reservation.pedidoId,
      itensCheckout:reservation.checkoutTotal>0?[{quantity:1,price:reservation.checkoutTotal,description:descricao}]:[],customer,
      payload:{pedidoId:reservation.pedidoId,pedidoTotalCentavos:reservation.totalCentavos,tamanho:reservation.size,modelo:reservation.gender,quantidade:reservation.qty},criadoEm:now};
  }
  if(tipo==='venda_online_secretaria'){
    const raw=Array.isArray(body.itens)?body.itens:[];
    if(!raw.length)throw Object.assign(new Error('Adicione ao menos um item à venda.'),{status:400});
    const validationChannel=actor.perfil==='responsavel'?'portal':'online',cfg=await getConfig(db),normalized=await normalizeFamilySecretaryMixedSale(db,raw,validationChannel,aluno,cfg),total=normalized.total,lines=normalized.lines,expanded=normalized.expanded,catalogStock=normalized.catalogStock,uniformStock=normalized.uniformStock||[],programacoes=normalized.programacoes,alunosIds=normalized.alunosIds||[aluno.id];
    const acc=await getAccount(db,aluno.id),saldoAtual=accountNet(acc),usarSaldo=body.usarSaldo===true,creditoUsado=usarSaldo?Math.min(Math.max(0,saldoAtual),total):0,regularizacao=Math.max(0,-saldoAtual),checkoutTotal=Math.max(0,total-creditoUsado+regularizacao),subject=alunosIds.length>1?await familyCheckoutSubject(db,aluno,{forceFamily:true,alunosIds}):aluno.nome,descricao=familySaleDescription(lines,subject);
    return {tipo,actor,operationKey,totalCentavos:checkoutTotal,pedidoTotalCentavos:total,minimoCentavos:checkoutTotal>0?checkoutTotal:0,descricao,alunoId:aluno.id,alunoNome:aluno.nome,turma:aluno.turma||null,turno:aluno.turno||null,matricula:aluno.matricula||null,responsavelFinanceiro:aluno.responsavelFinanceiro||null,responsavelFinanceiroId:aluno.responsavelFinanceiroId||null,alunosIds,saldoNoMomentoCentavos:saldoAtual,saldoEmAbertoNoMomentoCentavos:regularizacao,vendaOnlineId:String(body.vendaOnlineId||''),itensCheckout:checkoutTotal>0?[{quantity:1,price:checkoutTotal,description:descricao}]:[],customer,payload:{vendaOnlineId:String(body.vendaOnlineId||''),itens:lines,componentes:[...expanded.values()],estoquesCatalogo:catalogStock,estoquesFarda:uniformStock,programacoes,alunosIds,usarSaldo,creditoUsadoCentavos:creditoUsado,regularizacaoCentavos:regularizacao,pedidoTotalCentavos:total,saldoNoMomentoCentavos:saldoAtual},criadoEm:now};
  }
  if(tipo !== 'entrada_conta_aluno') throw Object.assign(new Error('Tipo de operação não suportado nesta versão.'),{status:400});
  const acc=await getAccount(db, aluno.id);
  const cfg=await getConfig(db);
  const saldoAtual=accountNet(acc);
  const minimo = saldoAtual < 0 ? Math.abs(saldoAtual) : Math.max(100, cents(cfg.valorMinimoCheckoutPositivoCentavos || 100));
  const total=cents(body.valorCentavos || body.amount || body.totalCentavos);
  if(total <= 0) throw Object.assign(new Error('Informe um valor válido para o pagamento.'),{status:400});
  if(total < minimo){
    const msg = saldoAtual < 0
      ? `O valor mínimo para regularizar este saldo é ${brl(minimo)}.`
      : `O valor mínimo para adicionar crédito é ${brl(minimo)}.`;
    const err = new Error(msg); err.status = 400; throw err;
  }
  const subject=await familyCheckoutSubject(db,aluno);
  const descricao = checkoutDescriptionText(saldoAtual < 0 ? `Regularização - ${subject}` : `Crédito - ${subject}`);
  return {
    tipo, actor, operationKey, totalCentavos:total, minimoCentavos:minimo, descricao,
    alunoId:aluno.id, alunoNome:aluno.nome, turma:aluno.turma || null, turno:aluno.turno||null, matricula:aluno.matricula || null,
    responsavelFinanceiro:aluno.responsavelFinanceiro || null,responsavelFinanceiroId:aluno.responsavelFinanceiroId||null,
    saldoNoMomentoCentavos:saldoAtual,
    saldoEmAbertoNoMomentoCentavos:Math.max(0,-saldoAtual),
    itensCheckout:[{quantity:1, price:total, description:descricao}],
    customer,
    payload:{ saldoNoMomentoCentavos:saldoAtual, minimoCentavos:minimo },
    criadoEm:now
  };
}
async function markCheckoutOperationFailure(db,op,status){
  if(!op?.pedidoId)return;
  if(op.tipo==='pedido_cantina')return releasePendingOrder(db,op.pedidoId,status).catch(()=>{});
  if(op.tipo==='pedido_farda')return safeSet(db.collection('pedidos_farda').doc(op.pedidoId),{statusPagamento:status,statusAplicacao:'pendente',atualizadoEm:nowIso()});
}
function checkoutCustomerIssues(customer={}){
  const issues=[];const name=String(customer.name||'').trim(),email=normalizeEmail(customer.email||''),phone=normalizePhone(customer.phone_number||customer.phone||''),digits=phone.replace(/\D/g,'');
  if(name.length<3)issues.push('nome');if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))issues.push('e-mail');if(digits.length<12||digits.length>13)issues.push('telefone');return issues;
}
async function createCheckoutLink(db, req, op, timings={}){
  if(op.tipo==='venda_online_secretaria'&&cents(op.totalCentavos)===0){const pseudo={id:`SALDO-ONLINE-${op.vendaOnlineId||Date.now()}`,orderNsu:`SALDO-ONLINE-${op.vendaOnlineId||Date.now()}`,tipo:op.tipo,totalCentavos:0,pedidoTotalCentavos:op.pedidoTotalCentavos,payloadOperacional:op.payload,alunoId:op.alunoId,alunoNome:op.alunoNome,matricula:op.matricula,vendaOnlineId:op.vendaOnlineId};let result;await db.runTransaction(async tx=>{result=await applyOnlineSecretarySaleTx(tx,db,pseudo,{origem:'saldo_conta'});});return{sem_checkout:true,venda_confirmada:result.status==='confirmado',venda_em_revisao:result.status!=='confirmado',venda_online_id:op.vendaOnlineId,total_centavos:0,pedido_total_centavos:op.pedidoTotalCentavos,saldo_depois_centavos:result.saldoDepoisCentavos,tipo:op.tipo,timings};}
  if(op.tipo==='pedido_farda'&&cents(op.totalCentavos)===0){const result=await confirmUniformOrderWithoutCheckout(db,op.pedidoId,op.actor);return{sem_checkout:true,pedido_confirmado:true,pedido_id:op.pedidoId,total_centavos:0,pedido_total_centavos:op.pedidoTotalCentavos,saldo_depois_centavos:result.saldoDepoisCentavos,tipo:op.tipo,timings}}
  if(op.tipo==='pedido_cantina'&&cents(op.totalCentavos)===0){try{const result=await confirmCantinaOrderWithoutCheckout(db,op.pedidoId,op.actor);return{sem_checkout:true,pedido_confirmado:result.status==='confirmado',pedido_em_revisao:result.status!=='confirmado',pedido_id:op.pedidoId,total_centavos:0,pedido_total_centavos:op.pedidoTotalCentavos,saldo_depois_centavos:result.saldoDepoisCentavos,tipo:op.tipo,reserva_expira_em:op.reservaExpiraEm,timings}}catch(error){await releasePendingOrder(db,op.pedidoId,'erro_confirmacao_saldo').catch(()=>{});throw error}}
  const customerIssues=checkoutCustomerIssues(op.customer||{});if(customerIssues.length)throw Object.assign(new Error(`Complete os dados do comprador: ${customerIssues.join(', ')}.`),{status:400});
  const handle=normalizeHandle(),baseUrl=getBaseUrl(req),familyBaseUrl=(()=>{try{return new URL(String(process.env.PUBLIC_FAMILY_BASE_URL||'https://meupiaget.com.br')).origin}catch(_){return 'https://meupiaget.com.br'}})(),apiBaseUrl=(()=>{try{return new URL(String(process.env.PUBLIC_API_BASE_URL||baseUrl)).origin}catch(_){return baseUrl}})(),nsuType=op.tipo==='entrada_conta_aluno'?'CONTA':op.tipo==='pedido_cantina'?'PEDIDO':op.tipo==='pedido_farda'?'FARDA':op.tipo==='venda_online_secretaria'?'VENDAONLINE':'OPERACAO',orderNsu=makeOrderNsu(nsuType),redirectUrl=`${familyBaseUrl}/obrigado.html`,webhookUrl=`${apiBaseUrl}/api/webhook-infinitepay`,payload={handle,order_nsu:orderNsu,redirect_url:redirectUrl,webhook_url:webhookUrl,items:op.itensCheckout};if(op.customer)payload.customer=op.customer;
  const checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu),persistStart=Date.now();
  await checkoutRef.set({id:orderNsu,orderNsu,idTentativa:op.idTentativa||null,operationKey:op.operationKey||null,handle,tipo:op.tipo,pedidoId:op.pedidoId||null,vendaOnlineId:op.vendaOnlineId||null,pedidoTotalCentavos:op.pedidoTotalCentavos||0,reservaExpiraEm:op.reservaExpiraEm||null,reservaMinutos:op.reservaMinutos||null,alunoId:op.alunoId||null,alunoNome:op.alunoNome||null,turma:op.turma||null,turno:op.turno||null,matricula:op.matricula||null,responsavelFinanceiro:op.responsavelFinanceiro||null,responsavelFinanceiroId:op.responsavelFinanceiroId||null,alunosIds:Array.isArray(op.alunosIds)?op.alunosIds:(Array.isArray(op.payload?.alunosIds)?op.payload.alunosIds:[]),descricao:op.descricao,totalCentavos:op.totalCentavos,minimoCentavos:op.minimoCentavos||0,saldoNoMomentoCentavos:op.saldoNoMomentoCentavos||0,saldoEmAbertoNoMomentoCentavos:op.saldoEmAbertoNoMomentoCentavos||0,status:'preparando_link',statusAplicacao:'pendente',payloadOperacional:op.payload||{},itensCheckout:op.itensCheckout,customer:op.customer||null,redirectUrl,webhookUrl,origem:'checkout_infinitepay',criadoPorId:op.actor.id,criadoPorNome:op.actor.nome,criadoPorPerfil:op.actor.perfil,criadoEm:nowIso(),atualizadoEm:nowIso(),versao:'1.6.0-rc2.7.24'},{merge:false});
  if(op.pedidoId){const collection=op.tipo==='pedido_farda'?'pedidos_farda':'pedidos';await safeSet(db.collection(collection).doc(op.pedidoId),{orderNsu,checkoutId:orderNsu,atualizadoEm:nowIso()})}
  timings.persistenciaCheckoutMs=Date.now()-persistStart;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000),ipStart=Date.now();let response,text,data={};
  try{response=await fetch(INFINITE_LINKS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});text=await response.text();try{data=JSON.parse(text)}catch{data={raw:text}}}catch(error){timings.infinitePayMs=Date.now()-ipStart;const timedOut=error?.name==='AbortError';await checkoutRef.set({status:timedOut?'erro_timeout':'erro_gerar_link',erroInfinitePay:{message:error.message},timings,atualizadoEm:nowIso()},{merge:true});await markCheckoutOperationFailure(db,op,timedOut?'erro_timeout':'erro_gerar_link');throw Object.assign(new Error(timedOut?'A InfinitePay demorou além do limite para gerar o link. Consulte Pagamentos pendentes antes de tentar novamente.':'Não foi possível comunicar com a InfinitePay.'),{status:timedOut?504:502})}finally{clearTimeout(timer)}
  timings.infinitePayMs=Date.now()-ipStart;
  if(!response.ok){await checkoutRef.set({status:'erro_gerar_link',erroInfinitePay:data,timings,atualizadoEm:nowIso()},{merge:true});await markCheckoutOperationFailure(db,op,'erro_gerar_link');throw Object.assign(new Error('A InfinitePay não conseguiu gerar o link.'),{status:502,details:data})}
  const url=extractCheckoutUrl(data);if(!url){await checkoutRef.set({status:'erro_sem_url',respostaCriacaoLink:data,timings,atualizadoEm:nowIso()},{merge:true});await markCheckoutOperationFailure(db,op,'erro_sem_url');throw Object.assign(new Error('Resposta da InfinitePay sem URL de checkout identificável.'),{status:502,details:data})}
  if(!validCheckoutUrl(url)){await checkoutRef.set({status:'erro_url_invalida',checkoutUrl:url||null,respostaCriacaoLink:data,httpStatusInfinitePay:response.status,timings,atualizadoEm:nowIso()},{merge:true});await markCheckoutOperationFailure(db,op,'erro_url_invalida');throw Object.assign(new Error('A InfinitePay devolveu um endereço de pagamento inválido.'),{status:502,details:data})}
  const generatedAt=nowIso(),reuseUntil=new Date(Date.now()+90*1000).toISOString();
  await checkoutRef.set({checkoutUrl:url,checkoutUrlAtivo:true,status:'aguardando_pagamento',linkGeradoEm:generatedAt,linkReutilizavelAte:reuseUntil,httpStatusInfinitePay:response.status,respostaCriacaoLink:data,timings,atualizadoEm:generatedAt},{merge:true});
  await audit(db,'checkout_link_gerado',{orderNsu,pedidoId:op.pedidoId||null,alunoId:op.alunoId,alunoNome:op.alunoNome,valorCentavos:op.totalCentavos,criadoPorId:op.actor.id,criadoPorNome:op.actor.nome,criadoPorPerfil:op.actor.perfil,descricaoHumana:`${op.actor.nome} gerou link InfinitePay de ${brl(op.totalCentavos)} para ${op.alunoNome||'operação'}.`});
  return{order_nsu:orderNsu,checkout_url:url,total_centavos:op.totalCentavos,pedido_total_centavos:op.pedidoTotalCentavos||0,pedido_id:op.pedidoId||null,tipo:op.tipo,minimo_centavos:op.minimoCentavos||0,reserva_expira_em:op.reservaExpiraEm||null,reserva_minutos:op.reservaMinutos||null,timings};
}
function unwrapPaymentResponse(input){
  if(!input || typeof input !== 'object') return {};
  const candidates=[input,input.data,input.result,input.payment,input.invoice,input.data?.payment,input.data?.invoice].filter(x=>x&&typeof x==='object');
  return candidates.reduce((acc,item)=>({...acc,...item}),{});
}
function isPaidResponse(data){
  const normalized=unwrapPaymentResponse(data);
  const status=String(normalized.status || normalized.payment_status || normalized.invoice_status || '').trim().toLowerCase();
  const paidFlag=normalized.paid===true || normalized.is_paid===true || normalized.approved===true;
  const paidStatus=['paid','pago','approved','aprovado','confirmed','confirmado','captured'].includes(status);
  return Boolean(paidFlag || paidStatus);
}
function paymentEvidence(paymentData={}){
  const normalized=unwrapPaymentResponse(paymentData);
  return {
    transactionNsu:normalized.transaction_nsu||normalized.transactionNsu||paymentData.transaction_nsu||paymentData.transactionNsu||'',
    invoiceSlug:normalized.invoice_slug||normalized.invoiceSlug||normalized.slug||paymentData.invoice_slug||paymentData.invoiceSlug||paymentData.slug||'',
    captureMethod:normalized.capture_method||normalized.captureMethod||paymentData.capture_method||paymentData.captureMethod||'',
    receiptUrl:normalized.receipt_url||normalized.receiptUrl||paymentData.receipt_url||paymentData.receiptUrl||'',
    paidAmountCentavos:cents(normalized.paid_amount||normalized.paidAmount||paymentData.paid_amount||paymentData.paidAmount||0),
    amountCentavos:cents(normalized.amount||paymentData.amount||0)
  };
}
function mergePaymentEvidence(...sources){
  const merged={};
  for(const source of sources){
    const e=paymentEvidence(source||{});
    if(!merged.transactionNsu&&e.transactionNsu)merged.transactionNsu=e.transactionNsu;
    if(!merged.invoiceSlug&&e.invoiceSlug)merged.invoiceSlug=e.invoiceSlug;
    if(!merged.captureMethod&&e.captureMethod)merged.captureMethod=e.captureMethod;
    if(!merged.receiptUrl&&e.receiptUrl)merged.receiptUrl=e.receiptUrl;
    if(!merged.paidAmountCentavos&&e.paidAmountCentavos)merged.paidAmountCentavos=e.paidAmountCentavos;
    if(!merged.amountCentavos&&e.amountCentavos)merged.amountCentavos=e.amountCentavos;
  }
  return {
    transactionNsu:merged.transactionNsu||'',
    invoiceSlug:merged.invoiceSlug||'',
    captureMethod:merged.captureMethod||'',
    receiptUrl:merged.receiptUrl||'',
    paidAmountCentavos:cents(merged.paidAmountCentavos||0),
    amountCentavos:cents(merged.amountCentavos||0)
  };
}
function compactError(error){
  return {message:String(error?.message||error||'Erro desconhecido'),name:String(error?.name||'Error'),code:String(error?.code||''),stack:String(error?.stack||'').slice(0,3000)};
}
function safeFinancialId(value){return String(value||'').replace(/\//g,'_').replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,500)||'sem_id';}
function financialMovementRef(db,checkout,suffix){return db.collection('movimentos_conta').doc(`${safeFinancialId(checkout.orderNsu||checkout.id)}__${suffix}`);}
function validatePaidCheckout(checkout,paymentData,evidence){
  if(!isPaidResponse(paymentData)){
    const error=new Error('A InfinitePay ainda não confirmou este pagamento como aprovado.');
    error.status=409;error.code='PAYMENT_NOT_CONFIRMED';throw error;
  }
  if(!evidence.transactionNsu){const error=new Error('O NSU da transação não foi informado pela InfinitePay.');error.status=409;error.code='MISSING_TRANSACTION_NSU';throw error;}
  if(!evidence.invoiceSlug){const error=new Error('O código da fatura não foi informado pela InfinitePay.');error.status=409;error.code='MISSING_INVOICE_SLUG';throw error;}
  const expected=cents(checkout.totalCentavos);
  const amount=cents(evidence.amountCentavos);
  if(expected>0 && amount<=0){const error=new Error('A InfinitePay confirmou o pagamento, mas não informou o valor da cobrança.');error.status=409;error.code='MISSING_PAYMENT_AMOUNT';throw error;}
  if(expected>0 && amount!==expected){
    const error=new Error(`O valor confirmado pela InfinitePay (${brl(amount)}) é diferente do valor esperado (${brl(expected)}).`);
    error.status=409;error.code='PAYMENT_AMOUNT_MISMATCH';error.details={expectedCentavos:expected,amountCentavos:amount};throw error;
  }
  return {expectedCentavos:expected,amountCentavos:amount};
}
async function recordInfinitePayEvent(db,orderNsu,paymentData={},source='confirmacao'){
  const now=nowIso(),evidence=paymentEvidence(paymentData),ref=db.collection('eventos_checkout_infinitepay').doc();
  // A evidência bruta é crítica para conciliação: se a InfinitePay chamou o endpoint,
  // primeiro persistimos o evento e espelhamos os identificadores no checkout antes
  // de qualquer consulta externa ou aplicação operacional mais pesada.
  await ref.set({id:ref.id,orderNsu,source,payload:paymentData,evidence,criadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:false});
  if(orderNsu){
    const patch={
      atualizadoEm:now,
      ultimoRetornoRecebidoEm:(evidence.transactionNsu||evidence.invoiceSlug)?now:null,
      identificadoresPendentes:!(evidence.transactionNsu&&evidence.invoiceSlug)
    };
    if(evidence.transactionNsu)patch.transactionNsu=evidence.transactionNsu;
    if(evidence.invoiceSlug)patch.invoiceSlug=evidence.invoiceSlug;
    if(evidence.captureMethod)patch.captureMethod=evidence.captureMethod;
    if(evidence.receiptUrl)patch.receiptUrl=evidence.receiptUrl;
    if(evidence.paidAmountCentavos)patch.paidAmountCentavos=evidence.paidAmountCentavos;
    if(evidence.amountCentavos)patch.amountCentavos=evidence.amountCentavos;
    if(String(source).includes('webhook')){
      patch.webhookRecebidoEm=now;
      patch.ultimoWebhookPayload=paymentData;
      patch.conciliacaoStatus='retorno_recebido';
    }
    await db.collection('pagamentos_checkout').doc(orderNsu).set(patch,{merge:true}).catch(error=>console.warn('Não foi possível espelhar evidência InfinitePay no checkout:',error.message));
  }
  return evidence;
}
function isManualSyntheticEvidence(value){return /^MANUAL-/i.test(String(value||''));}
function checkoutPaymentDiagnostic(checkout={}){
  return {
    checkoutCriado:true,
    webhookRecebido:Boolean(checkout.webhookRecebidoEm||checkout.ultimoWebhookPayload),
    transactionNsuPresente:Boolean(checkout.transactionNsu),
    invoiceSlugPresente:Boolean(checkout.invoiceSlug),
    identificadoresPendentes:Boolean(checkout.identificadoresPendentes),
    status:String(checkout.status||'aguardando_pagamento'),
    statusAplicacao:String(checkout.statusAplicacao||'pendente'),
    conciliacaoStatus:String(checkout.conciliacaoStatus||''),
    ultimaTentativaSincronizacaoEm:checkout.ultimaTentativaSincronizacaoEm||null,
    erroAplicacao:checkout.erroAplicacao||null
  };
}
async function supplementAppliedPaymentEvidence(db,checkout,evidence={},source='retorno_tardio'){
  if(!checkout?.orderNsu||!evidence.transactionNsu||!evidence.invoiceSlug||isManualSyntheticEvidence(evidence.transactionNsu))return;
  const orderNsu=checkout.orderNsu,now=nowIso(),transactionRef=db.collection('transacoes_infinitepay').doc(safeFinancialId(evidence.transactionNsu)),paymentRef=db.collection('pagamentos').doc(orderNsu),checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu);
  await db.runTransaction(async tx=>{
    const [transactionSnap,paymentSnap]=await Promise.all([tx.get(transactionRef),tx.get(paymentRef)]);
    if(transactionSnap.exists){const row=transactionSnap.data()||{};if(row.orderNsu&&row.orderNsu!==orderNsu){const error=new Error('Esta transação da InfinitePay já está vinculada a outro pedido.');error.code='TRANSACTION_ALREADY_USED';throw error;}}
    tx.set(transactionRef,{id:transactionRef.id,transactionNsu:evidence.transactionNsu,orderNsu,pedidoId:checkout.pedidoId||null,alunoId:checkout.alunoId||null,alunosIds:Array.isArray(checkout.alunosIds)?checkout.alunosIds:[],amountCentavos:evidence.amountCentavos||checkout.totalCentavos||0,status:'aplicado',evidenciaComplementar:true,origemEvidencia:source,confirmadoEm:now,atualizadoEm:now},{merge:true});
    if(paymentSnap.exists)tx.set(paymentRef,{...evidence,confirmacaoOficialRecebidaEm:now,evidenciaInfinitePayComplementadaEm:now},{merge:true});
    tx.set(checkoutRef,{...evidence,confirmacaoOficialRecebidaEm:now,evidenciaInfinitePayComplementadaEm:now,identificadoresPendentes:false,conciliacaoStatus:'confirmado',atualizadoEm:now},{merge:true});
  });
}
async function buildReceiptInfo(db, orderNsu){
  const snap=await db.collection('pagamentos_checkout').doc(orderNsu).get().catch(()=>null);
  if(!snap || !snap.exists) return null;
  const c={id:snap.id, ...snap.data()};
  return {
    id:c.id || orderNsu,
    orderNsu:c.orderNsu || orderNsu,
    tipo:c.tipo || 'entrada_conta_aluno',
    descricao:c.descricao || 'Pagamento Escola Piaget',
    pedidoId:c.pedidoId||null,
    pedidoTotalCentavos:c.pedidoTotalCentavos||0,
    alunoId:c.alunoId || null,
    alunosIds:Array.isArray(c.alunosIds)?c.alunosIds:[],
    alunoNome:c.alunoNome || null,
    turma:c.turma || null,
    matricula:c.matricula || null,
    responsavelFinanceiro:c.responsavelFinanceiro || null,
    totalCentavos:c.totalCentavos || c.amountCentavos || c.paidAmountCentavos || 0,
    status:c.status || 'aguardando_pagamento',
    statusAplicacao:c.statusAplicacao || 'pendente',
    saldoNoMomentoCentavos:c.saldoNoMomentoCentavos || 0,
    saldoEmAbertoNoMomentoCentavos:c.saldoEmAbertoNoMomentoCentavos || 0,
    transactionNsu:c.transactionNsu || '',
    invoiceSlug:c.invoiceSlug || '',
    receiptUrl:c.receiptUrl || '',
    captureMethod:c.captureMethod || '',
    amountCentavos:c.amountCentavos||0,
    paidAmountCentavos:c.paidAmountCentavos||0,
    criadoEm:c.criadoEm || null,
    pagamentoConfirmadoEm:c.pagamentoConfirmadoEm || null,
    confirmadoEm:c.confirmadoEm || null,
    customer:c.customer || null,
    resultadoOperacional:c.resultadoOperacional || null,
    erroAplicacao:c.erroAplicacao || null,
    origemConfirmacao:c.origemConfirmacao || null,
    reconciliacaoManual:Boolean(c.reconciliacaoManual),
    referenciaComprovanteInfinitePay:c.referenciaComprovanteInfinitePay || null,
    confirmacaoOficialRecebidaEm:c.confirmacaoOficialRecebidaEm || null,
    conciliacaoStatus:c.conciliacaoStatus || null
  };
}
async function confirmWithInfinitePay(db, params={}){
  const handle=normalizeHandle();
  const orderNsu=String(params.order_nsu || params.orderNsu || '').trim();
  if(!orderNsu) throw Object.assign(new Error('order_nsu ausente.'),{status:400});

  const checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu);
  const checkoutSnap=await checkoutRef.get();
  if(!checkoutSnap.exists) throw Object.assign(new Error('Este pedido não foi encontrado no sistema.'),{status:404});
  const checkout={id:checkoutSnap.id,...checkoutSnap.data(),orderNsu:checkoutSnap.id};

  const supplied={
    transaction_nsu:params.transaction_nsu||params.transactionNsu||'',
    slug:params.slug||params.invoice_slug||params.invoiceSlug||'',
    receipt_url:params.receipt_url||params.receiptUrl||'',
    capture_method:params.capture_method||params.captureMethod||''
  };
  const storedPayload=checkout.ultimoWebhookPayload||checkout.ultimoPaymentCheckPayload||checkout.ultimoRetornoPayload||{};
  const evidence=mergePaymentEvidence(supplied,checkout,storedPayload);

  await safeSet(checkoutRef,{
    ...evidence,
    ultimoRetornoRecebidoEm:(evidence.transactionNsu||evidence.invoiceSlug)?nowIso():(checkout.ultimoRetornoRecebidoEm||null),
    atualizadoEm:nowIso()
  });

  if(checkout.statusAplicacao==='aplicado'){
    await supplementAppliedPaymentEvidence(db,checkout,evidence,params.source||'retorno_tardio').catch(error=>console.warn('Falha ao complementar evidência tardia:',error.message));
    const refreshed=await checkoutRef.get().catch(()=>null),row=refreshed?.exists?{id:refreshed.id,...refreshed.data()}:checkout;
    return {paid:true,applicationPending:false,alreadyApplied:true,needsIdentifiers:false,diagnostic:checkoutPaymentDiagnostic(row),infinitepay:row.ultimoPaymentCheckPayload||{},receipt:await buildReceiptInfo(db,orderNsu)};
  }

  if(!evidence.transactionNsu || !evidence.invoiceSlug){
    const checkedAt=nowIso(),context=String(params.contexto||params.context||params.source||'consulta').trim()||'consulta';
    await safeSet(checkoutRef,{status:checkout.status||'aguardando_pagamento',identificadoresPendentes:true,conciliacaoStatus:'aguardando_retorno_infinitepay',conciliacaoOrigem:context,ultimaTentativaSincronizacaoEm:checkedAt,atualizadoEm:checkedAt});
    const row={...checkout,...evidence,identificadoresPendentes:true,conciliacaoStatus:'aguardando_retorno_infinitepay',ultimaTentativaSincronizacaoEm:checkedAt};
    return {paid:false,applicationPending:false,needsIdentifiers:true,missing:{transactionNsu:!evidence.transactionNsu,invoiceSlug:!evidence.invoiceSlug},message:'O checkout existe, mas a confirmação automática da InfinitePay ainda não retornou ao sistema.',diagnostic:checkoutPaymentDiagnostic(row),infinitepay:null,receipt:await buildReceiptInfo(db,orderNsu)};
  }

  const payload={handle,order_nsu:orderNsu,transaction_nsu:evidence.transactionNsu,slug:evidence.invoiceSlug};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  let response,text,data={};
  try{
    response=await fetch(INFINITE_PAYMENT_CHECK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    text=await response.text();
    try{data=JSON.parse(text)}catch{data={raw:text}}
  }catch(error){
    const timedOut=error?.name==='AbortError';
    await safeSet(checkoutRef,{ultimoPaymentCheckEm:nowIso(),ultimoPaymentCheckRequest:payload,ultimoPaymentCheckErro:{message:error.message,timedOut},atualizadoEm:nowIso()});
    throw Object.assign(new Error(timedOut?'A consulta à InfinitePay demorou além do limite. Tente atualizar novamente.':'Não foi possível comunicar com a InfinitePay agora.'),{status:timedOut?504:502});
  }finally{clearTimeout(timer)}

  await safeSet(checkoutRef,{ultimoPaymentCheckEm:nowIso(),ultimoPaymentCheckRequest:payload,ultimoPaymentCheckPayload:data,ultimoPaymentCheckHttpStatus:response.status,atualizadoEm:nowIso()});
  if(!response.ok){const error=new Error('A InfinitePay não conseguiu consultar este pagamento agora.');error.status=502;error.details=data;throw error;}

  const normalized=unwrapPaymentResponse(data);
  const paid=isPaidResponse(normalized);
  const merged={...normalized,transaction_nsu:evidence.transactionNsu,slug:evidence.invoiceSlug,receipt_url:evidence.receiptUrl||normalized.receipt_url||normalized.receiptUrl,capture_method:normalized.capture_method||normalized.captureMethod||evidence.captureMethod};
  let applicationPending=false,applicationError='';
  if(paid){
    try{await applyCheckoutConfirmation(db,orderNsu,merged,{source:params.source||'payment_check'});}
    catch(error){applicationPending=true;applicationError=String(error?.message||error);console.error('Pagamento localizado, mas aplicação operacional pendente:',orderNsu,error);}
  }else{
    await safeSet(checkoutRef,{ultimoPaymentCheckPago:false,atualizadoEm:nowIso()});
  }
  const refreshed=await checkoutRef.get().catch(()=>null),row=refreshed?.exists?{id:refreshed.id,...refreshed.data()}:{...checkout,...evidence};
  return {paid,applicationPending,applicationError,needsIdentifiers:false,diagnostic:checkoutPaymentDiagnostic(row),infinitepay:data,receipt:await buildReceiptInfo(db,orderNsu)};
}
async function applyAccountPaymentTx(tx, db, checkout, paymentData={}){
  const accRef=await accountRefForStudent(db,checkout.alunoId);
  const snap=await tx.get(accRef);
  const acc=snap.exists?snap.data():{};
  const total=cents(checkout.totalCentavos);
  const oldNet=accountNet(acc);
  const newNet=oldNet + total;
  const split=splitNet(newNet);
  const movRef=financialMovementRef(db,checkout,'entrada');
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
    subtipo: checkout.tratamentoSePago==='credito_conta_aluno' ? 'credito_cobranca_descartada' : 'pagamento_checkout_infinitepay',
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
  return {saldoAntesCentavos:oldNet,saldoDepoisCentavos:newNet};
}
async function applyCantinaOrderTx(tx,db,checkout,paymentData={}){
  const orderRef=db.collection('pedidos').doc(checkout.pedidoId);
  const orderSnap=await tx.get(orderRef);
  if(!orderSnap.exists) throw new Error('Pedido da cantina não encontrado.');
  const order={id:orderSnap.id,...orderSnap.data()};
  if(order.statusAplicacao==='aplicado') return {status:order.statusPedido==='confirmado'?'confirmado':'revisao',alreadyApplied:true,saldoDepoisCentavos:order.saldoDepoisCentavos};
  const accRef=await accountRefForStudent(db,order.alunoId);
  const accSnap=await tx.get(accRef);
  const acc=accSnap.exists?accSnap.data():{};
  const capacityRefs=(order.dias||[]).map(day=>({day,ref:db.collection('disponibilidade_salgados').doc(day.dataChave)}));
  const capacitySnaps=await Promise.all(capacityRefs.map(x=>tx.get(x.ref)));
  const externalPayment=cents(checkout.totalCentavos);
  const orderTotal=cents(order.totalCentavos);
  const oldNet=accountNet(acc);
  const afterPayment=oldNet+externalPayment;
  const finalNet=afterPayment-orderTotal;
  let reviewReason='';
  const cfg=await getConfig(db);
  if(finalNet<0) reviewReason='saldo_insuficiente_no_momento_da_confirmacao';
  for(let i=0;i<capacityRefs.length&&!reviewReason;i++){
    const current=capacitySnaps[i].exists?capacitySnaps[i].data():{},day=capacityRefs[i].day,info=lunchDayInfo(day.dataChave,current,cfg),used=dailyUsed(current,order.id);
    if(!info.active) reviewReason=`venda_lanche_desativada_${day.dataChave}`;
    else if(cents(day.quantidadeSalgados)>0&&used+cents(day.quantidadeSalgados)>info.capacity) reviewReason=`estoque_indisponivel_${day.dataChave}`;
  }
  const now=nowIso();
  const paymentMove=financialMovementRef(db,checkout,'entrada');
  if(reviewReason){
    const paymentNet=afterPayment;
    tx.set(accRef,{...splitNet(paymentNet),bloqueioSaldoSemanal:paymentNet<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:paymentNet<0&&cents(acc.limiteFiadoCentavos)>0&&Math.abs(paymentNet)>=cents(acc.limiteFiadoCentavos),atualizadoEm:now},{merge:true});
    if(externalPayment>0){
      tx.set(paymentMove,{id:paymentMove.id,alunoId:order.alunoId,tipo:'entrada_conta_aluno',subtipo:'pagamento_pedido_em_revisao',valorCentavos:externalPayment,saldoAntesCentavos:oldNet,saldoDepoisCentavos:paymentNet,formaPagamento:'checkout_infinitepay',orderNsu:checkout.orderNsu||checkout.id,pedidoId:order.id,status:'confirmado',dataChave:dateKey(),criadoEm:now,detalhesPagamento:paymentData});
    }
    for(let i=0;i<capacityRefs.length;i++){
      const current=capacitySnaps[i].exists?capacitySnaps[i].data():{};
      const reservas={...(current.reservas||{})};delete reservas[order.id];
      tx.set(capacityRefs[i].ref,{reservas,atualizadoEm:now},{merge:true});
    }
    tx.set(orderRef,{statusPagamento:'pago',statusPedido:'revisao',statusAplicacao:'aplicado',motivoRevisao:reviewReason,valorPagoExternoCentavos:externalPayment,saldoAntesCentavos:oldNet,saldoDepoisCentavos:paymentNet,pagamentoConfirmadoEm:now,atualizadoEm:now},{merge:true});
    return {status:'revisao',motivo:reviewReason,saldoDepoisCentavos:paymentNet};
  }
  const split=splitNet(finalNet);
  tx.set(accRef,{...split,bloqueioSaldoSemanal:finalNet<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:finalNet<0&&cents(acc.limiteFiadoCentavos)>0&&Math.abs(finalNet)>=cents(acc.limiteFiadoCentavos),ultimaRegularizacaoEm:finalNet>=0?now:(acc.ultimaRegularizacaoEm||null),atualizadoEm:now},{merge:true});
  if(externalPayment>0){
    tx.set(paymentMove,{id:paymentMove.id,alunoId:order.alunoId,tipo:'entrada_conta_aluno',subtipo:'pagamento_pedido_cantina',valorCentavos:externalPayment,saldoAntesCentavos:oldNet,saldoDepoisCentavos:afterPayment,formaPagamento:'checkout_infinitepay',orderNsu:checkout.orderNsu||checkout.id,pedidoId:order.id,status:'confirmado',dataChave:dateKey(),criadoEm:now,detalhesPagamento:paymentData});
  }
  const purchaseMove=financialMovementRef(db,checkout,'compra');
  tx.set(purchaseMove,{id:purchaseMove.id,alunoId:order.alunoId,tipo:'compra',subtipo:'pedido_cantina',valorCentavos:-orderTotal,valorCompraCentavos:orderTotal,saldoAntesCentavos:afterPayment,saldoDepoisCentavos:finalNet,pedidoId:order.id,itens:(order.dias||[]).flatMap(x=>x.itens||[]),origem:'pedido_antecipado',formaPagamento:externalPayment>0?(order.usarSaldo===true&&oldNet>0?'saldo_e_checkout':'checkout_infinitepay'):'saldo_conta',status:'confirmado',dataChave:dateKey(),criadoEm:now});
  for(let i=0;i<capacityRefs.length;i++){
    const current=capacitySnaps[i].exists?capacitySnaps[i].data():{};
    const reservas={...(current.reservas||{})};delete reservas[order.id];
    tx.set(capacityRefs[i].ref,{reservas,pedidosConfirmados:cents(current.pedidosConfirmados)+capacityRefs[i].day.quantidadeSalgados,atualizadoEm:now},{merge:true});
  }
  for(const day of order.dias||[]){
    const occurrenceRef=db.collection('ocorrencias_entrega').doc(`${order.id}__${day.dataChave}`);
    tx.set(occurrenceRef,{
      id:occurrenceRef.id,
      pedidoId:order.id,
      alunoId:order.alunoId,
      alunoNome:order.alunoNome,
      turma:order.turma||null,
      turno:order.turno||day.turno||null,
      matricula:order.matricula||null,
      dataChave:day.dataChave,
      itens:day.itens||[],
      componentes:day.componentes||[],
      quantidadeSalgados:cents(day.quantidadeSalgados),
      valorCentavos:cents(day.totalCentavos),
      status:'pendente_entrega',
      statusPagamento:'pago',
      origem:'pedido_antecipado',
      criadoEm:now,
      atualizadoEm:now,
      versao:'1.6.0-rc2.7.24'
    },{merge:false});
  }
  tx.set(orderRef,{statusPagamento:'pago',statusPedido:'confirmado',statusAplicacao:'aplicado',valorPagoExternoCentavos:externalPayment,valorDebitadoContaCentavos:orderTotal,valorSaldoAnteriorUtilizadoCentavos:order.usarSaldo===true?Math.min(Math.max(oldNet,0),orderTotal):0,saldoAntesCentavos:oldNet,saldoDepoisCentavos:finalNet,pagamentoConfirmadoEm:now,confirmadoEm:now,atualizadoEm:now},{merge:true});
  return {status:'confirmado',saldoDepoisCentavos:finalNet};
}
async function confirmCantinaOrderWithoutCheckout(db,pedidoId,actor={id:'portal_responsavel',nome:'Responsável',perfil:'responsavel'}){
  const pseudoCheckout={id:`SALDO-${pedidoId}`,orderNsu:`SALDO-${pedidoId}`,pedidoId,totalCentavos:0,tipo:'pedido_cantina'};
  let result;
  await db.runTransaction(async tx=>{ result=await applyCantinaOrderTx(tx,db,pseudoCheckout,{origem:'saldo_conta'}); });
  const orderSnap=await db.collection('pedidos').doc(pedidoId).get();
  const order=orderSnap.exists?orderSnap.data():{};
  await audit(db,result.status==='confirmado'?'pedido_cantina_confirmado':'pedido_cantina_revisao',{
    pedidoId,alunoId:order.alunoId,alunoNome:order.alunoNome,valorCentavos:order.totalCentavos,
    criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,
    severidade:result.status==='confirmado'?'info':'warning',
    descricaoHumana:result.status==='confirmado'?`Pedido de cantina de ${order.alunoNome||'aluno'} confirmado usando o saldo da conta.`:`Pedido de cantina de ${order.alunoNome||'aluno'} foi enviado para revisão.`
  });
  if(result.status==='confirmado'){
    await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Novo pedido de cantina',mensagem:`${order.alunoNome||'Aluno'}: ${(order.dias||[]).length} entrega(s) adicionada(s) à agenda da cantina.`,prioridade:'normal',alunoId:order.alunoId,alunoNome:order.alunoNome,matricula:order.matricula,pedidoId,origem:actor.perfil==='responsavel'?'portal_responsavel':actor.perfil,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,destinatariosPerfis:['cantina','admin','gestao','secretaria'],destinatariosAlunos:[],acaoPrincipal:'abrir_entregas',acaoLabel:'Ver agenda da cantina'});
    await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Pedido de cantina confirmado',mensagem:`Pagamento confirmado. ${(order.dias||[]).length} entrega(s) programada(s), aguardando entrega.`,prioridade:'normal',alunoId:order.alunoId,alunoNome:order.alunoNome,matricula:order.matricula,pedidoId,origem:actor.perfil==='responsavel'?'portal_responsavel':actor.perfil,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,destinatariosPerfis:[],destinatariosAlunos:[order.alunoId],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
  }
  return result;
}

async function applyUniformOrderTx(tx,db,checkout,paymentData={}){
  const orderRef=db.collection('pedidos_farda').doc(checkout.pedidoId),orderSnap=await tx.get(orderRef);if(!orderSnap.exists)throw new Error('Pedido de fardamento não encontrado.');const order={id:orderSnap.id,...orderSnap.data()};if(order.statusAplicacao==='aplicado')return {status:'confirmado',alreadyApplied:true,saldoDepoisCentavos:order.saldoDepoisCentavos,statusAtendimento:order.statusAtendimento};
  const accRef=await accountRefForStudent(db,order.alunoId),stockRef=db.collection('estoques').doc(uniformStockId(order.modeloFardaId||'camisa_padrao',order.tamanho,order.modelo||'')),accSnap=await tx.get(accRef),stockSnap=await tx.get(stockRef),acc=accSnap.exists?accSnap.data():{},stock=stockSnap.exists?stockSnap.data():{},external=cents(checkout.totalCentavos),total=cents(order.totalCentavos),before=accountNet(acc),afterPayment=before+external,after=afterPayment-total,now=nowIso();if(after<0)throw new Error('O pagamento não é suficiente para concluir o pedido de fardamento.');
  const line={tipo:'farda',modeloFardaId:order.modeloFardaId||'camisa_padrao',tamanho:order.tamanho,modelo:order.modelo||'',quantidade:order.quantidade},req={stockId:stockRef.id,quantidade:order.quantidade},stockUpdate=allocateUniformRequirement(stock,req,[line],now),atendimento=line.statusAtendimento;
  tx.set(accRef,{...splitNet(after),bloqueioSaldoSemanal:false,bloqueadoPorLimite:false,ultimaRegularizacaoEm:now,atualizadoEm:now},{merge:true});if(external>0){const m=financialMovementRef(db,checkout,'entrada');tx.set(m,{id:m.id,alunoId:order.alunoId,tipo:'entrada_conta_aluno',subtipo:'pagamento_pedido_farda',valorCentavos:external,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,formaPagamento:'checkout_infinitepay',orderNsu:checkout.orderNsu||checkout.id,pedidoId:order.id,status:'confirmado',dataChave:dateKey(),criadoEm:now,detalhesPagamento:paymentData})}const purchase=financialMovementRef(db,checkout,'compra');tx.set(purchase,{id:purchase.id,alunoId:order.alunoId,tipo:'compra',subtipo:'pedido_farda',valorCentavos:-total,valorCompraCentavos:total,saldoAntesCentavos:afterPayment,saldoDepoisCentavos:after,pedidoId:order.id,itens:[{nome:order.produto||'Camisa de farda',quantidade:order.quantidade,tamanho:order.tamanho,modelo:order.modelo,precoUnitarioCentavos:order.precoUnitarioCentavos}],origem:'pedido_fardamento',formaPagamento:external>0?(order.usarSaldo===true&&before>0?'saldo_e_checkout':'checkout_infinitepay'):'saldo_conta',status:'confirmado',dataChave:dateKey(),criadoEm:now});tx.set(stockRef,stockUpdate,{merge:true});tx.set(orderRef,{statusPagamento:'pago',statusAtendimento:atendimento,statusAplicacao:'aplicado',quantidadeReservadaEstoque:line.quantidadeReservadaEstoque||0,quantidadeAguardandoProducao:line.quantidadeAguardandoProducao||0,estoqueReservado:Number(line.quantidadeReservadaEstoque||0)>0,valorPagoExternoCentavos:external,valorDebitadoContaCentavos:total,valorSaldoAnteriorUtilizadoCentavos:order.usarSaldo===true?Math.min(Math.max(before,0),total):0,saldoAntesCentavos:before,saldoDepoisCentavos:after,pagamentoConfirmadoEm:now,confirmadoEm:now,atualizadoEm:now},{merge:true});return {status:'confirmado',saldoDepoisCentavos:after,statusAtendimento:atendimento,quantidadeAguardandoProducao:line.quantidadeAguardandoProducao||0};
}
async function confirmUniformOrderWithoutCheckout(db,pedidoId,actor={id:'portal_responsavel',nome:'Responsável',perfil:'responsavel'}){
  const pseudo={id:`SALDO-FARDA-${pedidoId}`,orderNsu:`SALDO-FARDA-${pedidoId}`,pedidoId,totalCentavos:0,tipo:'pedido_farda'};let result;
  await db.runTransaction(async tx=>{result=await applyUniformOrderTx(tx,db,pseudo,{origem:'saldo_conta'});});
  const snap=await db.collection('pedidos_farda').doc(pedidoId).get(),order=snap.exists?snap.data():{};
  await audit(db,'pedido_farda_confirmado',{pedidoId,alunoId:order.alunoId,alunoNome:order.alunoNome,valorCentavos:order.totalCentavos,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,descricaoHumana:`Pedido de fardamento de ${order.alunoNome||'aluno'} confirmado.`});
  await notify(db,{tipo:'pedido_farda_confirmado',titulo:'Novo pedido de fardamento',mensagem:`${order.alunoNome||'Aluno'} realizou um pedido de fardamento.`,alunoId:order.alunoId,alunoNome:order.alunoNome,matricula:order.matricula,pedidoId,destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[],acaoPrincipal:'abrir_fardas',acaoLabel:'Ver fardas'});
  await notify(db,{tipo:'pedido_farda_confirmado',titulo:'Pedido de fardamento confirmado',mensagem:result.statusAtendimento==='reservado_estoque'?'Pagamento confirmado. A farda foi reservada e aguarda retirada.':'Pagamento confirmado. O pedido aguarda produção.',alunoId:order.alunoId,alunoNome:order.alunoNome,matricula:order.matricula,pedidoId,destinatariosPerfis:[],destinatariosAlunos:[order.alunoId],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
  return result;
}

async function applyOnlineSecretarySaleTx(tx,db,checkout,paymentData={}){
  const payload=checkout.payloadOperacional||{},lines=Array.isArray(payload.itens)?payload.itens:[],components=Array.isArray(payload.componentes)?payload.componentes:[],catalogStock=Array.isArray(payload.estoquesCatalogo)?payload.estoquesCatalogo:[],uniformStock=Array.isArray(payload.estoquesFarda)?payload.estoquesFarda:[],programacoes=Array.isArray(payload.programacoes)?payload.programacoes:[],alunosIds=Array.isArray(payload.alunosIds)&&payload.alunosIds.length?payload.alunosIds:(Array.isArray(checkout.alunosIds)&&checkout.alunosIds.length?checkout.alunosIds:[checkout.alunoId].filter(Boolean)),total=cents(checkout.pedidoTotalCentavos||payload.pedidoTotalCentavos),external=cents(checkout.totalCentavos),accRef=await accountRefForStudent(db,checkout.alunoId),saleRef=db.collection('vendas').doc(`ONLINE-${safeFinancialId(checkout.orderNsu||checkout.id)}`),linkRef=checkout.vendaOnlineId?db.collection('vendas_online_links').doc(checkout.vendaOnlineId):null;
  const salgadoQty=components.filter(x=>x.produtoId==='salgado').reduce((sum,x)=>sum+cents(x.quantidade),0),stockRef=salgadoQty>0?db.collection('disponibilidade_salgados').doc(dateKey()):null,catalogRefs=catalogStock.map(x=>({line:x,ref:db.collection('catalogo_itens').doc(x.itemId)})),uniformStockRefs=uniformStock.map(x=>({line:x,ref:db.collection('estoques').doc(x.stockId)}));
  const scheduleByDate=new Map();programacoes.forEach((p,pi)=>(p.days||[]).forEach(day=>{const key=day.dataChave,entry=scheduleByDate.get(key)||{day:key,quantidadeSalgados:0};entry.quantidadeSalgados+=cents(day.quantidadeSalgados);scheduleByDate.set(key,entry)}));
  const scheduleStockRefs=[...scheduleByDate.values()].map(x=>({...x,ref:db.collection('disponibilidade_salgados').doc(x.day)})),orderRefs=programacoes.map((p,i)=>db.collection('pedidos').doc(`${saleRef.id}__L${i+1}`)),occurrenceRefs=programacoes.map((p,i)=>(p.days||[]).map(day=>db.collection('ocorrencias_entrega').doc(`${orderRefs[i].id}__${day.dataChave}`))),uniformOrderRefs=lines.filter(x=>x.tipo==='farda').map((x,i)=>db.collection('pedidos_farda').doc(`${saleRef.id}__F${i+1}`)),operationalLines=lines.filter(x=>x.tipo==='catalogo_item'),operationalRefs=operationalLines.map((x,i)=>db.collection('pedidos_operacionais').doc(`${saleRef.id}__O${i+1}`));
  const readRefs=[accRef,saleRef,...(stockRef?[stockRef]:[]),...(linkRef?[linkRef]:[]),...catalogRefs.map(x=>x.ref),...uniformStockRefs.map(x=>x.ref),...scheduleStockRefs.map(x=>x.ref)],snaps=await Promise.all(readRefs.map(r=>tx.get(r)));let pos=0;const accSnap=snaps[pos++],saleSnap=snaps[pos++],stockSnap=stockRef?snaps[pos++]:null,linkSnap=linkRef?snaps[pos++]:null,catalogSnaps=catalogRefs.map(()=>snaps[pos++]),uniformStockSnaps=uniformStockRefs.map(()=>snaps[pos++]),scheduleSnaps=scheduleStockRefs.map(()=>snaps[pos++]);
  if(saleSnap.exists&&saleSnap.data()?.status==='confirmada')return{status:'confirmado',alreadyApplied:true,saldoDepoisCentavos:saleSnap.data().saldoDepoisCentavos};
  const acc=accSnap.exists?accSnap.data():{},before=accountNet(acc),afterPayment=before+external,after=afterPayment-total,now=nowIso(),cfg=await getConfig(db);let reviewReason='';
  if(after<0)reviewReason='saldo_insuficiente_no_momento_da_confirmacao';
  if(stockRef&&!reviewReason){const stock=stockSnap&&stockSnap.exists?stockSnap.data():{},info=lunchDayInfo(dateKey(),stock,cfg);if(!info.active)reviewReason='venda_lanche_desativada_no_momento_do_pagamento';else if(info.used+salgadoQty>info.capacity)reviewReason='estoque_indisponivel_no_momento_do_pagamento';}
  if(!reviewReason)catalogRefs.forEach((entry,i)=>{const doc=catalogSnaps[i].exists?catalogSnaps[i].data():{},available=catalogAvailableUnits(doc,entry.line);if(available<entry.line.quantidade)reviewReason=`estoque_catalogo_indisponivel:${entry.line.itemId}`;});
  if(!reviewReason)scheduleStockRefs.forEach((entry,i)=>{if(reviewReason)return;const stock=scheduleSnaps[i].exists?scheduleSnaps[i].data():{},info=lunchDayInfo(entry.day,stock,cfg);if(!info.active)reviewReason=`venda_lanche_desativada:${entry.day}`;else if(info.used+entry.quantidadeSalgados>info.capacity)reviewReason=`estoque_programacao_indisponivel:${entry.day}`;});
  const uniformUpdates=!reviewReason?uniformStockRefs.map((entry,i)=>allocateUniformRequirement(uniformStockSnaps[i].exists?uniformStockSnaps[i].data():{},entry.line,lines,now)):[];
  const entryRef=financialMovementRef(db,checkout,'entrada'),purchaseRef=financialMovementRef(db,checkout,'compra');
  if(reviewReason){
    tx.set(accRef,{...splitNet(afterPayment),bloqueioSaldoSemanal:afterPayment<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:afterPayment<0&&cents(acc.limiteFiadoCentavos)>0&&Math.abs(afterPayment)>=cents(acc.limiteFiadoCentavos),atualizadoEm:now},{merge:true});
    if(external>0)tx.set(entryRef,{id:entryRef.id,alunoId:checkout.alunoId,alunosIds,tipo:'entrada_conta_aluno',subtipo:'pagamento_venda_online_em_revisao',valorCentavos:external,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,formaPagamento:'checkout_infinitepay',orderNsu:checkout.orderNsu||checkout.id,status:'confirmado',dataChave:dateKey(),criadoEm:now,detalhesPagamento:paymentData});
    tx.set(saleRef,{id:saleRef.id,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula||null,alunosIds,origem:'secretaria_online',orderNsu:checkout.orderNsu||checkout.id,valorBrutoCentavos:total,valorPagoExternoCentavos:external,itens:lines,status:'revisao',motivoRevisao:reviewReason,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,dataChave:dateKey(),criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});
    if(linkRef)tx.set(linkRef,{status:'pago_revisao',motivoRevisao:reviewReason,orderNsu:checkout.orderNsu||checkout.id,pagoEm:now,atualizadoEm:now},{merge:true});
    return{status:'revisao',motivo:reviewReason,saldoDepoisCentavos:afterPayment};
  }
  tx.set(accRef,{...splitNet(after),bloqueioSaldoSemanal:after<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:after<0&&cents(acc.limiteFiadoCentavos)>0&&Math.abs(after)>=cents(acc.limiteFiadoCentavos),ultimaRegularizacaoEm:after>=0?now:(acc.ultimaRegularizacaoEm||null),atualizadoEm:now},{merge:true});
  if(external>0)tx.set(entryRef,{id:entryRef.id,alunoId:checkout.alunoId,alunosIds,tipo:'entrada_conta_aluno',subtipo:'pagamento_venda_online_secretaria',valorCentavos:external,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,formaPagamento:'checkout_infinitepay',orderNsu:checkout.orderNsu||checkout.id,vendaId:saleRef.id,status:'confirmado',dataChave:dateKey(),criadoEm:now,detalhesPagamento:paymentData});
  tx.set(purchaseRef,{id:purchaseRef.id,alunoId:checkout.alunoId,alunosIds,tipo:'compra',subtipo:'venda_secretaria_online',valorCentavos:-total,valorCompraCentavos:total,saldoAntesCentavos:afterPayment,saldoDepoisCentavos:after,vendaId:saleRef.id,itens:lines,origem:'secretaria_online',formaPagamento:external>0?(payload.usarSaldo===true&&before>0?'saldo_e_checkout':'checkout_infinitepay'):'saldo_conta',orderNsu:checkout.orderNsu||checkout.id,status:'confirmado',dataChave:dateKey(),criadoEm:now});
  tx.set(saleRef,{id:saleRef.id,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula||null,alunosIds,origem:'secretaria_online',orderNsu:checkout.orderNsu||checkout.id,operadorId:checkout.criadoPorId||null,operadorNome:checkout.criadoPorNome||'Secretaria',formaPagamento:external>0?'checkout_infinitepay':'saldo_conta',valorBrutoCentavos:total,valorRecebidoCentavos:external,valorSaldoUtilizadoCentavos:Math.max(0,total-external-Math.max(0,-before)),itens:lines,pedidosCantinaIds:orderRefs.map(r=>r.id),pedidosFardaIds:uniformOrderRefs.map(r=>r.id),pedidosOperacionaisIds:operationalRefs.map(r=>r.id),dataChave:dateKey(),criadoEm:now,atualizadoEm:now,status:'confirmada',saldoAntesCentavos:before,saldoDepoisCentavos:after,schemaVersion:6,versao:'1.6.0-rc2.7.24'},{merge:true});
  if(stockRef){const stock=stockSnap&&stockSnap.exists?stockSnap.data():{},info=lunchDayInfo(dateKey(),stock,cfg);tx.set(stockRef,{dataChave:dateKey(),quantidadePlanejada:info.planned,vendidoAvulso:cents(stock.vendidoAvulso)+salgadoQty,atualizadoEm:now},{merge:true});}
  catalogRefs.forEach((entry,i)=>{const doc=catalogSnaps[i].exists?catalogSnaps[i].data():{};tx.set(entry.ref,catalogStockUpdate(doc,entry.line,now),{merge:true});});
  uniformStockRefs.forEach((entry,i)=>tx.set(entry.ref,uniformUpdates[i],{merge:true}));
  scheduleStockRefs.forEach((entry,i)=>{const stock=scheduleSnaps[i].exists?scheduleSnaps[i].data():{},info=lunchDayInfo(entry.day,stock,cfg);tx.set(entry.ref,{dataChave:entry.day,quantidadePlanejada:info.planned,pedidosConfirmados:cents(stock.pedidosConfirmados)+entry.quantidadeSalgados,atualizadoEm:now},{merge:true});});
  operationalLines.forEach((line,i)=>{const or=operationalRefs[i],cat=operationalOrderCategory(line),status=operationalOrderInitialStatus(line);tx.set(or,{id:or.id,vendaId:saleRef.id,orderNsu:checkout.orderNsu||checkout.id,alunoId:line.alunoId||checkout.alunoId,alunoNome:line.alunoNome||checkout.alunoNome,turma:line.turma||checkout.turma||null,matricula:line.matricula||checkout.matricula||null,responsavelFinanceiroId:line.responsavelFinanceiroId||checkout.responsavelFinanceiroId||null,categoriaPedido:cat,tipoOperacional:line.tipoOperacional||'servico',nome:line.nome,descricao:line.descricao||'',quantidade:line.quantidade,precoUnitarioCentavos:line.precoUnitarioCentavos,totalCentavos:line.totalCentavos,statusPagamento:'pago',statusAtendimento:status,origem:'secretaria_online',criadoPorId:checkout.criadoPorId||null,criadoPorNome:checkout.criadoPorNome||'Secretaria',criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});});
  programacoes.forEach((program,i)=>{const orderRef=orderRefs[i];tx.set(orderRef,{id:orderRef.id,vendaId:saleRef.id,orderNsu:checkout.orderNsu||checkout.id,alunoId:program.alunoId||checkout.alunoId,alunoNome:program.alunoNome||checkout.alunoNome,turma:program.turma||checkout.turma||null,turno:program.turno||checkout.turno||null,matricula:program.matricula||checkout.matricula||null,responsavelFinanceiroId:program.responsavelFinanceiroId||checkout.responsavelFinanceiroId||null,tipoPedido:'cantina',modalidade:program.modalidade,dias:program.days,totalCentavos:program.totalCentavos,usarSaldo:payload.usarSaldo===true,statusPagamento:'pago',statusPedido:'confirmado',statusAplicacao:'aplicado',origem:'secretaria_online_venda_mista',criadoPorId:checkout.criadoPorId||null,criadoPorNome:checkout.criadoPorNome||'Secretaria',criadoEm:now,confirmadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});(program.days||[]).forEach((day,j)=>{const occurrenceRef=occurrenceRefs[i][j];tx.set(occurrenceRef,{id:occurrenceRef.id,pedidoId:orderRef.id,vendaId:saleRef.id,orderNsu:checkout.orderNsu||checkout.id,alunoId:program.alunoId||checkout.alunoId,alunoNome:program.alunoNome||checkout.alunoNome,turma:program.turma||checkout.turma||null,turno:program.turno||day.turno||checkout.turno||null,matricula:program.matricula||checkout.matricula||null,responsavelFinanceiroId:program.responsavelFinanceiroId||checkout.responsavelFinanceiroId||null,dataChave:day.dataChave,itens:day.itens||[],componentes:day.componentes||[],quantidadeSalgados:cents(day.quantidadeSalgados),valorCentavos:cents(day.totalCentavos),status:'pendente_entrega',statusPagamento:'pago',origem:'secretaria_online_venda_mista',criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});});});
  let idx=0;for(const line of lines.filter(x=>x.tipo==='farda')){const fr=uniformOrderRefs[idx++];tx.set(fr,{id:fr.id,vendaId:saleRef.id,orderNsu:checkout.orderNsu||checkout.id,alunoId:line.alunoId||checkout.alunoId,alunoNome:line.alunoNome||checkout.alunoNome,turma:line.turma||checkout.turma||null,matricula:line.matricula||checkout.matricula||null,responsavelFinanceiroId:line.responsavelFinanceiroId||checkout.responsavelFinanceiroId||null,produto:line.nome,tamanho:line.tamanho||'',modelo:line.modelo||'',modeloFardaId:line.modeloFardaId||'catalogo',catalogoItemId:line.catalogoItemId||null,quantidade:line.quantidade,precoUnitarioCentavos:line.precoUnitarioCentavos,totalCentavos:line.totalCentavos,statusPagamento:'pago',statusAtendimento:line.statusAtendimento||'aguardando_producao',quantidadeReservadaEstoque:cents(line.quantidadeReservadaEstoque),quantidadeAguardandoProducao:cents(line.quantidadeAguardandoProducao),estoqueReservado:cents(line.quantidadeReservadaEstoque)>0,solicitadoVia:'secretaria_online',criadoPor:checkout.criadoPorId||'secretaria_online',criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});}
  if(linkRef)tx.set(linkRef,{status:'pago',orderNsu:checkout.orderNsu||checkout.id,vendaId:saleRef.id,pagoEm:now,atualizadoEm:now},{merge:true});
  return{status:'confirmado',vendaId:saleRef.id,pedidosCantinaIds:orderRefs.map(r=>r.id),pedidosFardaIds:uniformOrderRefs.map(r=>r.id),pedidosOperacionaisIds:operationalRefs.map(r=>r.id),quantidadeEntregas:programacoes.reduce((n,p)=>n+(p.days||[]).length,0),saldoDepoisCentavos:after};
}

async function applyCheckoutConfirmation(db, orderNsu, paymentData={}, options={}){
  const checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu);
  const snap=await checkoutRef.get();
  if(!snap.exists) throw Object.assign(new Error('Pedido de checkout não encontrado no sistema.'),{status:404});
  const checkout={id:snap.id,...snap.data(),orderNsu:snap.id};
  const evidence=mergePaymentEvidence(paymentData,checkout,checkout.ultimoWebhookPayload||{},checkout.ultimoPaymentCheckPayload||{});
  validatePaidCheckout(checkout,paymentData,evidence);
  const manualReconciliation=options.source==='reconciliacao_manual_infinitepay';
  const confirmationMeta={
    origemConfirmacao:manualReconciliation?'reconciliacao_manual_infinitepay':'infinitepay',
    reconciliacaoManual:manualReconciliation,
    referenciaComprovanteInfinitePay:manualReconciliation?String(options.referenciaComprovanteInfinitePay||paymentData.referencia_comprovante||'').trim():(checkout.referenciaComprovanteInfinitePay||null),
    confirmadoPorId:manualReconciliation?(options.actor?.id||null):(checkout.confirmadoPorId||null),
    confirmadoPorNome:manualReconciliation?(options.actor?.nome||null):(checkout.confirmadoPorNome||null),
    confirmadoPorPerfil:manualReconciliation?(options.actor?.perfil||null):(checkout.confirmadoPorPerfil||null)
  };
  if(!options.eventAlreadyRecorded)await recordInfinitePayEvent(db,orderNsu,paymentData,options.source||'confirmacao_pagamento');

  if(checkout.statusAplicacao!=='aplicado'&&checkout.ignorarConfirmacaoPosterior===true){
    await safeSet(checkoutRef,{...evidence,status:'confirmacao_ignorada_valor_devolvido',statusAplicacao:'encerrado_sem_lancamento',ignorarConfirmacaoPosterior:true,ultimoPayloadConfirmado:paymentData,pagamentoLocalizadoEm:nowIso(),atualizadoEm:nowIso()});
    await audit(db,'checkout_confirmacao_ignorada_valor_devolvido',{orderNsu,alunoId:checkout.alunoId||null,alunoNome:checkout.alunoNome||null,valorCentavos:checkout.totalCentavos||0,descricaoHumana:'A confirmação tardia foi registrada, mas não gerou movimento porque a cobrança havia sido encerrada sem lançamento.'});
    return {ok:true,ignored:true,reason:'valor_devolvido_externamente'};
  }

  await safeSet(checkoutRef,{
    ...evidence,
    status:checkout.statusAplicacao==='aplicado'?'pago':'pagamento_localizado_processando',
    statusAplicacao:checkout.statusAplicacao==='aplicado'?'aplicado':'processando',
    ultimoWebhookPayload:options.source==='webhook'?paymentData:(checkout.ultimoWebhookPayload||null),
    ultimoPayloadConfirmado:paymentData,
    pagamentoLocalizadoEm:nowIso(),
    ...confirmationMeta,
    conciliacaoStatus:'processando',
    atualizadoEm:nowIso()
  });
  if(checkout.statusAplicacao==='aplicado')return {ok:true,alreadyApplied:true};

  let operationResult={status:'confirmado'},alreadyAppliedInside=false;
  try{
    await db.runTransaction(async tx=>{
      const transactionRef=db.collection('transacoes_infinitepay').doc(safeFinancialId(evidence.transactionNsu));
      const payRef=db.collection('pagamentos').doc(orderNsu);
      // Leituras globais primeiro. As operações específicas também concluem suas leituras antes de gravar.
      const [fresh,transactionSnap,paymentSnap]=await Promise.all([tx.get(checkoutRef),tx.get(transactionRef),tx.get(payRef)]);
      if(!fresh.exists)throw new Error('Pedido de checkout não encontrado durante o processamento.');
      const c={id:fresh.id,...fresh.data(),orderNsu:fresh.id};
      if(c.statusAplicacao==='aplicado'){alreadyAppliedInside=true;return;}
      if(transactionSnap.exists){
        const lock=transactionSnap.data()||{};
        if(lock.orderNsu&&lock.orderNsu!==orderNsu){const error=new Error('Esta transação da InfinitePay já está vinculada a outro pedido.');error.code='TRANSACTION_ALREADY_USED';throw error;}
      }
      if(paymentSnap.exists){
        const existing=paymentSnap.data()||{};
        if(existing.transactionNsu&&existing.transactionNsu!==evidence.transactionNsu){const error=new Error('O pedido já possui outro NSU de transação confirmado.');error.code='ORDER_HAS_DIFFERENT_TRANSACTION';throw error;}
      }
      if(!['entrada_conta_aluno','pedido_cantina','pedido_farda','venda_online_secretaria'].includes(c.tipo))throw new Error(`Tipo de checkout não suportado: ${c.tipo||'não informado'}.`);
      const discarded=['descartado_responsavel','substituido_nova_cobranca'].includes(c.status)||c.tratamentoSePago==='credito_conta_aluno';
      if(discarded){
        operationResult=await applyAccountPaymentTx(tx,db,{...c,tipo:'entrada_conta_aluno',descricao:`Crédito de cobrança descartada - ${c.alunoNome||'Aluno'}`},paymentData);
        operationResult={...operationResult,status:'credito_conta_sem_pedido',cobrancaDescartada:true};
      }else{
        if(c.tipo==='entrada_conta_aluno')operationResult=await applyAccountPaymentTx(tx,db,c,paymentData);
        if(c.tipo==='pedido_cantina')operationResult=await applyCantinaOrderTx(tx,db,c,paymentData);
        if(c.tipo==='pedido_farda')operationResult=await applyUniformOrderTx(tx,db,c,paymentData);
        if(c.tipo==='venda_online_secretaria')operationResult=await applyOnlineSecretarySaleTx(tx,db,c,paymentData);
      }

      const now=nowIso();
      tx.set(transactionRef,{id:transactionRef.id,transactionNsu:evidence.transactionNsu,orderNsu,pedidoId:c.pedidoId||null,alunoId:c.alunoId||null,alunosIds:Array.isArray(c.alunosIds)?c.alunosIds:[],amountCentavos:evidence.amountCentavos,status:'aplicado',origemConfirmacao:confirmationMeta.origemConfirmacao,reconciliacaoManual:manualReconciliation,referenciaComprovanteInfinitePay:confirmationMeta.referenciaComprovanteInfinitePay||null,confirmadoEm:now,atualizadoEm:now},{merge:true});
      tx.set(payRef,{id:orderNsu,orderNsu,pedidoId:c.pedidoId||null,alunoId:c.alunoId||null,alunoNome:c.alunoNome||null,alunosIds:Array.isArray(c.alunosIds)?c.alunosIds:[],valorBrutoCentavos:c.totalCentavos,pedidoTotalCentavos:c.pedidoTotalCentavos||0,formaPagamento:'checkout_infinitepay',status:'confirmado',origem:'checkout_infinitepay',tipo:c.tipo,...evidence,...confirmationMeta,paidAmountCentavos:evidence.paidAmountCentavos||cents(c.totalCentavos),amountCentavos:evidence.amountCentavos||cents(c.totalCentavos),dataChave:dateKey(),criadoEm:c.pagamentoConfirmadoEm||now,confirmadoEm:now,payloadInfinitePay:paymentData},{merge:true});
      tx.set(checkoutRef,{status:operationResult.cobrancaDescartada?'pago_descartado_creditado':'pago',statusAplicacao:'aplicado',resultadoOperacional:operationResult.status||'confirmado',pagamentoConfirmadoEm:now,...evidence,...confirmationMeta,paidAmountCentavos:evidence.paidAmountCentavos||cents(c.totalCentavos),amountCentavos:evidence.amountCentavos||cents(c.totalCentavos),ultimoPayloadConfirmado:paymentData,erroAplicacao:null,identificadoresPendentes:false,conciliacaoStatus:'confirmado',atualizadoEm:now},{merge:true});
    });
  }catch(error){
    await safeSet(checkoutRef,{...evidence,status:'pagamento_localizado_aguardando_processamento',statusAplicacao:'erro_processamento',erroAplicacao:compactError(error),ultimoPayloadConfirmado:paymentData,atualizadoEm:nowIso()});
    throw error;
  }
  if(alreadyAppliedInside)return {ok:true,alreadyApplied:true};
  if(checkout.vendaOnlineId)await safeSet(db.collection('vendas_online_links').doc(checkout.vendaOnlineId),{status:operationResult.status==='revisao'?'pago_revisao':'pago',orderNsu,pedidoId:checkout.pedidoId||null,vendaId:operationResult.vendaId||null,pagoEm:nowIso(),atualizadoEm:nowIso()});

  await audit(db,manualReconciliation?'checkout_pagamento_reconciliado_manual':'checkout_pagamento_confirmado',{orderNsu,pagamentoId:orderNsu,pedidoId:checkout.pedidoId||null,tipo:checkout.tipo,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:checkout.totalCentavos,usuarioId:options.actor?.id||undefined,usuarioNome:options.actor?.nome||undefined,usuarioPerfil:options.actor?.perfil||undefined,referenciaComprovanteInfinitePay:confirmationMeta.referenciaComprovanteInfinitePay||null,severidade:manualReconciliation?'warning':'info',descricaoHumana:manualReconciliation?`${options.actor?.nome||'Equipe'} confirmou manualmente o recebimento InfinitePay de ${brl(checkout.totalCentavos)} para ${checkout.alunoNome||'operação'}, após conferência externa.`:`Pagamento InfinitePay de ${brl(checkout.totalCentavos)} confirmado para ${checkout.alunoNome||'operação avulsa'}.`});
  if(operationResult.cobrancaDescartada){
    await audit(db,'checkout_descartado_pago_creditado',{orderNsu,pagamentoId:orderNsu,pedidoId:checkout.pedidoId||null,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:checkout.totalCentavos,severidade:'warning',descricaoHumana:`Uma cobrança descartada foi paga posteriormente. O valor de ${brl(checkout.totalCentavos)} foi creditado na conta do aluno sem repetir o pedido.`});
    await notify(db,{tipo:'checkout_descartado_pago_creditado',titulo:'Cobrança descartada foi paga',mensagem:`O valor de ${brl(checkout.totalCentavos)} foi creditado na conta de ${checkout.alunoNome||'aluno'} sem repetir o pedido.`,prioridade:'alta',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId||null,origem:'infinitepay',canal:'online',destinatariosPerfis:['admin','gestao','secretaria'],acaoPrincipal:'abrir_aluno',acaoLabel:'Ver conta do aluno'});
  }else if(checkout.tipo==='venda_online_secretaria'){
    const familyIds=(Array.isArray(checkout.alunosIds)&&checkout.alunosIds.length?checkout.alunosIds:(Array.isArray(checkout.payloadOperacional?.alunosIds)?checkout.payloadOperacional.alunosIds:[])).filter(Boolean);
    const relatedIds=familyIds.length?familyIds:[checkout.alunoId].filter(Boolean),familySale=relatedIds.length>1,familyLabel=familySale?'família':(checkout.alunoNome||'aluno');
    await audit(db,operationResult.status==='confirmado'?'venda_online_secretaria_confirmada':'venda_online_secretaria_revisao',{vendaId:operationResult.vendaId||null,orderNsu,alunoId:checkout.alunoId,alunosIds:relatedIds,alunoNome:checkout.alunoNome,valorCentavos:checkout.pedidoTotalCentavos||checkout.totalCentavos,severidade:operationResult.status==='confirmado'?'info':'warning',descricaoHumana:operationResult.status==='confirmado'?`Venda online da Secretaria confirmada para ${familyLabel}.`:`Pagamento recebido, mas a venda online de ${familyLabel} precisa de revisão.`});
    await notify(db,{tipo:operationResult.status==='confirmado'?'venda_online_confirmada':'venda_online_revisao',titulo:operationResult.status==='confirmado'?'Venda online confirmada':'Venda online precisa de revisão',mensagem:operationResult.status==='confirmado'?`O pagamento da ${familyLabel} foi confirmado e vinculado à conta.`:`O pagamento foi recebido, mas a operação precisa de revisão pela Secretaria.`,prioridade:operationResult.status==='confirmado'?'normal':'alta',alunoId:checkout.alunoId,alunosIds:relatedIds,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,origem:'venda_online_secretaria',canal:'online',destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:operationResult.status==='confirmado'?relatedIds:[],acaoPrincipal:'abrir_aluno',acaoLabel:familySale?'Ver conta da família':'Ver conta do aluno'});
    if(operationResult.status==='confirmado'){
      for(const id of operationResult.pedidosCantinaIds||[]){
        const ps=await db.collection('pedidos').doc(id).get().catch(()=>null),o=ps&&ps.exists?ps.data():{},oid=o.alunoId||checkout.alunoId,oname=o.alunoNome||checkout.alunoNome,omat=o.matricula||checkout.matricula,deliveries=Array.isArray(o.dias)?o.dias.length:0;
        await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Lanches adicionados à agenda',mensagem:`${oname||'Aluno'}: ${deliveries} entrega(s) programada(s) em uma venda online da Secretaria.`,prioridade:'normal',alunoId:oid,alunoNome:oname,matricula:omat,pagamentoId:orderNsu,pedidoId:id,origem:'venda_online_secretaria',canal:'online',destinatariosPerfis:['cantina','admin','gestao','secretaria'],destinatariosAlunos:[oid].filter(Boolean),acaoPrincipal:'abrir_entregas',acaoLabel:'Ver agenda da cantina'});
      }
      for(const id of operationResult.pedidosFardaIds||[]){
        const fs=await db.collection('pedidos_farda').doc(id).get().catch(()=>null),o=fs&&fs.exists?fs.data():{},oid=o.alunoId||checkout.alunoId,oname=o.alunoNome||checkout.alunoNome,omat=o.matricula||checkout.matricula;
        await notify(db,{tipo:Number(o.quantidadeAguardandoProducao||0)>0?'farda_enviada_producao':'pedido_farda_confirmado',titulo:Number(o.quantidadeAguardandoProducao||0)>0?'Farda enviada para produção':'Farda reservada',mensagem:`${oname||'Aluno'} · ${o.produto||'Camisa de farda'} · ${o.tamanho||'-'}: ${Number(o.quantidadeAguardandoProducao||0)>0?'aguardando produção':'reservada para entrega'}.`,alunoId:oid,alunoNome:oname,matricula:omat,pedidoId:id,pagamentoId:orderNsu,origem:'secretaria_online',canal:'online',destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[oid].filter(Boolean),acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
      }
      for(const id of operationResult.pedidosOperacionaisIds||[]){
        const os=await db.collection('pedidos_operacionais').doc(id).get().catch(()=>null),o=os&&os.exists?os.data():{},oid=o.alunoId||checkout.alunoId,oname=o.alunoNome||checkout.alunoNome,omat=o.matricula||checkout.matricula;
        await notify(db,{tipo:'pedido_operacional_confirmado',titulo:'Pedido confirmado',mensagem:`${oname||'Aluno'} · ${o.nome||'Item'}: ${String(o.statusAtendimento||'aguardando_atendimento').replaceAll('_',' ')}.`,alunoId:oid,alunoNome:oname,matricula:omat,pedidoId:id,pagamentoId:orderNsu,origem:'secretaria_online',canal:'online',destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[oid].filter(Boolean),acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
      }
    }
  }else if(checkout.tipo==='pedido_cantina'){
    const orderSnap=await db.collection('pedidos').doc(checkout.pedidoId).get().catch(()=>null),order=orderSnap&&orderSnap.exists?orderSnap.data():{};
    await audit(db,operationResult.status==='confirmado'?'pedido_cantina_confirmado':'pedido_cantina_revisao',{pedidoId:checkout.pedidoId,orderNsu,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:order.totalCentavos||checkout.pedidoTotalCentavos,severidade:operationResult.status==='confirmado'?'info':'warning',descricaoHumana:operationResult.status==='confirmado'?`Pedido de cantina de ${checkout.alunoNome||'aluno'} confirmado e enviado para a agenda de entregas.`:`Pagamento recebido, mas o pedido de ${checkout.alunoNome||'aluno'} precisa de revisão. O valor ficou na conta do aluno.`});
    await notify(db,{tipo:operationResult.status==='confirmado'?'pedido_cantina_confirmado':'pedido_cantina_revisao',titulo:operationResult.status==='confirmado'?'Novo pedido de cantina':'Pedido precisa de revisão',mensagem:operationResult.status==='confirmado'?`${checkout.alunoNome||'Aluno'}: ${(order.dias||[]).length} entrega(s) adicionada(s) à agenda da cantina.`:`Pagamento de ${checkout.alunoNome||'aluno'} foi recebido, mas o pedido precisa de revisão.`,prioridade:operationResult.status==='confirmado'?'normal':'alta',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId,origem:'portal_responsavel',canal:'online',destinatariosPerfis:operationResult.status==='confirmado'?['cantina','admin','gestao','secretaria']:['admin','gestao','secretaria'],destinatariosAlunos:[],acaoPrincipal:operationResult.status==='confirmado'?'abrir_entregas':'abrir_pedidos',acaoLabel:operationResult.status==='confirmado'?'Ver agenda da cantina':'Revisar pedido'});
    if(operationResult.status==='confirmado')await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Pedido de cantina confirmado',mensagem:`Pagamento confirmado. ${(order.dias||[]).length} entrega(s) programada(s), aguardando entrega.`,prioridade:'normal',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId,origem:'portal_responsavel',canal:'online',destinatariosPerfis:[],destinatariosAlunos:[checkout.alunoId],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
  }else if(checkout.tipo==='pedido_farda'){
    const orderSnap=await db.collection('pedidos_farda').doc(checkout.pedidoId).get().catch(()=>null),order=orderSnap&&orderSnap.exists?orderSnap.data():{};
    await audit(db,'pedido_farda_confirmado',{pedidoId:checkout.pedidoId,orderNsu,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:order.totalCentavos||checkout.pedidoTotalCentavos,descricaoHumana:`Pedido de fardamento de ${checkout.alunoNome||'aluno'} confirmado.`});
    await notify(db,{tipo:'pedido_farda_confirmado',titulo:'Novo pedido de fardamento',mensagem:`${checkout.alunoNome||'Aluno'} realizou um pedido de fardamento.`,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId,origem:'portal_responsavel',canal:'online',destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[],acaoPrincipal:'abrir_fardas',acaoLabel:'Ver fardas'});
    await notify(db,{tipo:'pedido_farda_confirmado',titulo:'Pedido de fardamento confirmado',mensagem:operationResult.statusAtendimento==='reservado_estoque'?'Pagamento confirmado. A farda foi reservada e aguarda retirada.':'Pagamento confirmado. O pedido aguarda produção.',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId,origem:'portal_responsavel',canal:'online',destinatariosPerfis:[],destinatariosAlunos:[checkout.alunoId],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
  }else{
    await notify(db,{tipo:'checkout_pagamento_confirmado',titulo:'Pagamento confirmado',mensagem:`Pagamento de ${brl(checkout.totalCentavos)} confirmado para ${checkout.alunoNome||'operação avulsa'}.`,prioridade:'normal',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,origem:checkout.tipo==='venda_online_secretaria'?'venda_online_secretaria':'infinitepay',canal:'online',destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[]});
    if(checkout.alunoId)await notify(db,{tipo:'checkout_pagamento_confirmado',titulo:'Pagamento confirmado',mensagem:`O pagamento de ${brl(checkout.totalCentavos)} foi confirmado e lançado na conta do aluno.`,prioridade:'normal',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,origem:checkout.tipo==='venda_online_secretaria'?'venda_online_secretaria':'infinitepay',canal:'online',destinatariosPerfis:[],destinatariosAlunos:[checkout.alunoId],acaoPrincipal:'abrir_movimentacoes',acaoLabel:'Ver extrato'});
  }
  return {ok:true,operationResult};
}


function normalizeManualPaymentReference(value){
  const cleaned=String(value||'').trim().replace(/[^A-Za-z0-9._-]/g,'');
  if(cleaned.length<5||cleaned.length>80)throw Object.assign(new Error('Informe a identificação do comprovante/transação exibida na InfinitePay.'),{status:400});
  return cleaned;
}
async function manualReconcileInfinitePay(db,body={},actor={}){
  const orderNsu=String(body.orderNsu||body.order_nsu||'').trim();
  if(!orderNsu)throw Object.assign(new Error('Cobrança não informada.'),{status:400});
  const reference=normalizeManualPaymentReference(body.referenciaComprovanteInfinitePay||body.comprovanteInfinitePayId||body.referencia||'');
  const checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu),snap=await checkoutRef.get();
  if(!snap.exists)throw Object.assign(new Error('Cobrança não encontrada.'),{status:404});
  const checkout={id:snap.id,...snap.data(),orderNsu:snap.id};
  if(checkout.statusAplicacao==='aplicado'){
    if(checkout.reconciliacaoManual&&checkout.referenciaComprovanteInfinitePay&&checkout.referenciaComprovanteInfinitePay!==reference)throw Object.assign(new Error('Esta cobrança já foi conciliada usando outra referência de pagamento.'),{status:409});
    return {ok:true,alreadyApplied:true,receipt:await buildReceiptInfo(db,orderNsu),diagnostic:checkoutPaymentDiagnostic(checkout)};
  }
  if(['confirmacao_ignorada_valor_devolvido'].includes(checkout.status))throw Object.assign(new Error('Esta cobrança foi encerrada como valor devolvido e não pode receber baixa manual.'),{status:409});
  const expected=cents(checkout.totalCentavos);
  if(expected<=0)throw Object.assign(new Error('Esta cobrança não possui valor externo pendente para conciliar.'),{status:409});
  const syntheticTransaction=`MANUAL-${reference}`;
  const lockRef=db.collection('transacoes_infinitepay').doc(safeFinancialId(syntheticTransaction)),lockSnap=await lockRef.get();
  if(lockSnap.exists&&lockSnap.data()?.orderNsu&&lockSnap.data().orderNsu!==orderNsu)throw Object.assign(new Error('Esta referência de pagamento já foi usada para conciliar outra cobrança.'),{status:409});
  const now=nowIso(),note=String(body.observacao||'').trim().slice(0,500);
  await db.collection('reconciliacoes_infinitepay').doc(orderNsu).set({id:orderNsu,orderNsu,alunoId:checkout.alunoId||null,alunoNome:checkout.alunoNome||null,valorCentavos:expected,referenciaComprovanteInfinitePay:reference,status:'processando',observacao:note||null,confirmadoPorId:actor.id||null,confirmadoPorNome:actor.nome||null,confirmadoPorPerfil:actor.perfil||null,criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});
  const paymentData={paid:true,success:true,status:'approved',amount:expected,paid_amount:expected,transaction_nsu:syntheticTransaction,invoice_slug:`manual-${reference}`,slug:`manual-${reference}`,capture_method:'manual_infinitepay',source:'reconciliacao_manual_infinitepay',referencia_comprovante:reference};
  try{
    const result=await applyCheckoutConfirmation(db,orderNsu,paymentData,{source:'reconciliacao_manual_infinitepay',eventAlreadyRecorded:true,actor,referenciaComprovanteInfinitePay:reference});
    await db.collection('reconciliacoes_infinitepay').doc(orderNsu).set({status:'aplicado',resultadoOperacional:result.operationResult||null,aplicadoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});
    await notify(db,{tipo:'checkout_pagamento_confirmado',titulo:'Pagamento conciliado',mensagem:`Pagamento de ${brl(expected)} de ${checkout.alunoNome||'aluno'} foi conferido na InfinitePay e aplicado manualmente.`,prioridade:'normal',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,origem:'reconciliacao_manual_infinitepay',canal:'interno',destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[]});
    return {ok:true,applied:true,operationResult:result.operationResult||null,receipt:await buildReceiptInfo(db,orderNsu)};
  }catch(error){
    await db.collection('reconciliacoes_infinitepay').doc(orderNsu).set({status:'erro',erro:compactError(error),atualizadoEm:nowIso()},{merge:true}).catch(()=>{});
    throw error;
  }
}


async function invalidateCheckoutAttempt(db,checkout,reason='descartada'){
  if(!checkout?.idTentativa)return;
  await db.collection('tentativas_checkout').doc(checkout.idTentativa).set({
    status:'descartada',
    invalidated:true,
    checkoutUrl:null,
    invalidatedReason:reason,
    invalidatedAt:nowIso(),
    atualizadoEm:nowIso()
  },{merge:true});
}

async function discardCheckout(db,body={}){
  const orderNsu=String(body.order_nsu||body.orderNsu||'').trim();
  const alunoId=String(body.alunoId||'').trim();
  if(!orderNsu||!alunoId)throw Object.assign(new Error('Cobrança ou aluno não informado.'),{status:400});
  const ref=db.collection('pagamentos_checkout').doc(orderNsu),snap=await ref.get();
  if(!snap.exists)throw Object.assign(new Error('Cobrança não encontrada.'),{status:404});
  const c={id:snap.id,...snap.data()};
  if(String(c.alunoId||'')!==alunoId)throw Object.assign(new Error('Esta cobrança não pertence ao aluno informado.'),{status:403});
  if(c.statusAplicacao==='aplicado'||['pago','confirmado','pago_descartado_creditado'].includes(c.status))throw Object.assign(new Error('Esta cobrança já foi paga e não pode ser descartada.'),{status:409});
  if(['pagamento_localizado_processando','pagamento_localizado_aguardando_processamento'].includes(c.status))throw Object.assign(new Error('O pagamento já foi localizado e está sendo processado. Atualize o status em vez de descartar.'),{status:409});
  if(c.conciliacaoStatus==='aguardando_retorno_infinitepay'&&c.identificadoresPendentes!==false)throw Object.assign(new Error('Este pagamento está em verificação. Não descarte nem gere outra cobrança até confirmar na InfinitePay se o pagamento original foi realizado.'),{status:409,code:'PAYMENT_RECONCILIATION_PENDING'});
  if(['descartado_responsavel','substituido_nova_cobranca'].includes(c.status))return {ok:true,alreadyDiscarded:true,orderNsu};
  const discardable=['preparando_link','aguardando_pagamento','erro_timeout','erro_gerar_link','erro_sem_url','nao_concluido'];
  if(!discardable.includes(c.status||'aguardando_pagamento'))throw Object.assign(new Error('Esta cobrança não está em uma situação que permita descarte.'),{status:409});
  const now=nowIso(),by=String(body.descartadoPorNome||'Responsável').trim()||'Responsável';
  await ref.set({
    statusAnterior:c.status||'aguardando_pagamento',
    status:'descartado_responsavel',
    statusAplicacao:'descartado_sem_pagamento',
    ocultoParaResponsavel:true,
    checkoutUrlAtivo:false,
    tratamentoSePago:'credito_conta_aluno',
    descartadoEm:now,
    descartadoPorId:'portal_responsavel',
    descartadoPorNome:by,
    motivoDescarte:'Cobrança descartada pelo responsável no portal.',
    atualizadoEm:now,
    versao:'1.6.0-rc2.7.24'
  },{merge:true});
  await invalidateCheckoutAttempt(db,c,'cobranca_descartada_responsavel');
  if(c.pedidoId){
    if(c.tipo==='pedido_cantina')await releasePendingOrder(db,c.pedidoId,'descartado_responsavel');
    if(c.tipo==='pedido_farda')await db.collection('pedidos_farda').doc(c.pedidoId).set({statusPagamento:'nao_concluido',statusAtendimento:'cancelado',statusAplicacao:'descartado',motivoCancelamento:'Cobrança descartada pelo responsável.',atualizadoEm:nowIso()},{merge:true});
  }
  await audit(db,'checkout_descartado_responsavel',{
    orderNsu,
    pedidoId:c.pedidoId||null,
    alunoId:c.alunoId,
    alunoNome:c.alunoNome,
    valorCentavos:c.totalCentavos,
    criadoPorId:'portal_responsavel',
    criadoPorNome:by,
    criadoPorPerfil:'responsavel',
    descricaoHumana:`${by} descartou uma cobrança pendente de ${brl(c.totalCentavos)}. O registro foi preservado para auditoria.`
  });
  return {ok:true,orderNsu,status:'descartado_responsavel'};
}

function normalizeSplitPayments(body,required,{allowLegacyOverpay=false}={}){
  const raw=Array.isArray(body.pagamentos)?body.pagamentos:[];
  if(required===0&&raw.length===0)return{payments:[],totalApplied:0,legacy:false,trocoContaCentavos:0};
  if(raw.length){const payments=raw.map((p,i)=>{const method=String(p.metodo||p.formaPagamento||'').toLowerCase(),applied=cents(p.valorAplicadoCentavos||p.valorCentavos);if(!['dinheiro','pix','cartao'].includes(method))throw Object.assign(new Error(`Forma de pagamento inválida na parcela ${i+1}.`),{status:400});if(applied<=0)throw Object.assign(new Error(`Valor inválido na parcela ${i+1}.`),{status:400});const out={...p,metodo:method,valorAplicadoCentavos:applied};if(method==='dinheiro'){const received=cents(p.valorRecebidoCentavos||applied);if(received<applied)throw Object.assign(new Error('O valor entregue em dinheiro não pode ser menor que o valor aplicado.'),{status:400});out.valorRecebidoCentavos=received;out.trocoCentavos=received-applied;}if(method==='pix'){out.origemPix=String(p.origemPix||'banco');out.referencia=String(p.referencia||'').trim();}if(method==='cartao'){const liquid=p.valorLiquidoCentavos===undefined?applied:cents(p.valorLiquidoCentavos),gross=cents(p.valorBrutoPassadoCentavos||p.valorBrutoCentavos||liquid);if(liquid!==applied)throw Object.assign(new Error('No cartão, o valor líquido recebido deve ser igual ao valor aplicado à venda.'),{status:400});if(gross<liquid)throw Object.assign(new Error('O valor bruto cobrado no cartão não pode ser menor que o valor líquido recebido.'),{status:400});out.valorBrutoPassadoCentavos=gross;out.valorLiquidoCentavos=liquid;out.taxaCentavos=gross-liquid;out.adquirente=String(p.adquirente||'outra');out.modalidadeCartao=String(p.modalidadeCartao||'debito');out.parcelas=out.modalidadeCartao==='credito'?Math.max(1,cents(p.parcelas||1)):1;out.nsu=String(p.nsu||'').trim();}return out;});const total=payments.reduce((n,p)=>n+cents(p.valorAplicadoCentavos),0);if(total!==required)throw Object.assign(new Error(total<required?`Ainda faltam ${brl(required-total)} nas formas de pagamento.`:`As formas de pagamento ultrapassam o necessário em ${brl(total-required)}.`),{status:400});return{payments,totalApplied:total,legacy:false,trocoContaCentavos:0};}
  const received=cents(body.valorRecebidoCentavos||body.valorCentavos||required),methodRaw=String(body.formaPagamento||'dinheiro'),method=methodRaw.includes('pix')?'pix':(methodRaw.includes('cart')||methodRaw.includes('maquininha'))?'cartao':'dinheiro';if(received<required)throw Object.assign(new Error(`O valor recebido precisa ser de pelo menos ${brl(required)}.`),{status:400});const dest=String(body.destinoTroco||'devolver'),extra=Math.max(0,received-required),applied=required+(dest==='credito'?extra:0),p={metodo:method,valorAplicadoCentavos:applied};if(method==='dinheiro'){p.valorRecebidoCentavos=received;p.trocoCentavos=dest==='devolver'?extra:0;}if(method==='cartao'){p.valorBrutoPassadoCentavos=received;p.valorLiquidoCentavos=received;p.taxaCentavos=0;p.adquirente=methodRaw;p.modalidadeCartao='debito';p.parcelas=1;}if(method==='pix')p.origemPix=methodRaw;return{payments:[p],totalApplied:applied,legacy:true,trocoContaCentavos:dest==='credito'?extra:0};
}
function operationalOrderCategory(line={}){
  const type=String(line.tipoOperacional||'').toLowerCase();
  if(type==='evento')return 'eventos';
  if(type==='mensalidade')return 'mensalidades';
  if(type==='negociacao')return 'negociacoes';
  return 'servicos';
}
function operationalOrderInitialStatus(line={}){
  const type=String(line.tipoOperacional||'').toLowerCase();
  if(['mensalidade','negociacao','taxa','cobranca_valor_livre'].includes(type))return 'concluido';
  if(type==='evento')return 'aguardando_entrega';
  return 'aguardando_atendimento';
}
async function registerInPersonOperation(db,body={}){
  const actor=actorFromBody(body),student=await getStudent(db,body.alunoId);if(!student)throw Object.assign(new Error('Aluno não encontrado.'),{status:404});
  let operation=String(body.operacao||body.tipoOperacao||'venda_imediata'),raw=Array.isArray(body.itens)?body.itens:[],saleChannel=String(body.canalOrigem||'presencial').toLowerCase()==='online'?'online':'presencial';
  if(operation==='pedido_cantina_programado'){
    raw=[{tipo:'programacao_lanche',tipoOperacional:'programacao_lanche',nome:'Programação de lanches',pedido:body.pedido||{}}];
    operation='venda_catalogo';
  }
  const isAccountOnly=['adicionar_credito','regularizar_debito'].includes(operation),cfg=await getConfig(db);if(!raw.length&&!isAccountOnly)throw Object.assign(new Error('Adicione ao menos um item.'),{status:400});
  const normalized=isAccountOnly?{total:0,lines:[],expanded:new Map(),catalogStock:[],uniformStock:[],programacoes:[],alunosIds:[student.id]}:await normalizeFamilySecretaryMixedSale(db,raw,'presencial',student,cfg),total=normalized.total,lines=normalized.lines,expanded=normalized.expanded,catalogStock=normalized.catalogStock,uniformStock=normalized.uniformStock||[],programacoes=normalized.programacoes||[],alunosIds=normalized.alunosIds||[student.id];
  const accRef=await accountRefForStudent(db,student.id,student),acc=await getAccount(db,student.id),before=accountNet(acc),useBalance=body.usarSaldo===true,creditUsed=isAccountOnly?0:(useBalance?Math.min(Math.max(0,before),total):0),debtRequired=isAccountOnly?0:Math.max(0,-before),operationAmount=operation==='adicionar_credito'?cents(body.valorCentavos||body.valorRecebidoCentavos):operation==='regularizar_debito'?Math.max(0,-before):0,required=isAccountOnly?operationAmount:Math.max(0,total-creditUsed+debtRequired);
  if(operation==='regularizar_debito'&&required<=0)throw Object.assign(new Error('O aluno não possui saldo em aberto.'),{status:409});if(operation==='adicionar_credito'&&required<=0)throw Object.assign(new Error('Informe o valor do crédito.'),{status:400});
  const split=normalizeSplitPayments(body,required),payments=split.payments,applied=split.totalApplied,afterPayment=before+applied,after=isAccountOnly?afterPayment:afterPayment-total,method=payments.length===0?'saldo_conta':payments.length===1?payments[0].metodo:'pagamento_combinado';
  const cashPayments=payments.filter(p=>p.metodo==='dinheiro'),cashTendered=cashPayments.reduce((n,p)=>n+cents(p.valorRecebidoCentavos||p.valorAplicadoCentavos),0),cashChange=cashPayments.reduce((n,p)=>n+cents(p.trocoCentavos),0),cashNet=cashTendered-cashChange,cardFee=payments.filter(p=>p.metodo==='cartao').reduce((n,p)=>n+cents(p.taxaCentavos),0),netSettlement=payments.reduce((n,p)=>n+(p.metodo==='cartao'?cents(p.valorLiquidoCentavos):cents(p.valorAplicadoCentavos)),0);
  let cash=null;if(cashPayments.length){cash=await findOpenCashSession(db,body.caixaId,'secretaria','',actor.id,body.periodoResponsabilidadeId||'');if(!cash)throw Object.assign(new Error('Abra o caixa da secretaria antes de registrar pagamento em dinheiro.'),{status:409});}
  const saleRef=db.collection('vendas').doc(),paymentMoveRef=db.collection('movimentos_conta').doc(),purchaseRef=db.collection('movimentos_conta').doc(),payRefs=payments.map(()=>db.collection('pagamentos').doc()),feeRefs=payments.map(p=>p.metodo==='cartao'&&cents(p.taxaCentavos)>0?db.collection('taxas_pagamento').doc():null),cashInRef=cash?db.collection('movimentos_caixa').doc():null,cashSessionRef=cash?db.collection('sessoes_caixa').doc(cash.id):null,cashPeriodRef=cash?.periodoAtualId?db.collection('periodos_responsabilidade_caixa').doc(cash.periodoAtualId):null,now=nowIso();
  const salgadoQty=[...expanded.values()].filter(x=>x.produtoId==='salgado').reduce((a,x)=>a+cents(x.quantidade),0),dailyRef=salgadoQty>0?db.collection('disponibilidade_salgados').doc(dateKey()):null,catalogRefs=catalogStock.map(x=>({line:x,ref:db.collection('catalogo_itens').doc(x.itemId)})),uniformStockRefs=uniformStock.map(x=>({line:x,ref:db.collection('estoques').doc(x.stockId)}));
  const scheduleByDate=new Map();programacoes.forEach(p=>(p.days||[]).forEach(day=>{const e=scheduleByDate.get(day.dataChave)||{day:day.dataChave,quantidadeSalgados:0};e.quantidadeSalgados+=cents(day.quantidadeSalgados);scheduleByDate.set(day.dataChave,e)}));const scheduleStockRefs=[...scheduleByDate.values()].map(x=>({...x,ref:db.collection('disponibilidade_salgados').doc(x.day)})),orderRefs=programacoes.map(()=>db.collection('pedidos').doc()),occurrenceRefs=programacoes.map((p,i)=>(p.days||[]).map(day=>db.collection('ocorrencias_entrega').doc(`${orderRefs[i].id}__${day.dataChave}`))),uniformRefs=lines.filter(x=>x.tipo==='farda').map(()=>db.collection('pedidos_farda').doc()),operationalLines=lines.filter(x=>x.tipo==='catalogo_item'),operationalRefs=operationalLines.map(()=>db.collection('pedidos_operacionais').doc());
  await db.runTransaction(async tx=>{
    const readRefs=[accRef,...(cashSessionRef?[cashSessionRef]:[]),...(cashPeriodRef?[cashPeriodRef]:[]),...(dailyRef?[dailyRef]:[]),...catalogRefs.map(x=>x.ref),...uniformStockRefs.map(x=>x.ref),...scheduleStockRefs.map(x=>x.ref)],snaps=await Promise.all(readRefs.map(r=>tx.get(r)));let pos=0;const fresh=snaps[pos++],freshAcc=fresh.exists?fresh.data():{},freshBefore=accountNet(freshAcc);if(cashSessionRef){const cs=snaps[pos++];if(!cs.exists)throw new Error('Sessão de caixa não encontrada.');const cd=cs.data()||{},responsavel=String(cd.responsavelAtualId||cd.operadorId||cd.abertoPorId||'');if(cd.status!=='aberto')throw new Error('O caixa foi fechado durante a operação.');if(responsavel&&responsavel!==String(actor.id))throw new Error('O caixa está sob responsabilidade de outro operador. Confira e assuma antes de receber dinheiro.');if(cash.periodoAtualId&&cd.periodoAtualId&&String(cd.periodoAtualId)!==String(cash.periodoAtualId))throw new Error('A responsabilidade do caixa mudou durante a operação. Revise o pagamento.');}if(cashPeriodRef){const ps=snaps[pos++];if(!ps.exists||(ps.data()||{}).status!=='ativo')throw new Error('O período de responsabilidade do caixa não está ativo.');}if(freshBefore!==before)throw new Error('O saldo do aluno mudou. Revise a venda antes de confirmar.');const dailySnap=dailyRef?snaps[pos++]:null,catalogSnaps=catalogRefs.map(()=>snaps[pos++]),uniformStockSnaps=uniformStockRefs.map(()=>snaps[pos++]),scheduleSnaps=scheduleStockRefs.map(()=>snaps[pos++]);
    if(dailyRef){const stock=dailySnap.exists?dailySnap.data():{},info=lunchDayInfo(dateKey(),stock,cfg);if(!info.active)throw new Error('A venda de lanches está desativada hoje.');if(info.used+salgadoQty>info.capacity)throw new Error(`Não há salgados suficientes. Disponíveis: ${info.available}.`);tx.set(dailyRef,{dataChave:dateKey(),quantidadePlanejada:info.planned,vendidoAvulso:cents(stock.vendidoAvulso)+salgadoQty,atualizadoEm:now},{merge:true});}
    catalogRefs.forEach((entry,i)=>{const doc=catalogSnaps[i].exists?catalogSnaps[i].data():{},available=catalogAvailableUnits(doc,entry.line);if(available<entry.line.quantidade)throw new Error(`${entry.line.modo==='capacidade_evento'?'Vagas':'Estoque'} insuficiente para ${entry.line.nome}. Disponível: ${available}.`);tx.set(entry.ref,catalogStockUpdate(doc,entry.line,now),{merge:true});});
    const uniformUpdates=uniformStockRefs.map((entry,i)=>allocateUniformRequirement(uniformStockSnaps[i].exists?uniformStockSnaps[i].data():{},entry.line,lines,now));
    uniformStockRefs.forEach((entry,i)=>tx.set(entry.ref,uniformUpdates[i],{merge:true}));
    scheduleStockRefs.forEach((entry,i)=>{const stock=scheduleSnaps[i].exists?scheduleSnaps[i].data():{},info=lunchDayInfo(entry.day,stock,cfg);if(!info.active)throw new Error(`Não haverá venda de lanche em ${entry.day.split('-').reverse().join('/')}.`);if(info.used+entry.quantidadeSalgados>info.capacity)throw new Error(`Não há salgados suficientes para ${entry.day}. Disponíveis: ${info.available}.`);tx.set(entry.ref,{dataChave:entry.day,quantidadePlanejada:info.planned,pedidosConfirmados:cents(stock.pedidosConfirmados)+entry.quantidadeSalgados,atualizadoEm:now},{merge:true});});
    tx.set(accRef,{...splitNet(after),bloqueioSaldoSemanal:after<0?Boolean(freshAcc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:after<0&&cents(freshAcc.limiteFiadoCentavos)>0&&Math.abs(after)>=cents(freshAcc.limiteFiadoCentavos),ultimaRegularizacaoEm:after>=0?now:(freshAcc.ultimaRegularizacaoEm||null),atualizadoEm:now},{merge:true});
    if(applied>0)tx.set(paymentMoveRef,{id:paymentMoveRef.id,alunoId:student.id,alunosIds,tipo:'entrada_conta_aluno',subtipo:isAccountOnly?(operation==='regularizar_debito'?'regularizacao_saldo_secretaria':'credito_secretaria'):'pagamento_venda_secretaria',valorCentavos:applied,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,formaPagamento:method,pagamentos:payments,vendaId:isAccountOnly?null:saleRef.id,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:now});
    if(!isAccountOnly){tx.set(purchaseRef,{id:purchaseRef.id,alunoId:student.id,alunosIds,tipo:'compra',subtipo:'venda_secretaria',valorCentavos:-total,valorCompraCentavos:total,saldoAntesCentavos:afterPayment,saldoDepoisCentavos:after,vendaId:saleRef.id,itens:lines,origem:'secretaria',formaPagamento:method,pagamentos:payments,status:'confirmado',dataChave:dateKey(),criadoEm:now});tx.set(saleRef,{id:saleRef.id,alunoId:student.id,alunoNome:student.nome,turma:student.turma||null,responsavelFinanceiroId:student.responsavelFinanceiroId||accRef.id||null,alunosIds,origem:saleChannel==='online'?'secretaria_online_saldo':'secretaria',canal:saleChannel,operadorId:actor.id,operadorNome:actor.nome,formaPagamento:method,valorBrutoCentavos:total,valorRecebidoCentavos:required,valorLiquidoRecebimentoCentavos:netSettlement,taxaMaquininhaCentavos:cardFee,valorSaldoUtilizadoCentavos:creditUsed,itens:lines,pagamentos:payments,pagamentosIds:payRefs.map(r=>r.id),movimentoPagamentoId:applied>0?paymentMoveRef.id:null,movimentoCompraId:purchaseRef.id,movimentoCaixaId:cashInRef?.id||null,pedidosCantinaIds:orderRefs.map(r=>r.id),pedidosFardaIds:uniformRefs.map(r=>r.id),pedidosOperacionaisIds:operationalRefs.map(r=>r.id),impactoEstoqueCatalogo:catalogStock,impactoSalgadosHoje:salgadoQty,impactoEstoqueFarda:uniformStock,caixaId:cash?.id||null,sessaoCaixaId:cash?.id||null,periodoResponsabilidadeId:cash?.periodoAtualId||null,dataChave:dateKey(),criadoEm:now,atualizadoEm:now,status:'confirmada',schemaVersion:7,versao:'1.6.0-rc2.7.24'});}
    payments.forEach((p,i)=>{tx.set(payRefs[i],{id:payRefs[i].id,vendaId:isAccountOnly?null:saleRef.id,alunoId:student.id,alunoNome:student.nome,alunosIds,...p,valorBrutoCentavos:p.metodo==='cartao'?p.valorBrutoPassadoCentavos:p.valorAplicadoCentavos,status:'confirmado',origem:'secretaria_presencial',usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:now});if(feeRefs[i])tx.set(feeRefs[i],{id:feeRefs[i].id,pagamentoId:payRefs[i].id,vendaId:isAccountOnly?null:saleRef.id,alunoId:student.id,adquirente:p.adquirente,valorBrutoCentavos:p.valorBrutoPassadoCentavos,valorLiquidoCentavos:p.valorLiquidoCentavos,taxaCentavos:p.taxaCentavos,modalidadeCartao:p.modalidadeCartao,parcelas:p.parcelas,nsu:p.nsu||null,dataChave:dateKey(),criadoEm:now,status:'confirmada'});});
    let ui=0;for(const line of lines.filter(x=>x.tipo==='farda')){const fr=uniformRefs[ui++];tx.set(fr,{id:fr.id,vendaId:saleRef.id,alunoId:line.alunoId||student.id,alunoNome:line.alunoNome||student.nome,turma:line.turma||student.turma||null,matricula:line.matricula||student.matricula||null,responsavelFinanceiroId:line.responsavelFinanceiroId||student.responsavelFinanceiroId||null,produto:line.nome,tamanho:line.tamanho||'',modelo:line.modelo||'',modeloFardaId:line.modeloFardaId||'catalogo',catalogoItemId:line.catalogoItemId||null,quantidade:line.quantidade,precoUnitarioCentavos:line.precoUnitarioCentavos,totalCentavos:line.totalCentavos,statusPagamento:'pago',statusAtendimento:line.statusAtendimento||'aguardando_producao',quantidadeReservadaEstoque:cents(line.quantidadeReservadaEstoque),quantidadeAguardandoProducao:cents(line.quantidadeAguardandoProducao),estoqueReservado:cents(line.quantidadeReservadaEstoque)>0,solicitadoVia:'secretaria_presencial',criadoPor:actor.id,criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'});}
    operationalLines.forEach((line,i)=>{const or=operationalRefs[i],cat=operationalOrderCategory(line),status=operationalOrderInitialStatus(line);tx.set(or,{id:or.id,vendaId:saleRef.id,alunoId:line.alunoId||student.id,alunoNome:line.alunoNome||student.nome,turma:line.turma||student.turma||null,matricula:line.matricula||student.matricula||null,responsavelFinanceiroId:line.responsavelFinanceiroId||student.responsavelFinanceiroId||null,categoriaPedido:cat,tipoOperacional:line.tipoOperacional||'servico',nome:line.nome,descricao:line.descricao||'',quantidade:line.quantidade,precoUnitarioCentavos:line.precoUnitarioCentavos,totalCentavos:line.totalCentavos,statusPagamento:'pago',statusAtendimento:status,origem:'secretaria_presencial',criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});});
    programacoes.forEach((program,i)=>{const orderRef=orderRefs[i];tx.set(orderRef,{id:orderRef.id,vendaId:saleRef.id,alunoId:program.alunoId||student.id,alunoNome:program.alunoNome||student.nome,turma:program.turma||student.turma||null,turno:program.turno||student.turno||null,matricula:program.matricula||student.matricula||null,responsavelFinanceiroId:program.responsavelFinanceiroId||student.responsavelFinanceiroId||null,tipoPedido:'cantina',modalidade:program.modalidade,dias:program.days,totalCentavos:program.totalCentavos,usarSaldo:useBalance,statusPagamento:'pago',statusPedido:'confirmado',statusAplicacao:'aplicado',origem:'secretaria_presencial_venda_mista',criadoPorId:actor.id,criadoPorNome:actor.nome,criadoEm:now,confirmadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'});(program.days||[]).forEach((day,j)=>{const occurrenceRef=occurrenceRefs[i][j];tx.set(occurrenceRef,{id:occurrenceRef.id,pedidoId:orderRef.id,vendaId:saleRef.id,alunoId:program.alunoId||student.id,alunoNome:program.alunoNome||student.nome,turma:program.turma||student.turma||null,turno:program.turno||day.turno||student.turno||null,matricula:program.matricula||student.matricula||null,responsavelFinanceiroId:program.responsavelFinanceiroId||student.responsavelFinanceiroId||null,dataChave:day.dataChave,itens:day.itens||[],componentes:day.componentes||[],quantidadeSalgados:cents(day.quantidadeSalgados),valorCentavos:cents(day.totalCentavos),status:'pendente_entrega',statusPagamento:'pago',origem:'secretaria_presencial_venda_mista',criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2.7.24'},{merge:true});});});
    if(cash&&cashInRef){tx.set(cashInRef,{id:cashInRef.id,caixaId:cash.id,sessaoCaixaId:cash.id,periodoResponsabilidadeId:cash.periodoAtualId||null,tipo:'venda',subtipo:'recebimento_venda',vendaId:isAccountOnly?null:saleRef.id,valorCentavos:cashNet,valorRecebidoCentavos:cashTendered,trocoCentavos:cashChange,valorLiquidoCentavos:cashNet,alunoId:student.id,alunosIds,usuarioId:actor.id,usuarioNome:actor.nome,dataChave:dateKey(),criadoEm:now});tx.set(cashSessionRef,{saldoEsperadoAtualCentavos:admin.firestore.FieldValue.increment(cashNet),atualizadoEm:now},{merge:true});if(cashPeriodRef)tx.set(cashPeriodRef,{saldoEsperadoAtualCentavos:admin.firestore.FieldValue.increment(cashNet),atualizadoEm:now},{merge:true});}
  });
  await audit(db,'venda_presencial_aluno',{vendaId:isAccountOnly?null:saleRef.id,alunoId:student.id,alunoNome:student.nome,alunosIds,valorCentavos:isAccountOnly?applied:total,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,descricaoHumana:isAccountOnly?(operation==='regularizar_debito'?`${actor.nome} regularizou ${brl(applied)} da conta familiar de ${student.nome}.`:`${actor.nome} adicionou ${brl(applied)} à conta familiar de ${student.nome}.`):`${actor.nome} registrou uma venda de ${brl(total)} para ${alunosIds.length>1?`${alunosIds.length} alunos da mesma família`:student.nome}.`});
  if(programacoes.length){for(let i=0;i<programacoes.length;i++){const program=programacoes[i],count=(program.days||[]).length,name=program.alunoNome||student.nome,id=program.alunoId||student.id;await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Lanches adicionados à agenda',mensagem:`${name}: ${count} entrega(s) programada(s) pela Secretaria.`,prioridade:'normal',alunoId:id,alunoNome:name,matricula:program.matricula||student.matricula,pedidoId:orderRefs[i]?.id||null,turma:program.turma||student.turma||null,origem:'secretaria_presencial',canal:'secretaria',criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,destinatariosPerfis:['cantina','admin','gestao','secretaria'],destinatariosAlunos:[],acaoPrincipal:'abrir_entregas',acaoLabel:'Ver agenda da cantina'});await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Lanches programados',mensagem:`Pagamento confirmado. ${count} entrega(s) de ${name} aguardam atendimento da Cantina.`,prioridade:'normal',alunoId:id,alunoNome:name,matricula:program.matricula||student.matricula,pedidoId:orderRefs[i]?.id||null,turma:program.turma||student.turma||null,origem:'secretaria_presencial',canal:'secretaria',criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,destinatariosPerfis:[],destinatariosAlunos:[id],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});}}
  if(uniformRefs.length){for(let i=0;i<uniformRefs.length;i++){const line=lines.filter(x=>x.tipo==='farda')[i],prod=cents(line?.quantidadeAguardandoProducao)>0,id=line?.alunoId||student.id,name=line?.alunoNome||student.nome;await notify(db,{tipo:prod?'farda_enviada_producao':'pedido_farda_confirmado',titulo:prod?'Farda enviada para produção':'Farda reservada',mensagem:prod?`${name} · ${line.tamanho}${line.modelo?` · ${line.modelo}`:''}: pedido registrado e aguardando produção.`:`${name} · ${line.tamanho}${line.modelo?` · ${line.modelo}`:''}: unidade reservada e aguardando entrega.`,alunoId:id,alunoNome:name,turma:line?.turma||student.turma||null,pedidoId:uniformRefs[i].id,origem:'secretaria_presencial',canal:'secretaria',destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[id],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});}}
  if(operationalRefs.length){for(let i=0;i<operationalRefs.length;i++){const line=operationalLines[i],id=line?.alunoId||student.id,name=line?.alunoNome||student.nome;await notify(db,{tipo:'pedido_operacional_confirmado',titulo:'Pedido confirmado',mensagem:`${name} · ${line.nome}: ${String(operationalOrderInitialStatus(line)).replaceAll('_',' ')}.`,alunoId:id,alunoNome:name,turma:line?.turma||student.turma||null,pedidoId:operationalRefs[i].id,origem:'secretaria_presencial',canal:'secretaria',destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[id],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});}}
  return{ok:true,vendaId:isAccountOnly?null:saleRef.id,pagamentosIds:payRefs.map(r=>r.id),pedidosCantinaIds:orderRefs.map(r=>r.id),pedidosFardaIds:uniformRefs.map(r=>r.id),pedidosOperacionaisIds:operationalRefs.map(r=>r.id),totalCentavos:total,valorRecebidoCentavos:required,valorAplicadoCentavos:applied,valorLiquidoRecebimentoCentavos:netSettlement,taxaMaquininhaCentavos:cardFee,saldoAntesCentavos:before,saldoDepoisCentavos:after};
}


function saleCancelledV222(sale={}){return ['cancelada','cancelado','estornada','estornado'].some(x=>String(sale.status||'').toLowerCase().includes(x))}
function cancellationReasonLabelV222(code){return ({pagamento_nao_recebido:'Pagamento confirmado por engano / valor não recebido',registro_duplicado:'Registro duplicado',venda_lancada_por_engano:'Venda lançada por engano',link_aluno_incorreto:'Link enviado/pago para aluno incorreto',compra_cancelada_reembolso:'Compra cancelada com devolução ao pagador',outro_erro_operacional:'Outro erro operacional'}[code]||'Erro operacional')}
function cancellationOperationalInitialV222(order={}){return operationalOrderInitialStatus(order)}
function cancellationBlockersV222({uniformOrders=[],operationalOrders=[],occurrences=[],reversibleDeliveredIds=[]}={}){
  const blockers=[],reversible=new Set((reversibleDeliveredIds||[]).map(String));
  for(const o of uniformOrders){const st=String(o.statusAtendimento||'');if(!['reservado_estoque','aguardando_producao','cancelado','nao_concluido',''].includes(st))blockers.push(`Fardamento ${o.produto||o.id}: atendimento já está em “${st.replaceAll('_',' ')}”.`)}
  for(const o of operationalOrders){const st=String(o.statusAtendimento||''),initial=cancellationOperationalInitialV222(o);if(!['cancelado',''].includes(st)&&st!==initial)blockers.push(`${o.nome||'Pedido'}: atendimento já avançou para “${st.replaceAll('_',' ')}”.`)}
  for(const o of occurrences){const st=String(o.status||'');if(st==='entregue'&&reversible.has(String(o.id||'')))continue;if(!['pendente_entrega','programado','cancelado',''].includes(st))blockers.push(`Entrega de ${o.dataChave||o.id}: já está em “${st.replaceAll('_',' ')}”.`)}
  return blockers;
}
async function querySaleRelatedV222(db,collection,saleId){const snap=await db.collection(collection).where('vendaId','==',saleId).get();return snap.docs.map(d=>({id:d.id,ref:d.ref,...(d.data()||{})}))}
async function rebuildSaleStockImpactV222(db,sale={}){
  if(Array.isArray(sale.impactoEstoqueCatalogo)&&Number.isFinite(Number(sale.impactoSalgadosHoje)))return {catalogStock:sale.impactoEstoqueCatalogo.map(x=>({...x})),salgadoQty:Math.max(0,cents(sale.impactoSalgadosHoje)),source:'snapshot'};
  const lines=Array.isArray(sale.itens)?sale.itens:[],catalogReq=new Map(),expanded=new Map();
  const [catalogMap,productMap]=await Promise.all([loadCatalogItemMap(db),loadProductMap(db)]);
  for(const line of lines){
    const qty=Math.max(1,cents(line.quantidade||1));
    if(line.tipo==='farda'||line.tipoOperacional==='fardamento')continue;
    if(line.catalogoItemId){
      const cat=catalogMap.get(String(line.catalogoItemId));
      if(cat){expandCatalogStock(cat,qty,catalogMap,catalogReq);if(cat.legacyProdutoId){const lp=productMap.get(String(cat.legacyProdutoId));if(lp)expandProduct(lp,qty,productMap,expanded)}}
      else if(line.controleEstoque==='geral'||line.tipoOperacional==='evento'){addCatalogStockRequirement(catalogReq,{id:line.catalogoItemId,nome:line.nome},qty,line.tipoOperacional==='evento'?'capacidade_evento':'geral')}
      else if(line.controleEstoque==='componentes')throw Object.assign(new Error(`Não foi possível reconstruir com segurança o impacto de estoque do combo “${line.nome||line.catalogoItemId}”. A Gestão deve revisar esta venda.`),{status:409});
    }else if(line.produtoId){const p=productMap.get(String(line.produtoId));if(p)expandProduct(p,qty,productMap,expanded);else if(String(line.produtoId)==='salgado')expanded.set('salgado',{produtoId:'salgado',quantidade:qty})}
  }
  const salgadoQty=[...expanded.values()].filter(x=>x.produtoId==='salgado').reduce((a,x)=>a+cents(x.quantidade),0);
  return {catalogStock:[...catalogReq.values()],salgadoQty,source:'reconstruido'};
}
function mergeUniformReversalV222(rows=[]){const m=new Map();for(const o of rows){if(String(o.statusAtendimento||'')==='cancelado')continue;const id=uniformStockId(o.modeloFardaId||'camisa_padrao',o.tamanho,o.modelo||''),x=m.get(id)||{stockId:id,reserved:0,production:0};x.reserved+=Math.max(0,cents(o.quantidadeReservadaEstoque||(o.estoqueReservado?o.quantidade:0)));x.production+=Math.max(0,cents(o.quantidadeAguardandoProducao));m.set(id,x)}return [...m.values()]}
function mergeScheduleReversalV222(rows=[]){const m=new Map();for(const o of rows){if(String(o.status||'')==='cancelado')continue;const day=String(o.dataChave||'');if(!day)continue;const x=m.get(day)||{day,qty:0};x.qty+=Math.max(0,cents(o.quantidadeSalgados||(o.componentes||[]).filter(c=>c.produtoId==='salgado').reduce((n,c)=>n+cents(c.quantidade),0)));m.set(day,x)}return [...m.values()]}
async function cancelInPersonSale(db,body={}){
  const saleId=String(body.vendaId||body.id||'').trim(),reason=String(body.motivo||body.motivoCodigo||'').trim(),detail=String(body.detalhes||body.observacao||'').trim(),actor=actorFromBody(body);
  if(!saleId)throw Object.assign(new Error('Venda não informada.'),{status:400});
  const refundMode=String(body.tipoOperacao||'')==='reembolso_recebido',refundMethod=String(body.formaReembolso||'').toLowerCase(),refundReference=String(body.referenciaReembolso||'').trim(),mistakenDeliveryIds=new Set((Array.isArray(body.entregasMarcadasPorEnganoIds)?body.entregasMarcadasPorEnganoIds:[]).map(x=>String(x||'').trim()).filter(Boolean));
  if(!['pagamento_nao_recebido','registro_duplicado','venda_lancada_por_engano','link_aluno_incorreto','compra_cancelada_reembolso','outro_erro_operacional'].includes(reason))throw Object.assign(new Error('Informe um motivo válido para o cancelamento.'),{status:400});
  if(reason==='outro_erro_operacional'&&detail.length<5)throw Object.assign(new Error('Descreva o motivo do cancelamento no campo de observação.'),{status:400});
  if(refundMode){if(body.confirmoReembolsoExterno!==true)throw Object.assign(new Error('Confirme que a devolução ao pagador foi efetivamente realizada antes de concluir o reembolso no Piaget.'),{status:400});if(!['infinitepay','pix','dinheiro','cartao','transferencia','outro'].includes(refundMethod))throw Object.assign(new Error('Informe como o valor foi devolvido ao pagador.'),{status:400});if(refundMethod!=='dinheiro'&&refundReference.length<3)throw Object.assign(new Error('Informe a referência/comprovante do reembolso para preservar a auditoria.'),{status:400});}else if(body.confirmoSemReembolso!==true)throw Object.assign(new Error('Confirme que não existe valor externo a reembolsar antes de cancelar a venda.'),{status:400});
  if(body.confirmoSemEntrega!==true)throw Object.assign(new Error('Confirme que nenhum item, serviço, credencial ou lanche desta venda foi efetivamente entregue ou utilizado.'),{status:400});
  if(mistakenDeliveryIds.size&&body.confirmoEntregaMarcadaPorEngano!==true)throw Object.assign(new Error('Confirme que as entregas selecionadas foram marcadas como entregues por engano e não chegaram a ser entregues.'),{status:400});
  const saleRef=db.collection('vendas').doc(saleId),saleSnap=await saleRef.get();if(!saleSnap.exists)throw Object.assign(new Error('Venda não encontrada.'),{status:404});const sale={id:saleSnap.id,...saleSnap.data()};
  if(saleCancelledV222(sale))return {ok:true,vendaId:saleId,status:'cancelada',alreadyCancelled:true};
  const origin=String(sale.origem||'').toLowerCase(),isOnline=origin.includes('online')||String(sale.formaPagamento||'').includes('checkout')||Boolean(sale.orderNsu),isSecretaryInPerson=(origin==='secretaria'||origin==='secretaria_presencial')&&!isOnline,saleInReview=String(sale.status||'').toLowerCase()==='revisao'||Boolean(sale.motivoRevisao);if(!isSecretaryInPerson&&!(refundMode&&isOnline))throw Object.assign(new Error(isOnline?'Para uma venda online já paga, use o fluxo de cancelar e registrar reembolso ao pagador.':'Esta venda não foi registrada como venda presencial da Secretaria e não pode ser cancelada por este fluxo.'),{status:409});
  if(!sale.alunoId)throw Object.assign(new Error('A venda não possui aluno vinculado e não pode ser estornada automaticamente.'),{status:409});
  const [student,paymentsBySale,fees,cashMoves,uniformOrders,operationalOrders,cantinaOrders,occurrences,onlineLinksBySale,impact]=await Promise.all([
    getStudent(db,sale.alunoId),querySaleRelatedV222(db,'pagamentos',saleId),querySaleRelatedV222(db,'taxas_pagamento',saleId),querySaleRelatedV222(db,'movimentos_caixa',saleId),querySaleRelatedV222(db,'pedidos_farda',saleId),querySaleRelatedV222(db,'pedidos_operacionais',saleId),querySaleRelatedV222(db,'pedidos',saleId),querySaleRelatedV222(db,'ocorrencias_entrega',saleId),querySaleRelatedV222(db,'vendas_online_links',saleId),saleInReview?Promise.resolve({catalogStock:[],uniformStock:[],salgadoQty:0,source:'nao_aplicado_revisao'}):rebuildSaleStockImpactV222(db,sale)
  ]);if(!student)throw Object.assign(new Error('Aluno da venda não encontrado.'),{status:409});
  const deliveredOccurrences=occurrences.filter(o=>String(o.status||'').toLowerCase()==='entregue'),deliveredIds=new Set(deliveredOccurrences.map(o=>String(o.id)));for(const id of mistakenDeliveryIds)if(!deliveredIds.has(id))throw Object.assign(new Error('Uma entrega selecionada para correção não está mais marcada como entregue nesta venda. Atualize a tela antes de continuar.'),{status:409});
  const payments=[...paymentsBySale],onlineLinks=[...onlineLinksBySale];if(sale.orderNsu){try{const direct=await db.collection('pagamentos').doc(String(sale.orderNsu)).get();if(direct.exists&&!payments.some(p=>p.id===direct.id))payments.push({id:direct.id,ref:direct.ref,...(direct.data()||{})})}catch(_){}try{const ls=await db.collection('vendas_online_links').where('orderNsu','==',String(sale.orderNsu)).limit(5).get();for(const d of ls.docs)if(!onlineLinks.some(l=>l.id===d.id))onlineLinks.push({id:d.id,ref:d.ref,...(d.data()||{})})}catch(_){}}
  const blockers=cancellationBlockersV222({uniformOrders,operationalOrders,occurrences,reversibleDeliveredIds:[...mistakenDeliveryIds]});if(blockers.length)throw Object.assign(new Error('A venda possui atendimento posterior que ainda precisa ser tratado antes do cancelamento.'),{status:409,details:{blockers}});
  const accRef=await accountRefForStudent(db,sale.alunoId,student),total=Math.max(0,cents(sale.valorBrutoCentavos)),purchaseReversalAmount=saleInReview?0:total,applied=Math.max(0,cents((sale.pagamentos||[]).reduce((n,p)=>n+cents(p.valorAplicadoCentavos),0)||sale.valorRecebidoCentavos||sale.valorPagoExternoCentavos)),catalogImpact=impact.catalogStock||[],uniformImpact=saleInReview?[]:mergeUniformReversalV222(uniformOrders),scheduleImpact=saleInReview?[]:mergeScheduleReversalV222(occurrences),cashOriginal=cashMoves.filter(m=>String(m.tipo||'')==='venda'&&String(m.status||'')!=='cancelado_sem_recebimento'),cashNet=Math.max(0,cashOriginal.reduce((n,m)=>n+cents(m.valorLiquidoCentavos||m.valorCentavos),0));
  const dailyRef=impact.salgadoQty>0?db.collection('disponibilidade_salgados').doc(String(sale.dataChave||dateKey(new Date(sale.criadoEm||Date.now())))):null,catalogRefs=catalogImpact.map(x=>({line:x,ref:db.collection('catalogo_itens').doc(String(x.itemId))})),uniformRefs=uniformImpact.map(x=>({...x,ref:db.collection('estoques').doc(x.stockId)})),scheduleRefs=scheduleImpact.map(x=>({...x,ref:db.collection('disponibilidade_salgados').doc(x.day)}));
  const effectiveOriginalCashNet=refundMode?0:cashNet,cashSessionId=String(sale.sessaoCaixaId||sale.caixaId||cashOriginal[0]?.sessaoCaixaId||cashOriginal[0]?.caixaId||''),cashPeriodId=String(sale.periodoResponsabilidadeId||cashOriginal[0]?.periodoResponsabilidadeId||''),cashSessionRef=effectiveOriginalCashNet>0&&cashSessionId?db.collection('sessoes_caixa').doc(cashSessionId):null,cashPeriodRef=effectiveOriginalCashNet>0&&cashPeriodId?db.collection('periodos_responsabilidade_caixa').doc(cashPeriodId):null;
  const refundCash=refundMode&&refundMethod==='dinheiro'?await findOpenCashSession(db,body.caixaIdReembolso||'', 'secretaria','',actor.id,body.periodoResponsabilidadeIdReembolso||''):null;if(refundMode&&refundMethod==='dinheiro'&&!refundCash)throw Object.assign(new Error('Abra o caixa da Secretaria antes de registrar uma devolução em dinheiro.'),{status:409});const refundCashRef=refundCash?db.collection('movimentos_caixa').doc():null,refundCashSessionRef=refundCash?db.collection('sessoes_caixa').doc(refundCash.id):null,refundCashPeriodRef=refundCash?.periodoAtualId?db.collection('periodos_responsabilidade_caixa').doc(refundCash.periodoAtualId):null,refundRef=refundMode?db.collection('reembolsos').doc():null,checkoutRefundRef=refundMode&&sale.orderNsu?db.collection('pagamentos_checkout').doc(String(sale.orderNsu)):null;
  if(effectiveOriginalCashNet>0&&!cashSessionRef)throw Object.assign(new Error('A venda possui recebimento em dinheiro, mas a sessão de caixa original não foi localizada. O cancelamento automático foi bloqueado.'),{status:409});
  const revPurchaseRef=purchaseReversalAmount>0?db.collection('movimentos_conta').doc():null,revPaymentRef=applied>0?db.collection('movimentos_conta').doc():null,revCashRef=effectiveOriginalCashNet>0?db.collection('movimentos_caixa').doc():null,now=nowIso(),cancelOrigin=refundMode?'cancelamento_reembolso_venda':'cancelamento_venda_presencial',paymentReversalSubtype=refundMode?'estorno_pagamento_reembolsado':'estorno_pagamento_nao_recebido';let alreadyCancelled=false,resultBalance=null,revertedDeliveryRows=[];
  await db.runTransaction(async tx=>{
    const freshSaleSnap=await tx.get(saleRef);if(!freshSaleSnap.exists)throw new Error('Venda não encontrada.');const freshSale=freshSaleSnap.data()||{};if(saleCancelledV222(freshSale)){alreadyCancelled=true;return}
    const refs=[accRef,...catalogRefs.map(x=>x.ref),...uniformRefs.map(x=>x.ref),...scheduleRefs.map(x=>x.ref),...(dailyRef?[dailyRef]:[]),...(cashSessionRef?[cashSessionRef]:[]),...(cashPeriodRef?[cashPeriodRef]:[]),...(refundCashSessionRef?[refundCashSessionRef]:[]),...(refundCashPeriodRef?[refundCashPeriodRef]:[]),...(checkoutRefundRef?[checkoutRefundRef]:[]),...uniformOrders.map(x=>x.ref),...operationalOrders.map(x=>x.ref),...cantinaOrders.map(x=>x.ref),...occurrences.map(x=>x.ref)];
    const snaps=await Promise.all(refs.map(r=>tx.get(r)));let pos=0;const accSnap=snaps[pos++],acc=accSnap.exists?accSnap.data()||{}:{};const current=accountNet(acc),afterPurchaseReversal=current+purchaseReversalAmount,afterFinal=afterPurchaseReversal-applied;resultBalance={before:current,afterPurchaseReversal,after:afterFinal};
    const catalogSnaps=catalogRefs.map(()=>snaps[pos++]),uniformSnaps=uniformRefs.map(()=>snaps[pos++]),scheduleSnaps=scheduleRefs.map(()=>snaps[pos++]),dailySnap=dailyRef?snaps[pos++]:null,cashSessionSnap=cashSessionRef?snaps[pos++]:null,cashPeriodSnap=cashPeriodRef?snaps[pos++]:null;
    const refundCashSessionSnap=refundCashSessionRef?snaps[pos++]:null,refundCashPeriodSnap=refundCashPeriodRef?snaps[pos++]:null,checkoutRefundSnap=checkoutRefundRef?snaps[pos++]:null;const freshUniform=uniformOrders.map((x,i)=>({meta:x,snap:snaps[pos++]})),freshOperational=operationalOrders.map((x,i)=>({meta:x,snap:snaps[pos++]})),freshCantina=cantinaOrders.map((x,i)=>({meta:x,snap:snaps[pos++]})),freshOccurrences=occurrences.map((x,i)=>({meta:x,snap:snaps[pos++]}));
    const freshOccurrenceRows=freshOccurrences.filter(x=>x.snap.exists).map(x=>({id:x.meta.id,...x.snap.data()})),freshBlockers=cancellationBlockersV222({uniformOrders:freshUniform.filter(x=>x.snap.exists).map(x=>({id:x.meta.id,...x.snap.data()})),operationalOrders:freshOperational.filter(x=>x.snap.exists).map(x=>({id:x.meta.id,...x.snap.data()})),occurrences:freshOccurrenceRows,reversibleDeliveredIds:[...mistakenDeliveryIds]});if(freshBlockers.length)throw Object.assign(new Error('A venda recebeu atendimento enquanto o cancelamento era preparado.'),{status:409,details:{blockers:freshBlockers}});revertedDeliveryRows=freshOccurrenceRows.filter(o=>String(o.status||'').toLowerCase()==='entregue'&&mistakenDeliveryIds.has(String(o.id)));
    if(cashSessionRef){const cs=cashSessionSnap?.exists?cashSessionSnap.data()||{}:null;if(!cs||cs.status!=='aberto')throw Object.assign(new Error('O caixa original desta venda já foi fechado. O cancelamento automático em dinheiro foi bloqueado para preservar o fechamento.'),{status:409});const responsible=String(cs.responsavelAtualId||'');if(responsible&&responsible!==String(actor.id)&&!['admin','gestao'].includes(actor.perfil))throw Object.assign(new Error('O caixa agora está sob responsabilidade de outro operador. Solicite o cancelamento à Gestão ou ao responsável atual.'),{status:409});}
    if(cashPeriodRef&&(!cashPeriodSnap?.exists||String(cashPeriodSnap.data()?.status||'')!=='ativo'))throw Object.assign(new Error('O período de responsabilidade do caixa da venda já foi encerrado. O cancelamento em dinheiro precisa ser tratado pela Gestão.'),{status:409});
    tx.set(accRef,{...splitNet(afterFinal),bloqueioSaldoSemanal:afterFinal<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:afterFinal<0&&cents(acc.limiteFiadoCentavos)>0&&Math.abs(afterFinal)>=cents(acc.limiteFiadoCentavos),atualizadoEm:now},{merge:true});
    if(revPurchaseRef)tx.set(revPurchaseRef,{id:revPurchaseRef.id,alunoId:sale.alunoId,alunosIds:sale.alunosIds||[sale.alunoId],tipo:'estorno',subtipo:'estorno_compra_venda_cancelada',valorCentavos:purchaseReversalAmount,saldoAntesCentavos:current,saldoDepoisCentavos:afterPurchaseReversal,vendaId:saleId,vendaOriginalId:saleId,itens:sale.itens||[],origem:cancelOrigin,formaPagamento:sale.formaPagamento||null,status:'confirmado',motivoCodigo:reason,motivo:cancellationReasonLabelV222(reason),usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:now,versao:'1.6.0-rc2.7.27'});
    if(revPaymentRef)tx.set(revPaymentRef,{id:revPaymentRef.id,alunoId:sale.alunoId,alunosIds:sale.alunosIds||[sale.alunoId],tipo:'estorno',subtipo:paymentReversalSubtype,valorCentavos:-applied,saldoAntesCentavos:afterPurchaseReversal,saldoDepoisCentavos:afterFinal,vendaId:saleId,vendaOriginalId:saleId,origem:cancelOrigin,formaPagamento:sale.formaPagamento||null,status:'confirmado',motivoCodigo:reason,motivo:cancellationReasonLabelV222(reason),usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:now,versao:'1.6.0-rc2.7.27'});
    if(dailyRef){const d=dailySnap?.exists?dailySnap.data()||{}:{};tx.set(dailyRef,{vendidoAvulso:Math.max(0,cents(d.vendidoAvulso)-cents(impact.salgadoQty)),atualizadoEm:now},{merge:true})}
    catalogRefs.forEach((entry,i)=>{const d=catalogSnaps[i]?.exists?catalogSnaps[i].data()||{}:{};if(entry.line.modo==='capacidade_evento')tx.set(entry.ref,{vagasVendidas:Math.max(0,cents(d.vagasVendidas)-cents(entry.line.quantidade)),atualizadoEm:now},{merge:true});else tx.set(entry.ref,{estoqueAtual:cents(d.estoqueAtual)+cents(entry.line.quantidade),atualizadoEm:now},{merge:true})});
    uniformRefs.forEach((entry,i)=>{const d=uniformSnaps[i]?.exists?uniformSnaps[i].data()||{}:{};tx.set(entry.ref,{quantidadeReservada:Math.max(0,cents(d.quantidadeReservada)-entry.reserved),quantidadeComprometidaProducao:Math.max(0,cents(d.quantidadeComprometidaProducao)-entry.production),atualizadoEm:now},{merge:true})});
    scheduleRefs.forEach((entry,i)=>{const d=scheduleSnaps[i]?.exists?scheduleSnaps[i].data()||{}:{};tx.set(entry.ref,{pedidosConfirmados:Math.max(0,cents(d.pedidosConfirmados)-entry.qty),atualizadoEm:now},{merge:true})});
    for(const x of freshUniform)if(x.snap.exists)tx.set(x.meta.ref,{statusPagamento:'cancelado',statusAtendimento:'cancelado',statusAplicacao:'cancelado',estoqueReservado:false,canceladoPorId:actor.id,canceladoPorNome:actor.nome,canceladoEm:now,motivoCancelamento:cancellationReasonLabelV222(reason),atualizadoEm:now,versao:'1.6.0-rc2.7.27'},{merge:true});
    for(const x of freshOperational)if(x.snap.exists)tx.set(x.meta.ref,{statusPagamento:'cancelado',statusAtendimento:'cancelado',statusAplicacao:'cancelado',canceladoPorId:actor.id,canceladoPorNome:actor.nome,canceladoEm:now,motivoCancelamento:cancellationReasonLabelV222(reason),atualizadoEm:now,versao:'1.6.0-rc2.7.27'},{merge:true});
    for(const x of freshCantina)if(x.snap.exists)tx.set(x.meta.ref,{statusPagamento:'cancelado',statusPedido:'cancelado',statusAplicacao:'cancelado',canceladoPorId:actor.id,canceladoPorNome:actor.nome,canceladoEm:now,motivoCancelamento:cancellationReasonLabelV222(reason),atualizadoEm:now,versao:'1.6.0-rc2.7.27'},{merge:true});
    for(const x of freshOccurrences)if(x.snap.exists){const current=x.snap.data()||{},wasDelivered=String(current.status||'').toLowerCase()==='entregue'&&mistakenDeliveryIds.has(String(x.meta.id)),patch={status:'cancelado',statusPagamento:'cancelado',canceladoPorId:actor.id,canceladoPorNome:actor.nome,canceladoEm:now,motivoCancelamento:cancellationReasonLabelV222(reason),atualizadoEm:now,versao:'1.6.0-rc2.7.27'};if(wasDelivered)Object.assign(patch,{statusAnteriorCancelamento:'entregue',entregaMarcadaPorEngano:true,entregaEstornadaEm:now,entregaEstornadaPorId:actor.id,entregaEstornadaPorNome:actor.nome,motivoEstornoEntrega:detail||cancellationReasonLabelV222(reason)});tx.set(x.meta.ref,patch,{merge:true})}
    payments.forEach(p=>tx.set(p.ref,{status:refundMode?'reembolsado':'cancelado_sem_recebimento',canceladoPorId:actor.id,canceladoPorNome:actor.nome,canceladoEm:now,motivoCancelamento:cancellationReasonLabelV222(reason),atualizadoEm:now},{merge:true}));onlineLinks.forEach(l=>tx.set(l.ref,{status:refundMode?'reembolsado':'cancelado',statusFinanceiro:refundMode?'reembolsado':'estornado_sem_recebimento',reembolsadoEm:refundMode?now:null,canceladoEm:now,canceladoPorId:actor.id,canceladoPorNome:actor.nome,motivoCancelamento:cancellationReasonLabelV222(reason),atualizadoEm:now},{merge:true}));fees.forEach(f=>tx.set(f.ref,{status:'cancelada',canceladoPorId:actor.id,canceladoPorNome:actor.nome,canceladoEm:now,motivoCancelamento:cancellationReasonLabelV222(reason),atualizadoEm:now},{merge:true}));if(!refundMode)cashOriginal.forEach(m=>tx.set(m.ref,{status:'cancelado_sem_recebimento',canceladoPorId:actor.id,canceladoPorNome:actor.nome,canceladoEm:now,motivoCancelamento:cancellationReasonLabelV222(reason),atualizadoEm:now},{merge:true}));
    if(revCashRef){tx.set(revCashRef,{id:revCashRef.id,caixaId:cashSessionId,sessaoCaixaId:cashSessionId,periodoResponsabilidadeId:cashPeriodId||null,tipo:'estorno_venda',subtipo:'cancelamento_pagamento_nao_recebido',vendaId:saleId,vendaOriginalId:saleId,valorCentavos:-effectiveOriginalCashNet,efeitoCentavos:-effectiveOriginalCashNet,alunoId:sale.alunoId,alunosIds:sale.alunosIds||[sale.alunoId],usuarioId:actor.id,usuarioNome:actor.nome,observacao:`Cancelamento da venda ${saleId}: ${cancellationReasonLabelV222(reason)}.`,dataChave:dateKey(),criadoEm:now,versao:'1.6.0-rc2.7.27'});tx.set(cashSessionRef,{saldoEsperadoAtualCentavos:admin.firestore.FieldValue.increment(-effectiveOriginalCashNet),atualizadoEm:now},{merge:true});if(cashPeriodRef)tx.set(cashPeriodRef,{saldoEsperadoAtualCentavos:admin.firestore.FieldValue.increment(-effectiveOriginalCashNet),atualizadoEm:now},{merge:true})}
    if(refundMode){
      if(refundCashRef){tx.set(refundCashRef,{id:refundCashRef.id,caixaId:refundCash.id,sessaoCaixaId:refundCash.id,periodoResponsabilidadeId:refundCash.periodoAtualId||null,tipo:'reembolso_venda',subtipo:'devolucao_ao_pagador',vendaId:saleId,valorCentavos:-applied,efeitoCentavos:-applied,alunoId:sale.alunoId,usuarioId:actor.id,usuarioNome:actor.nome,observacao:`Reembolso ao pagador da venda ${saleId}.`,dataChave:dateKey(),criadoEm:now,versao:'1.6.0-rc2.7.27'});tx.set(refundCashSessionRef,{saldoEsperadoAtualCentavos:admin.firestore.FieldValue.increment(-applied),atualizadoEm:now},{merge:true});if(refundCashPeriodRef)tx.set(refundCashPeriodRef,{saldoEsperadoAtualCentavos:admin.firestore.FieldValue.increment(-applied),atualizadoEm:now},{merge:true})}
      tx.set(refundRef,{id:refundRef.id,vendaId:saleId,orderNsu:sale.orderNsu||null,alunoId:sale.alunoId,alunoNome:sale.alunoNome||student.nome,responsavelFinanceiroId:sale.responsavelFinanceiroId||student.responsavelFinanceiroId||accRef.id,pagadorSnapshot:sale.pagadorSnapshot||sale.customer||null,valorCentavos:applied,formaReembolso:refundMethod,referenciaReembolso:refundReference||null,status:'confirmado',motivoCodigo:reason,motivo:cancellationReasonLabelV222(reason),criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,criadoEm:now,versao:'1.6.0-rc2.7.27'});
      if(checkoutRefundRef&&checkoutRefundSnap?.exists)tx.set(checkoutRefundRef,{status:'reembolsado',statusAplicacao:'reembolsado',reembolsoId:refundRef.id,reembolsadoEm:now,reembolsadoPorId:actor.id,reembolsadoPorNome:actor.nome,atualizadoEm:now},{merge:true});
    }
    tx.set(saleRef,{status:'cancelada',statusFinanceiro:refundMode?'reembolsado':'estornado_sem_recebimento',valorRecebidoEfetivoCentavos:0,cancelamentoTipo:refundMode?'cancelamento_com_reembolso_ao_pagador':'cancelamento_operacional_sem_reembolso',reembolsoId:refundRef?.id||null,formaReembolso:refundMode?refundMethod:null,referenciaReembolso:refundMode?(refundReference||null):null,motivoCancelamentoCodigo:reason,motivoCancelamento:cancellationReasonLabelV222(reason),detalhesCancelamento:detail||null,canceladoPorId:actor.id,canceladoPorNome:actor.nome,canceladoPorPerfil:actor.perfil,canceladoEm:now,atualizadoEm:now,estornoMovimentoCompraId:revPurchaseRef?.id||null,estornoMovimentoPagamentoId:revPaymentRef?.id||null,estornoMovimentoCaixaId:revCashRef?.id||null,impactoEstoqueCancelamentoFonte:impact.source,entregasMarcadasPorEnganoIds:revertedDeliveryRows.map(o=>o.id),quantidadeEntregasEstornadas:revertedDeliveryRows.length,versaoCancelamento:'1.6.0-rc2.7.27'},{merge:true});
  });
  if(alreadyCancelled)return {ok:true,vendaId:saleId,status:'cancelada',alreadyCancelled:true};
  await audit(db,refundMode?'venda_cancelada_reembolsada':'venda_presencial_cancelada',{vendaId:saleId,alunoId:sale.alunoId,alunoNome:sale.alunoNome||student.nome,responsavelFinanceiroId:sale.responsavelFinanceiroId||student.responsavelFinanceiroId||accRef.id,valorCentavos:total,valorCompraEstornadaCentavos:purchaseReversalAmount,valorPagamentoEstornadoCentavos:applied,valorCaixaEstornadoCentavos:effectiveOriginalCashNet,valorReembolsadoCentavos:refundMode?applied:0,formaReembolso:refundMode?refundMethod:null,referenciaReembolso:refundMode?(refundReference||null):null,motivoCodigo:reason,motivo:cancellationReasonLabelV222(reason),detalhes:detail||null,entregasMarcadasPorEnganoIds:revertedDeliveryRows.map(o=>o.id),quantidadeEntregasEstornadas:revertedDeliveryRows.length,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,sessaoCaixaId:cashSessionId||null,severidade:'warning',descricaoHumana:refundMode?`${actor.nome} cancelou a venda ${saleId} de ${brl(total)} de ${sale.alunoNome||student.nome} e registrou reembolso de ${brl(applied)} ao pagador via ${refundMethod}.${revertedDeliveryRows.length?` Também corrigiu ${revertedDeliveryRows.length} entrega(s) marcada(s) por engano.`:''} Motivo: ${cancellationReasonLabelV222(reason)}.`:`${actor.nome} cancelou a venda presencial ${saleId} de ${brl(total)} de ${sale.alunoNome||student.nome}.${revertedDeliveryRows.length?` Também corrigiu ${revertedDeliveryRows.length} entrega(s) marcada(s) por engano.`:''} Motivo: ${cancellationReasonLabelV222(reason)}.`});
  for(const o of revertedDeliveryRows){await audit(db,'entrega_marcada_por_engano_revertida',{vendaId:saleId,pedidoId:o.pedidoId||null,ocorrenciaId:o.id,alunoId:o.alunoId||sale.alunoId,alunoNome:o.alunoNome||sale.alunoNome||student.nome,dataChave:o.dataChave||null,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,severidade:'warning',descricaoHumana:`${actor.nome} corrigiu a entrega ${o.id} de ${o.dataChave||'data não informada'}, que havia sido marcada como entregue por engano, durante o cancelamento da venda ${saleId}.`});await notify(db,{tipo:'entrega_corrigida',titulo:'Correção de entrega',mensagem:`A entrega de ${o.dataChave||'data não informada'} havia sido marcada como entregue por engano e foi corrigida junto com o cancelamento da compra.`,prioridade:'normal',alunoId:o.alunoId||sale.alunoId,alunoNome:o.alunoNome||sale.alunoNome||student.nome,pedidoId:o.pedidoId||null,ocorrenciaId:o.id,origem:'correcao_cancelamento',canal:'gestao',criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,destinatariosPerfis:['cantina','gestao','secretaria','admin'],destinatariosAlunos:[o.alunoId||sale.alunoId],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'})}
  return {ok:true,vendaId:saleId,status:'cancelada',alreadyCancelled:false,totalCentavos:total,valorCompraEstornadaCentavos:purchaseReversalAmount,valorPagamentoEstornadoCentavos:applied,valorCaixaEstornadoCentavos:effectiveOriginalCashNet,valorReembolsadoCentavos:refundMode?applied:0,formaReembolso:refundMode?refundMethod:null,entregasEstornadasIds:revertedDeliveryRows.map(o=>o.id),quantidadeEntregasEstornadas:revertedDeliveryRows.length,saldoAntesCancelamentoCentavos:resultBalance?.before,saldoDepoisCancelamentoCentavos:resultBalance?.after};
}


module.exports = {
  admin,
  initFirebase,
  json,
  parseBody,
  nowIso,
  buildCheckoutOperation,
  createCheckoutLink,
  checkoutOperationKey,
  replaceActiveCheckoutsForOperation,
  validCheckoutUrl,
  checkoutCustomerIssues,
  confirmWithInfinitePay,
  applyCheckoutConfirmation,
  recordInfinitePayEvent,
  checkoutPaymentDiagnostic,
  manualReconcileInfinitePay,
  isPaidResponse,
  mergePaymentEvidence,
  validatePaidCheckout,
  audit,
  notify,
  getConfig,
  getStudent,
  getAccount,
  accountRefForStudent,
  buildReceiptInfo,
  accountNet,
  splitNet,
  dailyUsed,
  lunchDayDefaultActive,
  lunchDayInfo,
  releasePendingOrder,
  discardCheckout,
  normalizeSecretarySaleItems,
  normalizeSecretaryMixedSale,
  normalizeFamilySecretaryMixedSale,
  registerInPersonOperation,
  cancelInPersonSale,
  confirmCantinaOrderWithoutCheckout,
  confirmUniformOrderWithoutCheckout
};
