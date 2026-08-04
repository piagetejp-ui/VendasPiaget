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
    bloqueio_semanal_saldo:'Bloqueio semanal aplicado',
    pedido_cantina_reservado:'Pedido da cantina reservado',
    pedido_cantina_confirmado:'Pedido da cantina confirmado',
    pedido_cantina_revisao:'Pedido da cantina enviado para revisão',
    pedido_farda_criado:'Pedido de fardamento criado',
    pedido_farda_confirmado:'Pedido de fardamento confirmado',
    venda_presencial_aluno:'Venda presencial registrada'
  };
  await safeAdd(db.collection('historico_auditoria'), {
    acao: action,
    acaoTecnica: action,
    dados: data,
    tituloHumano: titleMap[action] || action,
    descricaoHumana: data.descricaoHumana || data.descricao || '',
    categoria: action.startsWith('pedido_cantina') ? 'Pedidos da cantina' : action.startsWith('pedido_farda') ? 'Pedidos de fardamento' : action==='venda_presencial_aluno' ? 'Vendas da secretaria' : 'Pagamentos e conta do aluno',
    severidade: data.severidade || 'info',
    icone: data.icone || (action.startsWith('pedido_cantina') ? '🍽️' : action.startsWith('pedido_farda') ? '👕' : action==='venda_presencial_aluno' ? '🧾' : '💳'),
    usuarioId: data.usuarioId || data.criadoPorId || 'sistema_checkout',
    usuarioNome: data.usuarioNome || data.criadoPorNome || 'Sistema de pagamento',
    usuarioPerfil: data.usuarioPerfil || data.criadoPorPerfil || 'sistema',
    alunoId: data.alunoId || null,
    pagamentoId: data.pagamentoId || data.orderNsu || null,
    pedidoId: data.pedidoId || null,
    criadoEm: now,
    versao: '1.6.0-rc2-catalogo-vendas'
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
    destinatariosAlunos: Array.isArray(payload.destinatariosAlunos) ? payload.destinatariosAlunos : [],
    alunoId: payload.alunoId || null,
    alunoNome: payload.alunoNome || null,
    matricula: payload.matricula || null,
    pagamentoId: payload.pagamentoId || null,
    pedidoId: payload.pedidoId || null,
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
async function reserveUniformOrder(db, body, actor, student, customer){
  const input=body.farda||body.uniforme||body.pedido||{},modelId=String(input.modeloId||input.modelId||'camisa_padrao').trim(),size=String(input.tamanho||input.size||'').trim().toUpperCase(),gender=String(input.genero||input.modelo||input.gender||'').trim().toLowerCase(),qty=Math.max(1,cents(input.quantidade||input.quantity||1));
  if(!size)throw Object.assign(new Error('Selecione o tamanho da farda.'),{status:400});
  if(qty>10)throw Object.assign(new Error('A quantidade máxima por pedido de fardamento é 10.'),{status:400});
  const [modelSnap,acc]=await Promise.all([db.collection('modelos_farda').doc(modelId).get(),getAccount(db,student.id)]);
  if(!modelSnap.exists)throw Object.assign(new Error('Modelo de farda não encontrado.'),{status:404});
  const model={id:modelSnap.id,...modelSnap.data()};if(model.ativo===false||model.portal===false)throw Object.assign(new Error('Este modelo não está disponível para compra online.'),{status:400});
  const allowedSizes=[...(model.tamanhosInfantis||[]),...(model.tamanhosAdultos||[])].map(x=>String(x).toUpperCase());if(allowedSizes.length&&!allowedSizes.includes(size))throw Object.assign(new Error('O tamanho selecionado não pertence a este modelo de farda.'),{status:400});
  const adult=(model.tamanhosAdultos||['P','M','G','GG','XGG']).map(x=>String(x).toUpperCase()).includes(size);if(adult&&model.generoAdulto!==false&&gender&&!['masculino','feminino','unissex'].includes(gender))throw Object.assign(new Error('A variação selecionada não é válida para este modelo.'),{status:400});const unit=cents(adult?(model.precoAdultoCentavos||4700):(model.precoInfantilCentavos||4200)),total=unit*qty,saldoAtual=accountNet(acc),useBalance=body.usarSaldo===true,creditUsed=useBalance?Math.min(Math.max(0,saldoAtual),total):0,debtRequired=Math.max(0,-saldoAtual),required=total-creditUsed+debtRequired,orderRef=db.collection('pedidos_farda').doc(),now=nowIso();
  await orderRef.set({id:orderRef.id,tipoPedido:'farda',alunoId:student.id,alunoNome:student.nome,turma:student.turma||null,turno:student.turno||null,matricula:student.matricula||null,responsavelFinanceiro:student.responsavelFinanceiro||null,produto:model.nome||'Camisa de farda',modeloFardaId:model.id,tamanho:size,modelo:adult?(gender||'unissex'):'',quantidade:qty,precoUnitarioCentavos:unit,totalCentavos:total,usarSaldo:useBalance,valorSaldoPrevistoCentavos:creditUsed,valorRegularizacaoPrevistoCentavos:debtRequired,statusPagamento:required>0?'aguardando_pagamento':'pago_com_saldo',statusAtendimento:'aguardando_pagamento',statusAplicacao:'pendente',saldoNoMomentoCentavos:saldoAtual,valorCheckoutPrevistoCentavos:required,customer:customer||null,origem:actor.perfil==='responsavel'?'portal_responsavel':'operacao_interna',criadoPor:actor.id,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2-catalogo-vendas'});
  await audit(db,'pedido_farda_criado',{pedidoId:orderRef.id,alunoId:student.id,alunoNome:student.nome,valorCentavos:total,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,descricaoHumana:`${actor.nome} criou um pedido de fardamento para ${student.nome}.`});
  return {pedidoId:orderRef.id,totalCentavos:total,checkoutTotal:required,saldoAtual,useBalance,creditUsed,debtRequired,model,size,gender:adult?(gender||'unissex'):'',qty,unit};
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
async function loadProductMap(db){
  const snap=await db.collection('produtos').get();
  return new Map(snap.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
}

async function loadCatalogItemMap(db){
  const snap=await db.collection('catalogo_itens').get().catch(()=>({docs:[]}));
  return new Map((snap.docs||[]).map(d=>[d.id,{id:d.id,...d.data()}]));
}
async function loadCatalogCategoryMap(db){
  const snap=await db.collection('catalogo_categorias').get().catch(()=>({docs:[]}));
  return new Map((snap.docs||[]).map(d=>[d.id,{id:d.id,...d.data()}]));
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
async function normalizeSecretarySaleItems(db,raw=[],channel='presencial'){
  const [productMap,catalogMap,categoryMap]=await Promise.all([loadProductMap(db),loadCatalogItemMap(db),loadCatalogCategoryMap(db)]),lines=[],expanded=new Map(),catalogRequirements=new Map();let total=0;
  for(const rawItem of raw){
    const item={...rawItem};
    if(item.tipo==='farda'&&!item.catalogoItemId){const qty=Math.max(1,cents(item.quantidade||1)),unit=cents(item.precoUnitarioCentavos),line=unit*qty;if(unit<=0)throw Object.assign(new Error('Preço de farda inválido.'),{status:400});total+=line;lines.push({...item,tipo:'farda',quantidade:qty,precoUnitarioCentavos:unit,totalCentavos:line,nome:item.nome||'Camisa de farda'});continue;}
    if(item.tipo==='catalogo_item'||item.catalogoItemId){
      const cat=catalogMap.get(String(item.catalogoItemId||''));
      if(!cat||cat.ativo===false||!catalogCategoryAllowed(cat.categoriaId,categoryMap)||!catalogChannelAllowed(cat,channel))throw Object.assign(new Error('Item do catálogo inválido, inativo ou indisponível neste canal.'),{status:400});
      if(!catalogSaleWindowAllowed(cat))throw Object.assign(new Error(`${cat.nome} não está disponível no período atual.`),{status:409});
      const qty=Math.max(1,cents(item.quantidade||1));if(qty>100)throw Object.assign(new Error('Quantidade acima do limite permitido.'),{status:400});
      const meta=normalizeCatalogMetadata(cat,item),adultSize=(cat.tamanhosAdultos||['P','M','G','GG','XGG']).map(x=>String(x).toUpperCase()).includes(String(meta.tamanho||'').toUpperCase()),unit=cat.precoEditavel?cents(item.precoUnitarioCentavos):cents(cat.tipoOperacional==='fardamento'&&adultSize?(cat.precoAdultoCentavos||cat.precoCentavos):cat.precoCentavos);
      if(unit<=0)throw Object.assign(new Error(`Informe um valor válido para ${cat.nome}.`),{status:400});
      const line=unit*qty;total+=line;
      const common={catalogoItemId:cat.id,nome:cat.nome,descricao:cat.descricao||'',tipoOperacional:cat.tipoOperacional||'servico',categoriaId:cat.categoriaId||null,categoria:item.categoria||'',quantidade:qty,precoUnitarioCentavos:unit,totalCentavos:line,controleEstoque:cat.controleEstoque||'sem_estoque',metadados:meta,dataEvento:cat.dataEvento||null};
      if(cat.tipoOperacional==='fardamento')lines.push({...common,tipo:'farda',modeloFardaId:cat.legacyUniformModelId||item.modeloFardaId||'catalogo',tamanho:meta.tamanho,modelo:meta.modelo,statusAtendimento:'aguardando_producao'});else lines.push({...common,tipo:'catalogo_item'});
      expandCatalogStock(cat,qty,catalogMap,catalogRequirements);
      if(cat.legacyProdutoId){const product=productMap.get(cat.legacyProdutoId);if(product)expandProduct(product,qty,productMap,expanded);}
      continue;
    }
    const product=productMap.get(String(item.produtoId||''));if(!product||product.ativo===false)throw Object.assign(new Error('Produto inválido ou inativo.'),{status:400});const qty=Math.max(1,cents(item.quantidade||1)),unit=productPrice(product,productMap),line=unit*qty;total+=line;lines.push({tipo:'produto',produtoId:product.id,nome:product.nome,quantidade:qty,precoUnitarioCentavos:unit,totalCentavos:line,categoria:product.categoria||'Cantina'});expandProduct(product,qty,productMap,expanded);
  }
  return {total,lines,expanded,catalogStock:[...catalogRequirements.values()]};
}
function normalizeOrderInput(body, productMap, student, cfg){
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
    const d=new Date(`${day}T12:00:00`);
    if([0,6].includes(d.getDay())) throw Object.assign(new Error(`A data ${day} não é um dia útil.`),{status:400});
    if((cfg.diasSemAula||[]).includes(day)) throw Object.assign(new Error(`A data ${day} está marcada como dia sem aula.`),{status:400});
    const product=productMap.get(productId);
    if(!product || product.ativo===false || product.portal===false || product.vendaResponsavel===false) throw Object.assign(new Error('Um dos produtos selecionados não está disponível no portal.'),{status:400});
    const list=grouped.get(day)||[];
    const found=list.find(x=>x.produtoId===productId);
    if(found) found.quantidade+=qty;
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
  const [productMap,acc]=await Promise.all([loadProductMap(db),getAccount(db,student.id)]),normalized=normalizeOrderInput(body,productMap,student,cfg),saldoAtual=accountNet(acc),useBalance=body.usarSaldo===true,creditUsed=useBalance?Math.min(Math.max(0,saldoAtual),normalized.totalCentavos):0,debtRequired=Math.max(0,-saldoAtual),minCheckout=Math.max(100,cents(cfg.valorMinimoCheckoutPositivoCentavos||100)),required=Math.max(0,normalized.totalCentavos-creditUsed+debtRequired),checkoutTotal=required>0?Math.max(required,minCheckout):0,projectedNet=saldoAtual+checkoutTotal-normalized.totalCentavos,orderRef=db.collection('pedidos').doc(),pedidoId=orderRef.id,minutes=Math.min(10,Math.max(1,cents(cfg.reservaPedidoMinutos||ORDER_RESERVATION_MINUTES_DEFAULT))),expiresAt=new Date(Date.now()+minutes*60*1000).toISOString(),now=nowIso(),capacityRefs=normalized.days.filter(x=>x.quantidadeSalgados>0).map(day=>({day,ref:db.collection('disponibilidade_salgados').doc(day.dataChave)}));
  await db.runTransaction(async tx=>{const snaps=await Promise.all(capacityRefs.map(x=>tx.get(x.ref)));for(let i=0;i<capacityRefs.length;i++){const {day,ref}=capacityRefs[i],current=snaps[i].exists?snaps[i].data():{},planned=cents(current.quantidadePlanejada||cfg.quantidadePadraoSalgados||30),used=dailyUsed(current);if(used+day.quantidadeSalgados>planned){const err=new Error(`Não há salgados suficientes em ${day.dataChave}. Disponíveis: ${Math.max(0,planned-used)}.`);err.status=409;throw err}const reservas={...(current.reservas||{})};reservas[pedidoId]={pedidoId,alunoId:student.id,alunoNome:student.nome,quantidade:day.quantidadeSalgados,expiraEm:expiresAt,criadoEm:now};tx.set(ref,{dataChave:day.dataChave,quantidadePlanejada:planned,reservas,atualizadoEm:now},{merge:true})}tx.set(orderRef,{id:pedidoId,tipoPedido:'cantina',modalidade:normalized.modalidade,alunoId:student.id,alunoNome:student.nome,turma:student.turma||null,turno:student.turno||null,matricula:student.matricula||null,responsavelFinanceiro:student.responsavelFinanceiro||null,dias:normalized.days,observacao:normalized.observacao,totalCentavos:normalized.totalCentavos,usarSaldo:useBalance,valorSaldoPrevistoCentavos:creditUsed,valorRegularizacaoPrevistoCentavos:debtRequired,saldoNoMomentoCentavos:saldoAtual,valorCheckoutPrevistoCentavos:checkoutTotal,saldoProjetadoDepoisCentavos:projectedNet,statusPagamento:checkoutTotal>0?'aguardando_pagamento':'pago_com_saldo',statusPedido:checkoutTotal>0?'aguardando_pagamento':'reservado',statusAplicacao:'pendente',reservaMinutos:minutes,reservaExpiraEm:expiresAt,customer:customer||null,origem:actor.perfil==='responsavel'?'portal_responsavel':'operacao_interna',criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil,criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2-catalogo-vendas'})});
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
    const capacityRefs=(order.dias||[]).filter(x=>cents(x.quantidadeSalgados)>0).map(day=>({day,ref:db.collection('disponibilidade_salgados').doc(day.dataChave)}));
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
  const snap=await db.collection('pagamentos_checkout').where('alunoId','==',alunoId).get(),active=['preparando_link','aguardando_pagamento','erro_timeout','erro_gerar_link','erro_sem_url'];
  const rows=snap.docs.map(doc=>({id:doc.id,ref:doc.ref,...doc.data()})).filter(row=>row.operationKey===operationKey&&active.includes(row.status)&&row.statusAplicacao!=='aplicado');
  const now=nowIso();
  for(const row of rows){
    await row.ref.set({statusAnterior:row.status,status:'substituido_nova_cobranca',statusAplicacao:'substituido_sem_pagamento',checkoutUrlAtivo:false,ocultoParaResponsavel:true,substituidoEm:now,atualizadoEm:now,versao:'1.6.0-rc2-catalogo-vendas'},{merge:true});
    await invalidateCheckoutAttempt(db,row,'nova_tentativa_mesma_operacao').catch(()=>{});
    if(row.pedidoId&&row.tipo==='pedido_cantina')await releasePendingOrder(db,row.pedidoId,'substituido_nova_cobranca').catch(()=>{});
    if(row.pedidoId&&row.tipo==='pedido_farda')await safeSet(db.collection('pedidos_farda').doc(row.pedidoId),{statusPagamento:'nao_concluido',statusAtendimento:'cancelado',statusAplicacao:'substituido',motivoCancelamento:'Cobrança substituída por uma nova tentativa.',atualizadoEm:now});
  }
  return rows.map(row=>row.id);
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
    const descricao=`Pedido de cantina - ${aluno.nome}`;
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
      responsavelFinanceiro:aluno.responsavelFinanceiro||null,
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
    const descricao=`Pedido de fardamento - ${aluno.nome}`;
    return {tipo,actor,operationKey,totalCentavos:reservation.checkoutTotal,pedidoTotalCentavos:reservation.totalCentavos,minimoCentavos:reservation.checkoutTotal>0?reservation.checkoutTotal:0,descricao,
      alunoId:aluno.id,alunoNome:aluno.nome,turma:aluno.turma||null,turno:aluno.turno||null,matricula:aluno.matricula||null,responsavelFinanceiro:aluno.responsavelFinanceiro||null,
      saldoNoMomentoCentavos:reservation.saldoAtual,saldoEmAbertoNoMomentoCentavos:Math.max(0,-reservation.saldoAtual),pedidoId:reservation.pedidoId,
      itensCheckout:reservation.checkoutTotal>0?[{quantity:1,price:reservation.checkoutTotal,description:descricao}]:[],customer,
      payload:{pedidoId:reservation.pedidoId,pedidoTotalCentavos:reservation.totalCentavos,tamanho:reservation.size,modelo:reservation.gender,quantidade:reservation.qty},criadoEm:now};
  }
  if(tipo==='venda_online_secretaria'){
    const raw=Array.isArray(body.itens)?body.itens:[];
    if(!raw.length)throw Object.assign(new Error('Adicione ao menos um item à venda.'),{status:400});
    const normalized=await normalizeSecretarySaleItems(db,raw,'online'),total=normalized.total,lines=normalized.lines,expanded=normalized.expanded,catalogStock=normalized.catalogStock;
    const acc=await getAccount(db,aluno.id),saldoAtual=accountNet(acc),usarSaldo=body.usarSaldo===true,creditoUsado=usarSaldo?Math.min(Math.max(0,saldoAtual),total):0,regularizacao=Math.max(0,-saldoAtual),checkoutTotal=Math.max(0,total-creditoUsado+regularizacao),descricao=`Venda online da Secretaria - ${aluno.nome}`;
    return {tipo,actor,operationKey,totalCentavos:checkoutTotal,pedidoTotalCentavos:total,minimoCentavos:checkoutTotal>0?checkoutTotal:0,descricao,alunoId:aluno.id,alunoNome:aluno.nome,turma:aluno.turma||null,turno:aluno.turno||null,matricula:aluno.matricula||null,responsavelFinanceiro:aluno.responsavelFinanceiro||null,saldoNoMomentoCentavos:saldoAtual,saldoEmAbertoNoMomentoCentavos:regularizacao,vendaOnlineId:String(body.vendaOnlineId||''),itensCheckout:checkoutTotal>0?[{quantity:1,price:checkoutTotal,description:descricao}]:[],customer,payload:{vendaOnlineId:String(body.vendaOnlineId||''),itens:lines,componentes:[...expanded.values()],estoquesCatalogo:catalogStock,usarSaldo,creditoUsadoCentavos:creditoUsado,regularizacaoCentavos:regularizacao,pedidoTotalCentavos:total,saldoNoMomentoCentavos:saldoAtual},criadoEm:now};
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
  const descricao = saldoAtual < 0 ? `Regularização de saldo - ${aluno.nome}` : `Crédito cantina - ${aluno.nome}`;
  return {
    tipo, actor, operationKey, totalCentavos:total, minimoCentavos:minimo, descricao,
    alunoId:aluno.id, alunoNome:aluno.nome, turma:aluno.turma || null, turno:aluno.turno||null, matricula:aluno.matricula || null,
    responsavelFinanceiro:aluno.responsavelFinanceiro || null,
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
  const handle=normalizeHandle(),baseUrl=getBaseUrl(req),nsuType=op.tipo==='entrada_conta_aluno'?'CONTA':op.tipo==='pedido_cantina'?'PEDIDO':op.tipo==='pedido_farda'?'FARDA':op.tipo==='venda_online_secretaria'?'VENDAONLINE':'OPERACAO',orderNsu=makeOrderNsu(nsuType),redirectUrl=`${baseUrl}/obrigado.html`,webhookUrl=`${baseUrl}/api/webhook-infinitepay`,payload={handle,order_nsu:orderNsu,redirect_url:redirectUrl,webhook_url:webhookUrl,items:op.itensCheckout};if(op.customer)payload.customer=op.customer;
  const checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu),persistStart=Date.now();
  await checkoutRef.set({id:orderNsu,orderNsu,idTentativa:op.idTentativa||null,operationKey:op.operationKey||null,handle,tipo:op.tipo,pedidoId:op.pedidoId||null,vendaOnlineId:op.vendaOnlineId||null,pedidoTotalCentavos:op.pedidoTotalCentavos||0,reservaExpiraEm:op.reservaExpiraEm||null,reservaMinutos:op.reservaMinutos||null,alunoId:op.alunoId||null,alunoNome:op.alunoNome||null,turma:op.turma||null,turno:op.turno||null,matricula:op.matricula||null,responsavelFinanceiro:op.responsavelFinanceiro||null,descricao:op.descricao,totalCentavos:op.totalCentavos,minimoCentavos:op.minimoCentavos||0,saldoNoMomentoCentavos:op.saldoNoMomentoCentavos||0,saldoEmAbertoNoMomentoCentavos:op.saldoEmAbertoNoMomentoCentavos||0,status:'preparando_link',statusAplicacao:'pendente',payloadOperacional:op.payload||{},itensCheckout:op.itensCheckout,customer:op.customer||null,redirectUrl,webhookUrl,origem:'checkout_infinitepay',criadoPorId:op.actor.id,criadoPorNome:op.actor.nome,criadoPorPerfil:op.actor.perfil,criadoEm:nowIso(),atualizadoEm:nowIso(),versao:'1.6.0-rc2-catalogo-vendas'},{merge:false});
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
  await safeSet(ref,{id:ref.id,orderNsu,source,payload:paymentData,evidence,criadoEm:now,versao:'1.6.0-rc2-catalogo-vendas'},{merge:false});
  return evidence;
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
    erroAplicacao:c.erroAplicacao || null
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
    return {paid:true,applicationPending:false,alreadyApplied:true,needsIdentifiers:false,infinitepay:checkout.ultimoPaymentCheckPayload||{},receipt:await buildReceiptInfo(db,orderNsu)};
  }

  if(!evidence.transactionNsu || !evidence.invoiceSlug){
    await safeSet(checkoutRef,{status:checkout.status||'aguardando_pagamento',identificadoresPendentes:true,atualizadoEm:nowIso()});
    return {paid:false,applicationPending:false,needsIdentifiers:true,missing:{transactionNsu:!evidence.transactionNsu,invoiceSlug:!evidence.invoiceSlug},message:'Aguardando os identificadores completos da InfinitePay.',infinitepay:null,receipt:await buildReceiptInfo(db,orderNsu)};
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
  return {paid,applicationPending,applicationError,needsIdentifiers:false,infinitepay:data,receipt:await buildReceiptInfo(db,orderNsu)};
}
async function applyAccountPaymentTx(tx, db, checkout, paymentData={}){
  const accRef=db.collection('contas_alunos').doc(checkout.alunoId);
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
  const accRef=db.collection('contas_alunos').doc(order.alunoId);
  const accSnap=await tx.get(accRef);
  const acc=accSnap.exists?accSnap.data():{};
  const capacityRefs=(order.dias||[]).filter(x=>cents(x.quantidadeSalgados)>0).map(day=>({day,ref:db.collection('disponibilidade_salgados').doc(day.dataChave)}));
  const capacitySnaps=await Promise.all(capacityRefs.map(x=>tx.get(x.ref)));
  const externalPayment=cents(checkout.totalCentavos);
  const orderTotal=cents(order.totalCentavos);
  const oldNet=accountNet(acc);
  const afterPayment=oldNet+externalPayment;
  const finalNet=afterPayment-orderTotal;
  let reviewReason='';
  if(finalNet<0) reviewReason='saldo_insuficiente_no_momento_da_confirmacao';
  for(let i=0;i<capacityRefs.length&&!reviewReason;i++){
    const current=capacitySnaps[i].exists?capacitySnaps[i].data():{};
    const planned=cents(current.quantidadePlanejada||30);
    const used=dailyUsed(current,order.id);
    if(used+capacityRefs[i].day.quantidadeSalgados>planned) reviewReason=`estoque_indisponivel_${capacityRefs[i].day.dataChave}`;
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
      versao:'1.6.0-rc2-catalogo-vendas'
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
    await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Novo pedido de cantina',mensagem:`${order.alunoNome||'Aluno'}: ${(order.dias||[]).length} entrega(s) adicionada(s) à agenda da cantina.`,prioridade:'normal',alunoId:order.alunoId,alunoNome:order.alunoNome,matricula:order.matricula,pedidoId,destinatariosPerfis:['cantina','admin','gestao','secretaria'],destinatariosAlunos:[],acaoPrincipal:'abrir_entregas',acaoLabel:'Ver agenda da cantina'});
    await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Pedido de cantina confirmado',mensagem:`Pagamento confirmado. ${(order.dias||[]).length} entrega(s) programada(s), aguardando entrega.`,prioridade:'normal',alunoId:order.alunoId,alunoNome:order.alunoNome,matricula:order.matricula,pedidoId,destinatariosPerfis:[],destinatariosAlunos:[order.alunoId],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
  }
  return result;
}

async function applyUniformOrderTx(tx,db,checkout,paymentData={}){
  const orderRef=db.collection('pedidos_farda').doc(checkout.pedidoId);
  const orderSnap=await tx.get(orderRef);
  if(!orderSnap.exists)throw new Error('Pedido de fardamento não encontrado.');
  const order={id:orderSnap.id,...orderSnap.data()};
  if(order.statusAplicacao==='aplicado')return {status:'confirmado',alreadyApplied:true,saldoDepoisCentavos:order.saldoDepoisCentavos};

  // Firestore exige que TODAS as leituras da transação ocorram antes da primeira gravação.
  const accRef=db.collection('contas_alunos').doc(order.alunoId);
  const stockRef=db.collection('estoques').doc(uniformStockId(order.modeloFardaId||'camisa_padrao',order.tamanho,order.modelo||''));
  const accSnap=await tx.get(accRef);
  const stockSnap=await tx.get(stockRef);

  const acc=accSnap.exists?accSnap.data():{};
  const external=cents(checkout.totalCentavos),total=cents(order.totalCentavos),before=accountNet(acc),afterPayment=before+external,after=afterPayment-total,now=nowIso();
  if(after<0)throw new Error('O pagamento não é suficiente para concluir o pedido de fardamento.');

  let atendimento='aguardando_producao',stockUpdate=null;
  if(stockSnap.exists){
    const st=stockSnap.data(),available=Math.max(0,cents(st.quantidadeFisica)-cents(st.quantidadeReservada));
    if(st.configurado&&available>=cents(order.quantidade)){
      atendimento='reservado_estoque';
      stockUpdate={quantidadeReservada:cents(st.quantidadeReservada)+cents(order.quantidade),atualizadoEm:now};
    }
  }

  // A partir daqui, somente gravações.
  tx.set(accRef,{...splitNet(after),bloqueioSaldoSemanal:false,bloqueadoPorLimite:false,ultimaRegularizacaoEm:now,atualizadoEm:now},{merge:true});
  if(external>0){
    const m=financialMovementRef(db,checkout,'entrada');
    tx.set(m,{id:m.id,alunoId:order.alunoId,tipo:'entrada_conta_aluno',subtipo:'pagamento_pedido_farda',valorCentavos:external,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,formaPagamento:'checkout_infinitepay',orderNsu:checkout.orderNsu||checkout.id,pedidoId:order.id,status:'confirmado',dataChave:dateKey(),criadoEm:now,detalhesPagamento:paymentData});
  }
  const purchase=financialMovementRef(db,checkout,'compra');
  tx.set(purchase,{id:purchase.id,alunoId:order.alunoId,tipo:'compra',subtipo:'pedido_farda',valorCentavos:-total,valorCompraCentavos:total,saldoAntesCentavos:afterPayment,saldoDepoisCentavos:after,pedidoId:order.id,itens:[{nome:order.produto||'Farda',quantidade:order.quantidade,tamanho:order.tamanho,modelo:order.modelo,precoUnitarioCentavos:order.precoUnitarioCentavos}],origem:'pedido_fardamento',formaPagamento:external>0?(order.usarSaldo===true&&before>0?'saldo_e_checkout':'checkout_infinitepay'):'saldo_conta',status:'confirmado',dataChave:dateKey(),criadoEm:now});
  if(stockUpdate)tx.set(stockRef,stockUpdate,{merge:true});
  tx.set(orderRef,{statusPagamento:'pago',statusAtendimento:atendimento,statusAplicacao:'aplicado',valorPagoExternoCentavos:external,valorDebitadoContaCentavos:total,valorSaldoAnteriorUtilizadoCentavos:order.usarSaldo===true?Math.min(Math.max(before,0),total):0,saldoAntesCentavos:before,saldoDepoisCentavos:after,pagamentoConfirmadoEm:now,confirmadoEm:now,atualizadoEm:now},{merge:true});
  return {status:'confirmado',saldoDepoisCentavos:after,statusAtendimento:atendimento};
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
  const payload=checkout.payloadOperacional||{},lines=Array.isArray(payload.itens)?payload.itens:[],components=Array.isArray(payload.componentes)?payload.componentes:[],catalogStock=Array.isArray(payload.estoquesCatalogo)?payload.estoquesCatalogo:[],total=cents(checkout.pedidoTotalCentavos||payload.pedidoTotalCentavos),external=cents(checkout.totalCentavos),accRef=db.collection('contas_alunos').doc(checkout.alunoId),saleRef=db.collection('vendas').doc(`ONLINE-${safeFinancialId(checkout.orderNsu||checkout.id)}`),linkRef=checkout.vendaOnlineId?db.collection('vendas_online_links').doc(checkout.vendaOnlineId):null;
  const salgadoQty=components.filter(x=>x.produtoId==='salgado').reduce((sum,x)=>sum+cents(x.quantidade),0),stockRef=salgadoQty>0?db.collection('disponibilidade_salgados').doc(dateKey()):null,catalogRefs=catalogStock.map(x=>({line:x,ref:db.collection('catalogo_itens').doc(x.itemId)}));
  const readRefs=[accRef,saleRef,...(stockRef?[stockRef]:[]),...(linkRef?[linkRef]:[]),...catalogRefs.map(x=>x.ref)],snaps=await Promise.all(readRefs.map(r=>tx.get(r)));let pos=0;const accSnap=snaps[pos++],saleSnap=snaps[pos++],stockSnap=stockRef?snaps[pos++]:null,linkSnap=linkRef?snaps[pos++]:null,catalogSnaps=catalogRefs.map(()=>snaps[pos++]);
  if(saleSnap.exists&&saleSnap.data()?.status==='confirmada')return{status:'confirmado',alreadyApplied:true,saldoDepoisCentavos:saleSnap.data().saldoDepoisCentavos};
  const acc=accSnap.exists?accSnap.data():{},before=accountNet(acc),afterPayment=before+external,after=afterPayment-total,now=nowIso();let reviewReason='';
  if(after<0)reviewReason='saldo_insuficiente_no_momento_da_confirmacao';
  if(stockRef&&!reviewReason){const stock=stockSnap&&stockSnap.exists?stockSnap.data():{},cfg=await getConfig(db),planned=cents(stock.quantidadePlanejada||cfg.quantidadePadraoSalgados||30),used=dailyUsed(stock);if(used+salgadoQty>planned)reviewReason='estoque_indisponivel_no_momento_do_pagamento';}
  if(!reviewReason)catalogRefs.forEach((entry,i)=>{const doc=catalogSnaps[i].exists?catalogSnaps[i].data():{},available=catalogAvailableUnits(doc,entry.line);if(available<entry.line.quantidade)reviewReason=`estoque_catalogo_indisponivel:${entry.line.itemId}`;});
  const entryRef=financialMovementRef(db,checkout,'entrada'),purchaseRef=financialMovementRef(db,checkout,'compra');
  if(reviewReason){
    tx.set(accRef,{...splitNet(afterPayment),bloqueioSaldoSemanal:afterPayment<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:afterPayment<0&&cents(acc.limiteFiadoCentavos)>0&&Math.abs(afterPayment)>=cents(acc.limiteFiadoCentavos),atualizadoEm:now},{merge:true});
    if(external>0)tx.set(entryRef,{id:entryRef.id,alunoId:checkout.alunoId,tipo:'entrada_conta_aluno',subtipo:'pagamento_venda_online_em_revisao',valorCentavos:external,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,formaPagamento:'checkout_infinitepay',orderNsu:checkout.orderNsu||checkout.id,status:'confirmado',dataChave:dateKey(),criadoEm:now,detalhesPagamento:paymentData});
    tx.set(saleRef,{id:saleRef.id,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula||null,origem:'secretaria_online',orderNsu:checkout.orderNsu||checkout.id,valorBrutoCentavos:total,valorPagoExternoCentavos:external,itens:lines,status:'revisao',motivoRevisao:reviewReason,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,dataChave:dateKey(),criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2-catalogo-vendas'},{merge:true});
    if(linkRef)tx.set(linkRef,{status:'pago_revisao',motivoRevisao:reviewReason,orderNsu:checkout.orderNsu||checkout.id,pagoEm:now,atualizadoEm:now},{merge:true});
    return{status:'revisao',motivo:reviewReason,saldoDepoisCentavos:afterPayment};
  }
  tx.set(accRef,{...splitNet(after),bloqueioSaldoSemanal:after<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:after<0&&cents(acc.limiteFiadoCentavos)>0&&Math.abs(after)>=cents(acc.limiteFiadoCentavos),ultimaRegularizacaoEm:after>=0?now:(acc.ultimaRegularizacaoEm||null),atualizadoEm:now},{merge:true});
  if(external>0)tx.set(entryRef,{id:entryRef.id,alunoId:checkout.alunoId,tipo:'entrada_conta_aluno',subtipo:'pagamento_venda_online_secretaria',valorCentavos:external,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,formaPagamento:'checkout_infinitepay',orderNsu:checkout.orderNsu||checkout.id,vendaId:saleRef.id,status:'confirmado',dataChave:dateKey(),criadoEm:now,detalhesPagamento:paymentData});
  tx.set(purchaseRef,{id:purchaseRef.id,alunoId:checkout.alunoId,tipo:'compra',subtipo:'venda_secretaria_online',valorCentavos:-total,valorCompraCentavos:total,saldoAntesCentavos:afterPayment,saldoDepoisCentavos:after,vendaId:saleRef.id,itens:lines,origem:'secretaria_online',formaPagamento:external>0?(payload.usarSaldo===true&&before>0?'saldo_e_checkout':'checkout_infinitepay'):'saldo_conta',orderNsu:checkout.orderNsu||checkout.id,status:'confirmado',dataChave:dateKey(),criadoEm:now});
  tx.set(saleRef,{id:saleRef.id,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula||null,origem:'secretaria_online',orderNsu:checkout.orderNsu||checkout.id,operadorId:checkout.criadoPorId||null,operadorNome:checkout.criadoPorNome||'Secretaria',formaPagamento:external>0?'checkout_infinitepay':'saldo_conta',valorBrutoCentavos:total,valorRecebidoCentavos:external,valorSaldoUtilizadoCentavos:Math.max(0,total-external-Math.max(0,-before)),itens:lines,dataChave:dateKey(),criadoEm:now,atualizadoEm:now,status:'confirmada',saldoAntesCentavos:before,saldoDepoisCentavos:after,schemaVersion:5,versao:'1.6.0-rc2-catalogo-vendas'},{merge:true});
  if(stockRef){const stock=stockSnap&&stockSnap.exists?stockSnap.data():{},cfg=await getConfig(db),planned=cents(stock.quantidadePlanejada||cfg.quantidadePadraoSalgados||30);tx.set(stockRef,{dataChave:dateKey(),quantidadePlanejada:planned,vendidoAvulso:cents(stock.vendidoAvulso)+salgadoQty,atualizadoEm:now},{merge:true});}
  catalogRefs.forEach((entry,i)=>{const doc=catalogSnaps[i].exists?catalogSnaps[i].data():{};tx.set(entry.ref,catalogStockUpdate(doc,entry.line,now),{merge:true});});
  let idx=0;for(const line of lines.filter(x=>x.tipo==='farda')){const fr=db.collection('pedidos_farda').doc(`${saleRef.id}__F${++idx}`);tx.set(fr,{id:fr.id,vendaId:saleRef.id,orderNsu:checkout.orderNsu||checkout.id,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,turma:checkout.turma||null,produto:line.nome,tamanho:line.tamanho||'',modelo:line.modelo||'',modeloFardaId:line.modeloFardaId||'catalogo',catalogoItemId:line.catalogoItemId||null,quantidade:line.quantidade,precoUnitarioCentavos:line.precoUnitarioCentavos,totalCentavos:line.totalCentavos,statusPagamento:'pago',statusAtendimento:line.statusAtendimento||'aguardando_producao',criadoPor:checkout.criadoPorId||'secretaria_online',criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2-catalogo-vendas'},{merge:true});}
  if(linkRef)tx.set(linkRef,{status:'pago',orderNsu:checkout.orderNsu||checkout.id,vendaId:saleRef.id,pagoEm:now,atualizadoEm:now},{merge:true});
  return{status:'confirmado',vendaId:saleRef.id,saldoDepoisCentavos:after};
}

async function applyCheckoutConfirmation(db, orderNsu, paymentData={}, options={}){
  const checkoutRef=db.collection('pagamentos_checkout').doc(orderNsu);
  const snap=await checkoutRef.get();
  if(!snap.exists) throw Object.assign(new Error('Pedido de checkout não encontrado no sistema.'),{status:404});
  const checkout={id:snap.id,...snap.data(),orderNsu:snap.id};
  const evidence=mergePaymentEvidence(paymentData,checkout,checkout.ultimoWebhookPayload||{},checkout.ultimoPaymentCheckPayload||{});
  validatePaidCheckout(checkout,paymentData,evidence);
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
      tx.set(transactionRef,{id:transactionRef.id,transactionNsu:evidence.transactionNsu,orderNsu,pedidoId:c.pedidoId||null,alunoId:c.alunoId||null,amountCentavos:evidence.amountCentavos,status:'aplicado',confirmadoEm:now,atualizadoEm:now},{merge:true});
      tx.set(payRef,{id:orderNsu,orderNsu,pedidoId:c.pedidoId||null,alunoId:c.alunoId||null,alunoNome:c.alunoNome||null,valorBrutoCentavos:c.totalCentavos,pedidoTotalCentavos:c.pedidoTotalCentavos||0,formaPagamento:'checkout_infinitepay',status:'confirmado',origem:'checkout_infinitepay',tipo:c.tipo,...evidence,paidAmountCentavos:evidence.paidAmountCentavos||cents(c.totalCentavos),amountCentavos:evidence.amountCentavos||cents(c.totalCentavos),dataChave:dateKey(),criadoEm:c.pagamentoConfirmadoEm||now,confirmadoEm:now,payloadInfinitePay:paymentData},{merge:true});
      tx.set(checkoutRef,{status:operationResult.cobrancaDescartada?'pago_descartado_creditado':'pago',statusAplicacao:'aplicado',resultadoOperacional:operationResult.status||'confirmado',pagamentoConfirmadoEm:now,...evidence,paidAmountCentavos:evidence.paidAmountCentavos||cents(c.totalCentavos),amountCentavos:evidence.amountCentavos||cents(c.totalCentavos),ultimoPayloadConfirmado:paymentData,erroAplicacao:null,identificadoresPendentes:false,atualizadoEm:now},{merge:true});
    });
  }catch(error){
    await safeSet(checkoutRef,{...evidence,status:'pagamento_localizado_aguardando_processamento',statusAplicacao:'erro_processamento',erroAplicacao:compactError(error),ultimoPayloadConfirmado:paymentData,atualizadoEm:nowIso()});
    throw error;
  }
  if(alreadyAppliedInside)return {ok:true,alreadyApplied:true};
  if(checkout.vendaOnlineId)await safeSet(db.collection('vendas_online_links').doc(checkout.vendaOnlineId),{status:operationResult.status==='revisao'?'pago_revisao':'pago',orderNsu,pedidoId:checkout.pedidoId||null,vendaId:operationResult.vendaId||null,pagoEm:nowIso(),atualizadoEm:nowIso()});

  await audit(db,'checkout_pagamento_confirmado',{orderNsu,pagamentoId:orderNsu,pedidoId:checkout.pedidoId||null,tipo:checkout.tipo,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:checkout.totalCentavos,descricaoHumana:`Pagamento InfinitePay de ${brl(checkout.totalCentavos)} confirmado para ${checkout.alunoNome||'operação avulsa'}.`});
  if(operationResult.cobrancaDescartada){
    await audit(db,'checkout_descartado_pago_creditado',{orderNsu,pagamentoId:orderNsu,pedidoId:checkout.pedidoId||null,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:checkout.totalCentavos,severidade:'warning',descricaoHumana:`Uma cobrança descartada foi paga posteriormente. O valor de ${brl(checkout.totalCentavos)} foi creditado na conta do aluno sem repetir o pedido.`});
    await notify(db,{tipo:'checkout_descartado_pago_creditado',titulo:'Cobrança descartada foi paga',mensagem:`O valor de ${brl(checkout.totalCentavos)} foi creditado na conta de ${checkout.alunoNome||'aluno'} sem repetir o pedido.`,prioridade:'alta',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId||null,destinatariosPerfis:['admin','gestao','secretaria'],acaoPrincipal:'abrir_aluno',acaoLabel:'Ver conta do aluno'});
  }else if(checkout.tipo==='venda_online_secretaria'){
    await audit(db,operationResult.status==='confirmado'?'venda_online_secretaria_confirmada':'venda_online_secretaria_revisao',{vendaId:operationResult.vendaId||null,orderNsu,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:checkout.pedidoTotalCentavos||checkout.totalCentavos,severidade:operationResult.status==='confirmado'?'info':'warning',descricaoHumana:operationResult.status==='confirmado'?`Venda online da Secretaria confirmada para ${checkout.alunoNome||'aluno'}.`:`Pagamento recebido, mas a venda online de ${checkout.alunoNome||'aluno'} precisa de revisão.`});
    await notify(db,{tipo:operationResult.status==='confirmado'?'venda_online_confirmada':'venda_online_revisao',titulo:operationResult.status==='confirmado'?'Venda online confirmada':'Venda online precisa de revisão',mensagem:operationResult.status==='confirmado'?`O pagamento de ${checkout.alunoNome||'aluno'} foi confirmado e vinculado à conta.`:`O pagamento foi recebido, mas a operação precisa de revisão pela Secretaria.`,prioridade:operationResult.status==='confirmado'?'normal':'alta',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:operationResult.status==='confirmado'?[checkout.alunoId]:[],acaoPrincipal:'abrir_aluno',acaoLabel:'Ver conta do aluno'});
  }else if(checkout.tipo==='pedido_cantina'){
    const orderSnap=await db.collection('pedidos').doc(checkout.pedidoId).get().catch(()=>null),order=orderSnap&&orderSnap.exists?orderSnap.data():{};
    await audit(db,operationResult.status==='confirmado'?'pedido_cantina_confirmado':'pedido_cantina_revisao',{pedidoId:checkout.pedidoId,orderNsu,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:order.totalCentavos||checkout.pedidoTotalCentavos,severidade:operationResult.status==='confirmado'?'info':'warning',descricaoHumana:operationResult.status==='confirmado'?`Pedido de cantina de ${checkout.alunoNome||'aluno'} confirmado e enviado para a agenda de entregas.`:`Pagamento recebido, mas o pedido de ${checkout.alunoNome||'aluno'} precisa de revisão. O valor ficou na conta do aluno.`});
    await notify(db,{tipo:operationResult.status==='confirmado'?'pedido_cantina_confirmado':'pedido_cantina_revisao',titulo:operationResult.status==='confirmado'?'Novo pedido de cantina':'Pedido precisa de revisão',mensagem:operationResult.status==='confirmado'?`${checkout.alunoNome||'Aluno'}: ${(order.dias||[]).length} entrega(s) adicionada(s) à agenda da cantina.`:`Pagamento de ${checkout.alunoNome||'aluno'} foi recebido, mas o pedido precisa de revisão.`,prioridade:operationResult.status==='confirmado'?'normal':'alta',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId,destinatariosPerfis:operationResult.status==='confirmado'?['cantina','admin','gestao','secretaria']:['admin','gestao','secretaria'],destinatariosAlunos:[],acaoPrincipal:operationResult.status==='confirmado'?'abrir_entregas':'abrir_pedidos',acaoLabel:operationResult.status==='confirmado'?'Ver agenda da cantina':'Revisar pedido'});
    if(operationResult.status==='confirmado')await notify(db,{tipo:'pedido_cantina_confirmado',titulo:'Pedido de cantina confirmado',mensagem:`Pagamento confirmado. ${(order.dias||[]).length} entrega(s) programada(s), aguardando entrega.`,prioridade:'normal',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId,destinatariosPerfis:[],destinatariosAlunos:[checkout.alunoId],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
  }else if(checkout.tipo==='pedido_farda'){
    const orderSnap=await db.collection('pedidos_farda').doc(checkout.pedidoId).get().catch(()=>null),order=orderSnap&&orderSnap.exists?orderSnap.data():{};
    await audit(db,'pedido_farda_confirmado',{pedidoId:checkout.pedidoId,orderNsu,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,valorCentavos:order.totalCentavos||checkout.pedidoTotalCentavos,descricaoHumana:`Pedido de fardamento de ${checkout.alunoNome||'aluno'} confirmado.`});
    await notify(db,{tipo:'pedido_farda_confirmado',titulo:'Novo pedido de fardamento',mensagem:`${checkout.alunoNome||'Aluno'} realizou um pedido de fardamento.`,alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId,destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[],acaoPrincipal:'abrir_fardas',acaoLabel:'Ver fardas'});
    await notify(db,{tipo:'pedido_farda_confirmado',titulo:'Pedido de fardamento confirmado',mensagem:operationResult.statusAtendimento==='reservado_estoque'?'Pagamento confirmado. A farda foi reservada e aguarda retirada.':'Pagamento confirmado. O pedido aguarda produção.',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,pedidoId:checkout.pedidoId,destinatariosPerfis:[],destinatariosAlunos:[checkout.alunoId],acaoPrincipal:'abrir_pedido',acaoLabel:'Ver pedido'});
  }else{
    await notify(db,{tipo:'checkout_pagamento_confirmado',titulo:'Pagamento confirmado',mensagem:`Pagamento de ${brl(checkout.totalCentavos)} confirmado para ${checkout.alunoNome||'operação avulsa'}.`,prioridade:'normal',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,destinatariosPerfis:['admin','gestao','secretaria'],destinatariosAlunos:[]});
    if(checkout.alunoId)await notify(db,{tipo:'checkout_pagamento_confirmado',titulo:'Pagamento confirmado',mensagem:`O pagamento de ${brl(checkout.totalCentavos)} foi confirmado e lançado na conta do aluno.`,prioridade:'normal',alunoId:checkout.alunoId,alunoNome:checkout.alunoNome,matricula:checkout.matricula,pagamentoId:orderNsu,destinatariosPerfis:[],destinatariosAlunos:[checkout.alunoId],acaoPrincipal:'abrir_movimentacoes',acaoLabel:'Ver extrato'});
  }
  return {ok:true,operationResult};
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
    versao:'1.6.0-rc2-catalogo-vendas'
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

async function registerInPersonOperation(db,body={}){
  const actor=actorFromBody(body),student=await getStudent(db,body.alunoId);if(!student)throw Object.assign(new Error('Aluno não encontrado.'),{status:404});
  const operation=String(body.operacao||body.tipoOperacao||'venda_imediata');
  if(operation==='pedido_cantina_programado'){
    const cfg=await getConfig(db),saved=await getSavedBuyer(db,student.id),customer=mergeCustomer(saved,buildCustomerFromBody(body,student),student);
    const reservation=await reserveCantinaOrder(db,body,actor,student,customer,cfg),total=reservation.normalized.totalCentavos,before=reservation.saldoAtual;
    const useBalance=body.usarSaldo===true,creditUsed=useBalance?Math.min(Math.max(0,before),total):0,debtRequired=Math.max(0,-before),required=total-creditUsed+debtRequired,received=cents(body.valorRecebidoCentavos||required);
    if(received<required){await releasePendingOrder(db,reservation.pedidoId,'pagamento_presencial_insuficiente');throw Object.assign(new Error(`O valor recebido precisa ser de pelo menos ${brl(required)}.`),{status:400});}
    const troco=received-required,dest=String(body.destinoTroco||'devolver'),applied=required+(dest==='credito'?troco:0),method=String(body.formaPagamento||'dinheiro');let cash=null;
    if(method==='dinheiro'){cash=await findOpenCashSession(db,body.caixaId,'secretaria');if(!cash){await releasePendingOrder(db,reservation.pedidoId,'aguardando_caixa').catch(()=>{});throw Object.assign(new Error('Abra o caixa da secretaria antes de registrar pagamento em dinheiro.'),{status:409});}}
    const pseudo={id:`PRESENCIAL-${reservation.pedidoId}`,orderNsu:`PRESENCIAL-${reservation.pedidoId}`,pedidoId:reservation.pedidoId,totalCentavos:applied,tipo:'pedido_cantina'};let result;
    await db.runTransaction(async tx=>{result=await applyCantinaOrderTx(tx,db,pseudo,{origem:'secretaria_presencial',formaPagamento:method});});
    const pay=db.collection('pagamentos').doc();await pay.set({id:pay.id,pedidoId:reservation.pedidoId,alunoId:student.id,alunoNome:student.nome,valorBrutoCentavos:received,valorAplicadoCentavos:applied,trocoCentavos:dest==='devolver'?troco:0,creditoTrocoCentavos:dest==='credito'?troco:0,formaPagamento:method,status:'confirmado',origem:'secretaria_presencial',usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:nowIso()});
    if(cash){await db.collection('movimentos_caixa').add({caixaId:cash.id,tipo:'recebimento_venda',valorCentavos:received,alunoId:student.id,pedidoId:reservation.pedidoId,usuarioId:actor.id,usuarioNome:actor.nome,dataChave:dateKey(),criadoEm:nowIso()});if(dest==='devolver'&&troco>0)await db.collection('movimentos_caixa').add({caixaId:cash.id,tipo:'troco_entregue',valorCentavos:-troco,alunoId:student.id,pedidoId:reservation.pedidoId,usuarioId:actor.id,usuarioNome:actor.nome,dataChave:dateKey(),criadoEm:nowIso()});}
    return {ok:true,pedidoId:reservation.pedidoId,totalCentavos:total,valorRecebidoCentavos:received,trocoCentavos:troco,destinoTroco:dest,saldoDepoisCentavos:result.saldoDepoisCentavos};
  }
  const raw=Array.isArray(body.itens)?body.itens:[],isAccountOnly=['adicionar_credito','regularizar_debito'].includes(operation);if(!raw.length&&!isAccountOnly)throw Object.assign(new Error('Adicione ao menos um item.'),{status:400});
  const normalized=isAccountOnly?{total:0,lines:[],expanded:new Map(),catalogStock:[]}:await normalizeSecretarySaleItems(db,raw,'presencial'),total=normalized.total,lines=normalized.lines,expanded=normalized.expanded,catalogStock=normalized.catalogStock;
  const accRef=db.collection('contas_alunos').doc(student.id),acc=await getAccount(db,student.id),before=accountNet(acc),useBalance=body.usarSaldo===true,creditUsed=isAccountOnly?0:(useBalance?Math.min(Math.max(0,before),total):0),debtRequired=isAccountOnly?0:Math.max(0,-before),regularizationRequired=operation==='regularizar_debito'?Math.max(0,-before):0,required=isAccountOnly?regularizationRequired:Math.max(0,total-creditUsed+debtRequired);
  if(operation==='regularizar_debito'&&required<=0)throw Object.assign(new Error('O aluno não possui saldo em aberto.'),{status:409});
  const received=cents(body.valorRecebidoCentavos||body.valorCentavos||required),method=String(body.formaPagamento||'dinheiro'),dest=String(body.destinoTroco||'devolver');if(isAccountOnly&&received<=0)throw Object.assign(new Error('Informe o valor recebido.'),{status:400});if(operation==='regularizar_debito'&&received<required)throw Object.assign(new Error(`Para regularizar a conta, receba pelo menos ${brl(required)}.`),{status:400});if(!isAccountOnly&&received<required)throw Object.assign(new Error(`O valor recebido precisa ser de pelo menos ${brl(required)}.`),{status:400});
  const troco=isAccountOnly?0:Math.max(0,received-required),applied=isAccountOnly?received:required+(dest==='credito'?troco:0),afterPayment=before+applied,after=isAccountOnly?afterPayment:afterPayment-total;
  let cash=null;if(method==='dinheiro'){cash=await findOpenCashSession(db,body.caixaId,'secretaria');if(!cash)throw Object.assign(new Error('Abra o caixa da secretaria antes de registrar pagamento em dinheiro.'),{status:409});}
  const saleRef=db.collection('vendas').doc(),payRef=db.collection('pagamentos').doc(),now=nowIso(),cfg=await getConfig(db),salgadoQty=[...expanded.values()].filter(x=>x.produtoId==='salgado').reduce((a,x)=>a+cents(x.quantidade),0),dailyRef=salgadoQty>0?db.collection('disponibilidade_salgados').doc(dateKey()):null,catalogRefs=catalogStock.map(x=>({line:x,ref:db.collection('catalogo_itens').doc(x.itemId)}));
  await db.runTransaction(async tx=>{
    const readRefs=[accRef,...(dailyRef?[dailyRef]:[]),...catalogRefs.map(x=>x.ref)],snaps=await Promise.all(readRefs.map(r=>tx.get(r))),fresh=snaps[0],freshAcc=fresh.exists?fresh.data():{},freshBefore=accountNet(freshAcc);if(freshBefore!==before)throw new Error('O saldo do aluno mudou. Revise a venda antes de confirmar.');let pos=1,dailySnap=dailyRef?snaps[pos++]:null;
    const catalogSnaps=catalogRefs.map(()=>snaps[pos++]);
    if(dailyRef){const stock=dailySnap.exists?dailySnap.data():{},planned=cents(stock.quantidadePlanejada||cfg.quantidadePadraoSalgados||30),used=dailyUsed(stock);if(used+salgadoQty>planned)throw new Error(`Não há salgados suficientes. Disponíveis: ${Math.max(0,planned-used)}.`);const field=method==='dinheiro'?'vendidoDinheiro':'vendidoAvulso';tx.set(dailyRef,{dataChave:dateKey(),quantidadePlanejada:planned,[field]:cents(stock[field])+salgadoQty,atualizadoEm:now},{merge:true});}
    catalogRefs.forEach((entry,i)=>{const doc=catalogSnaps[i].exists?catalogSnaps[i].data():{},available=catalogAvailableUnits(doc,entry.line);if(available<entry.line.quantidade)throw new Error(`${entry.line.modo==='capacidade_evento'?'Vagas':'Estoque'} insuficiente para ${entry.line.nome}. Disponível: ${available}.`);tx.set(entry.ref,catalogStockUpdate(doc,entry.line,now),{merge:true});});
    tx.set(accRef,{...splitNet(after),bloqueioSaldoSemanal:after<0?Boolean(freshAcc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:after<0&&cents(freshAcc.limiteFiadoCentavos)>0&&Math.abs(after)>=cents(freshAcc.limiteFiadoCentavos),ultimaRegularizacaoEm:after>=0?now:(freshAcc.ultimaRegularizacaoEm||null),atualizadoEm:now},{merge:true});
    if(applied>0){const pm=db.collection('movimentos_conta').doc();tx.set(pm,{id:pm.id,alunoId:student.id,tipo:'entrada_conta_aluno',subtipo:isAccountOnly?(operation==='regularizar_debito'?'regularizacao_saldo_secretaria':'credito_secretaria'):'pagamento_venda_secretaria',valorCentavos:applied,valorRecebidoCentavos:received,trocoCentavos:dest==='devolver'?troco:0,creditoTrocoCentavos:dest==='credito'?troco:0,saldoAntesCentavos:before,saldoDepoisCentavos:afterPayment,formaPagamento:method,vendaId:isAccountOnly?null:saleRef.id,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:now});}
    if(!isAccountOnly){const purchase=db.collection('movimentos_conta').doc();tx.set(purchase,{id:purchase.id,alunoId:student.id,tipo:'compra',subtipo:'venda_secretaria',valorCentavos:-total,valorCompraCentavos:total,saldoAntesCentavos:afterPayment,saldoDepoisCentavos:after,vendaId:saleRef.id,itens:lines,origem:'secretaria',formaPagamento:method,status:'confirmado',dataChave:dateKey(),criadoEm:now});tx.set(saleRef,{id:saleRef.id,alunoId:student.id,alunoNome:student.nome,turma:student.turma||null,origem:'secretaria',operadorId:actor.id,operadorNome:actor.nome,formaPagamento:method,valorBrutoCentavos:total,valorRecebidoCentavos:received,trocoCentavos:dest==='devolver'?troco:0,creditoTrocoCentavos:dest==='credito'?troco:0,valorSaldoUtilizadoCentavos:creditUsed,itens:lines,caixaId:cash?.id||null,dataChave:dateKey(),criadoEm:now,status:'confirmada',schemaVersion:5,versao:'1.6.0-rc2-catalogo-vendas'});}
    tx.set(payRef,{id:payRef.id,vendaId:isAccountOnly?null:saleRef.id,alunoId:student.id,alunoNome:student.nome,valorBrutoCentavos:received,valorAplicadoCentavos:applied,trocoCentavos:dest==='devolver'?troco:0,creditoTrocoCentavos:dest==='credito'?troco:0,formaPagamento:method,status:'confirmado',origem:'secretaria_presencial',usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:now});
    for(const line of lines.filter(x=>x.tipo==='farda')){const fr=db.collection('pedidos_farda').doc();tx.set(fr,{id:fr.id,vendaId:saleRef.id,alunoId:student.id,alunoNome:student.nome,turma:student.turma||null,produto:line.nome,tamanho:line.tamanho||'',modelo:line.modelo||'',modeloFardaId:line.modeloFardaId||'catalogo',catalogoItemId:line.catalogoItemId||null,quantidade:line.quantidade,precoUnitarioCentavos:line.precoUnitarioCentavos,totalCentavos:line.totalCentavos,statusPagamento:'pago',statusAtendimento:line.statusAtendimento||'aguardando_producao',criadoPor:actor.id,criadoEm:now,atualizadoEm:now,versao:'1.6.0-rc2-catalogo-vendas'});}
    if(cash){const cm=db.collection('movimentos_caixa').doc();tx.set(cm,{id:cm.id,caixaId:cash.id,tipo:'recebimento_venda',vendaId:isAccountOnly?null:saleRef.id,valorCentavos:received,alunoId:student.id,usuarioId:actor.id,usuarioNome:actor.nome,dataChave:dateKey(),criadoEm:now});if(dest==='devolver'&&troco>0){const tm=db.collection('movimentos_caixa').doc();tx.set(tm,{id:tm.id,caixaId:cash.id,tipo:'troco_entregue',vendaId:isAccountOnly?null:saleRef.id,valorCentavos:-troco,alunoId:student.id,usuarioId:actor.id,usuarioNome:actor.nome,dataChave:dateKey(),criadoEm:now});}}
  });
  await audit(db,'venda_presencial_aluno',{vendaId:isAccountOnly?null:saleRef.id,alunoId:student.id,alunoNome:student.nome,valorCentavos:isAccountOnly?received:total,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,descricaoHumana:isAccountOnly?(operation==='regularizar_debito'?`${actor.nome} regularizou ${brl(received)} da conta de ${student.nome}.`:`${actor.nome} adicionou ${brl(received)} à conta de ${student.nome}.`):`${actor.nome} registrou uma venda de ${brl(total)} para ${student.nome}.`});
  return {ok:true,vendaId:isAccountOnly?null:saleRef.id,pagamentoId:payRef.id,totalCentavos:total,valorRecebidoCentavos:received,valorAplicadoCentavos:applied,trocoCentavos:dest==='devolver'?troco:0,creditoTrocoCentavos:dest==='credito'?troco:0,saldoAntesCentavos:before,saldoDepoisCentavos:after};
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
  isPaidResponse,
  mergePaymentEvidence,
  validatePaidCheckout,
  audit,
  notify,
  getConfig,
  buildReceiptInfo,
  accountNet,
  splitNet,
  releasePendingOrder,
  discardCheckout,
  normalizeSecretarySaleItems,
  registerInPersonOperation,
  confirmCantinaOrderWithoutCheckout,
  confirmUniformOrderWithoutCheckout
};
