
/*
   Escola Piaget — V1.4.1 Checkout Oficial
   Base: V1.3.4 aprovada. A V1.4.0 anterior foi descartada.
   Motor novo: conta corrente do aluno + InfinitePay para entrada positiva.
*/
(function(){
const V141_VERSION='1.4.1-checkout-oficial';
const CHECKOUT_COLLECTION_V141='pagamentos_checkout';
function centsV141(v){return Math.round(Number(v||0));}
function accountNetV141(acc){if(acc&&typeof acc.saldoContaCentavos==='number')return centsV141(acc.saldoContaCentavos);return centsV141(acc?.saldoCreditoCentavos)-centsV141(acc?.dividaCentavos);}
function splitNetV141(net){net=centsV141(net);return {saldoCreditoCentavos:Math.max(0,net),dividaCentavos:Math.max(0,-net),saldoContaCentavos:net};}
function isBlockedV141(acc){return Boolean(acc?.bloqueioManual||acc?.bloqueioSaldoSemanal||acc?.bloqueadoPorLimite);}
function blockedReasonV141(acc){if(acc?.bloqueioManual)return 'Bloqueio manual da secretaria/gestão';if(acc?.bloqueioSaldoSemanal)return 'Bloqueio semanal por saldo em aberto';if(acc?.bloqueadoPorLimite)return 'Limite de saldo em aberto atingido';return 'Conta liberada';}
function cfgV141(){return {limiteMaximoFiadoCentavos:centsV141(state.config?.limiteMaximoFiadoCentavos||5000),valorMinimoCheckoutPositivoCentavos:centsV141(state.config?.valorMinimoCheckoutPositivoCentavos||100),bloqueioSemanalSaldoAtivo:state.config?.bloqueioSemanalSaldoAtivo!==false,permitirMultiplosLinksPendentes:state.config?.permitirMultiplosLinksPendentes!==false,diaBloqueioSemanalSaldo:state.config?.diaBloqueioSemanalSaldo||'sexta'};}
function fmtSignedV141(c){const n=centsV141(c);return (n<0?'-':'')+fmt(Math.abs(n));}
function canStaffCheckoutV141(){return state.user&&['secretaria','gestao','admin'].includes(state.user.perfil);}
function canStaffManageV141(){return state.user&&['secretaria','gestao','admin'].includes(state.user.perfil);}
function actorV141(){return state.user?{id:state.user.id,nome:state.user.nome,perfil:state.user.perfil}:{id:'portal_responsavel',nome:state.parentStudent?.responsavelFinanceiro||'Responsável',perfil:'responsavel'};}
function paymentMethodLabelV141(m){const map={dinheiro:'Dinheiro',pix_manual:'Pix manual',pix_banco:'Pix banco',pix_rede:'Pix Rede / Laranjinha',cartao_rede:'Cartão Rede / Laranjinha',maquininha:'Maquininha',checkout_infinitepay:'Checkout InfinitePay'};return map[m]||m||'-';}
function paymentStatusLabelV141(s){const map={preparando_link:'Preparando link',aguardando_pagamento:'Aguardando pagamento',erro_timeout:'Tempo excedido',pago:'Pago',erro_gerar_link:'Erro ao gerar link',erro_sem_url:'Erro sem URL',cancelado:'Cancelado',pagamento_localizado_processando:'Pagamento localizado — processando',pagamento_localizado_aguardando_processamento:'Pagamento localizado — aguardando processamento',descartado_responsavel:'Descartada pelo responsável',substituido_nova_cobranca:'Substituída',pago_descartado_creditado:'Pago após descarte — creditado',sem_retorno_infinitepay:'Sem retorno da InfinitePay'};return map[s]||s||'-';}
function normalizeCheckoutUrlV141(url){return String(url||'').trim();}
async function getSavedBuyerV141(alunoId){try{const s=await db.collection('dados_pagamento_responsavel').doc(alunoId).get();return s.exists?(s.data().customer||{}):{}}catch(e){return {}}}
async function pendingCheckoutsV141(alunoId){const active=new Set(['preparando_link','aguardando_pagamento','erro_timeout','erro_gerar_link','erro_sem_url','pagamento_localizado_processando','pagamento_localizado_aguardando_processamento','sem_retorno_infinitepay']);try{const rows=[];let cursor=null;while(true){let q=db.collection(CHECKOUT_COLLECTION_V141).where('alunoId','==',alunoId).limit(100);if(cursor)q=q.startAfter(cursor);const snap=await q.get();rows.push(...snap.docs.map(d=>({id:d.id,...d.data()})));if(snap.docs.length<100)break;cursor=snap.docs[snap.docs.length-1]}return rows.filter(x=>active.has(x.status||'aguardando_pagamento')).sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||'')))}catch(e){console.warn('pendingCheckoutsV141',e);try{appMessage('Não foi possível conferir os pagamentos pendentes. A operação foi interrompida para evitar uma cobrança duplicada.',{title:'Falha ao conferir cobranças',tone:'danger'})}catch(_){}throw e}}
async function recentCheckoutsV141(limit=40){try{const snap=await db.collection(CHECKOUT_COLLECTION_V141).orderBy('criadoEm','desc').limit(limit).get().catch(()=>db.collection(CHECKOUT_COLLECTION_V141).limit(limit).get());return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)))}catch(e){console.warn('recentCheckoutsV141',e);return []}}
async function ensureAccountSyncV141(alunoId){const ref=financialAccountRefV167(alunoId),snap=await ref.get();const acc=snap.exists?snap.data():{alunoId,saldoCreditoCentavos:0,dividaCentavos:0,limiteFiadoCentavos:cfgV141().limiteMaximoFiadoCentavos};const net=accountNetV141(acc);await ref.set({...splitNetV141(net),limiteFiadoCentavos:centsV141(acc.limiteFiadoCentavos||cfgV141().limiteMaximoFiadoCentavos),atualizadoEm:nowIso()},{merge:true});return {...acc,...splitNetV141(net)};}
window.accountNetV141=accountNetV141;

const _getAccountV141Before=window.getAccount;
window.getAccount=getAccount=async function(id){const s=await financialAccountRefV167(id).get();const base=s.exists?s.data():{alunoId:id,saldoCreditoCentavos:0,dividaCentavos:0,limiteFiadoCentavos:cfgV141().limiteMaximoFiadoCentavos,bloqueioManual:false,bloqueadoPorLimite:false,bloqueioSaldoSemanal:false};const net=accountNetV141(base);return {...base,saldoContaCentavos:net};};

function balanceSummaryHtmlV141(acc){const net=accountNetV141(acc),open=Math.max(0,-net),credit=Math.max(0,net);return `<div class="v141-balance-box"><div class="v141-balance-card"><small>Saldo da conta</small><strong>${fmtSignedV141(net)}</strong><div class="v141-mini">positivo = crédito · negativo = saldo em aberto</div></div><div class="v141-balance-card"><small>Saldo em aberto</small><strong>${fmt(open)}</strong><div class="v141-mini">valor mínimo para regularizar quando negativo</div></div><div class="v141-balance-card"><small>Crédito disponível</small><strong>${fmt(credit)}</strong><div class="v141-mini">usado em novas compras</div></div></div>`}
function accountStatusHtmlV141(acc){const net=accountNetV141(acc),blocked=isBlockedV141(acc);if(blocked)return `<div class="v141-status blocked"><strong>Conta bloqueada.</strong><br>${esc(blockedReasonV141(acc))}. ${net<0?`Para desbloquear, regularize pelo menos ${fmt(Math.abs(net))}.`:'A conta será liberada ao regularizar a pendência.'}</div>`;if(net<0)return `<div class="v141-status open"><strong>Saldo em aberto.</strong><br>A conta ainda pode operar dentro do limite definido, mas será bloqueada no fechamento semanal de sexta-feira se continuar negativa.</div>`;return `<div class="v141-status"><strong>Conta liberada.</strong><br>Saldo regular para consumo e novos pedidos.</div>`;}
function movementValueV141(m){const v=centsV141(m.valorCentavos);if(['consumo','venda_conta','compra_farda'].includes(m.tipo)||m.subtipo==='consumo')return -Math.abs(v);return v;}
function movementDetailsV141(m){if(m.saldoAntesCentavos!==undefined)return `Saldo: ${fmtSignedV141(m.saldoAntesCentavos)} → ${fmtSignedV141(m.saldoDepoisCentavos)}`;return (m.itens||[]).map(x=>`${x.quantidade}× ${esc(x.nome)}`).join(', ')||esc(paymentMethodLabelV141(m.formaPagamento)||'-');}

async function openStudentDetailsV141(id){
  const a=state.students.find(x=>x.id===id),acc=await getAccount(id);if(!a)return;
  const ms=await db.collection('movimentos_conta').where('alunoId','==',id).limit(200).get().catch(()=>({docs:[]}));
  const moves=ms.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>String(y.criadoEm).localeCompare(String(x.criadoEm))).slice(0,50);
  const pending=await pendingCheckoutsV141(id);
  const canManage=canStaffManageV141();
  openModal('Conta do aluno',`<div class="status-panel"><div class="small">${esc(a.turma)} · Matrícula ${esc(a.matricula)}</div><div class="big">${esc(a.nome)}</div><div class="small">Responsável: ${esc(a.responsavelFinanceiro)}</div></div>${balanceSummaryHtmlV141(acc)}${accountStatusHtmlV141(acc)}${pending.length?`<div class="v141-alert-inline"><strong>${pending.length} pagamento(s) pendente(s).</strong><br>É permitido gerar outro link, mas se mais de um for pago, todos os valores entram no saldo do aluno.</div>`:''}<div class="switch-line"><div><strong>Compra sem saldo</strong><div class="muted">${acc.autorizadoSemSaldo?'Autorizada pelo responsável':'Bloqueada pelo responsável'}</div></div><span class="badge ${acc.autorizadoSemSaldo?'b-green':'b-red'}">${acc.autorizadoSemSaldo?'liberada':'bloqueada'}</span></div>${canManage?`<div class="actions" style="margin:12px 0"><button class="btn btn-primary" onclick="openAccountPaymentV141('${id}','staff')">Gerar link InfinitePay</button><button class="btn btn-green" onclick="registerManualPaymentV141('${id}')">Registrar pagamento presencial</button><button class="btn btn-outline" onclick="toggleManualBlock('${id}',${!acc.bloqueioManual})">${acc.bloqueioManual?'Remover bloqueio manual':'Bloquear conta'}</button><button class="btn btn-light" onclick="generateReport('${id}')">Relatório PDF / imagem</button></div>`:''}<div class="card-title" style="margin:15px 0 8px">Movimentos recentes</div>${moves.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Detalhes</th><th style="text-align:right">Entrada/Saída</th></tr></thead><tbody>${moves.map(m=>`<tr><td>${humanDate(m.criadoEm)}</td><td>${esc(m.subtipo||m.tipo)}</td><td>${movementDetailsV141(m)}</td><td class="money">${fmtSignedV141(movementValueV141(m))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Sem movimentos.</div>'}`);
}
window.openStudentDetails=openStudentDetails=openStudentDetailsV141;
window.openStudentDetailsV141=openStudentDetailsV141;


async function openAccountPaymentV141(alunoId,context='staff'){
  const a=state.students.find(x=>x.id===alunoId);if(!a)return appMessage('Aluno não encontrado.');
  const [acc,buyer,pending]=await Promise.all([getAccount(alunoId),getSavedBuyerV141(alunoId),pendingCheckoutsV141(alunoId)]);
  const net=accountNetV141(acc),min=net<0?Math.abs(net):cfgV141().valorMinimoCheckoutPositivoCentavos,defaultValue=net<0?min:1000;
  openModal(net<0?'Regularizar saldo':'Adicionar crédito',`<div class="status-panel"><div class="small">${esc(a.turma)} · Matrícula ${esc(a.matricula)}</div><div class="big">${esc(a.nome)}</div><div class="small">Saldo atual: <strong>${fmtSignedV141(net)}</strong></div></div>${pending.length?`<div class="v141-alert-inline"><strong>Já existe link pendente.</strong><br>Você pode gerar outro. Se mais de um link for pago, todos os valores entram como crédito/saldo do aluno.</div>`:''}<div class="alert">${net<0?`Valor mínimo para regularizar: <strong>${fmt(min)}</strong>.`:`Valor mínimo para adicionar crédito: <strong>${fmt(min)}</strong>.`}</div><div class="v141-chipbar"><button class="btn btn-light" onclick="$('#v141PayAmount').value='${(min/100).toFixed(2).replace('.',',')}'">Mínimo</button><button class="btn btn-light" onclick="$('#v141PayAmount').value='10,00'">R$ 10</button><button class="btn btn-light" onclick="$('#v141PayAmount').value='20,00'">R$ 20</button><button class="btn btn-light" onclick="$('#v141PayAmount').value='30,00'">R$ 30</button><button class="btn btn-light" onclick="$('#v141PayAmount').value='50,00'">R$ 50</button></div><div class="fg"><label>Valor do pagamento</label><input id="v141PayAmount" class="fi" value="${(defaultValue/100).toFixed(2).replace('.',',')}"></div><div class="grid g3" style="margin-top:10px"><div class="fg"><label>Nome do comprador <span class="muted">opcional</span></label><input id="v141BuyerName" class="fi" value="${esc(buyer.name||a.responsavelFinanceiro||'')}"></div><div class="fg"><label>Telefone <span class="muted">opcional</span></label><input id="v141BuyerPhone" class="fi" value="${esc(buyer.phone_number||a.celularResponsavel||'')}"></div><div class="fg"><label>E-mail <span class="muted">opcional</span></label><input id="v141BuyerEmail" class="fi" value="${esc(buyer.email||'')}"></div></div><label class="switch-line" style="margin-top:10px"><div><strong>Salvar dados para próximos pagamentos</strong><div class="muted">Somente nome, telefone e e-mail. Cartão não fica salvo no sistema da escola.</div></div><input id="v141SaveBuyer" type="checkbox" checked></label><div class="actions" style="margin-top:14px"><button class="btn btn-green" onclick="confirmAccountCheckoutV141('${alunoId}','${context}')">Gerar pagamento InfinitePay</button><button class="btn btn-outline" onclick="closeModal()">Cancelar</button></div><div id="v141CheckoutResult"></div>`);
}
window.openAccountPaymentV141=openAccountPaymentV141;

async function confirmAccountCheckoutV141(alunoId,context='staff'){
  const a=state.students.find(x=>x.id===alunoId),acc=await getAccount(alunoId);if(!a)return;
  const amount=parseBRL($('#v141PayAmount').value),net=accountNetV141(acc),min=net<0?Math.abs(net):cfgV141().valorMinimoCheckoutPositivoCentavos;
  if(amount<min)return appMessage(net<0?`O valor mínimo para regularizar este saldo é ${fmt(min)}.`:`O valor mínimo para adicionar crédito é ${fmt(min)}.`);
  const pending=await pendingCheckoutsV141(alunoId);
  const resumable=pending.filter(x=>x.checkoutUrl&&['preparando_link','aguardando_pagamento'].includes(x.status));
  if(resumable.length&&!await appConfirm('Já existe pagamento pendente para este aluno. Você pode retomá-lo em Pagamentos pendentes. Deseja gerar outra tentativa mesmo assim?',{title:'Gerar outra cobrança?',confirmLabel:'Gerar nova',cancelLabel:'Voltar'}))return;
  const actor=actorV141(),btn=document.querySelector('#modalBody .btn.btn-green'),host=$('#v141CheckoutResult');
  try{
    const data=await requestCheckoutV154({tipo:'entrada_conta_aluno',alunoId,valorCentavos:amount,comprador:{nome:$('#v141BuyerName').value,telefone:$('#v141BuyerPhone').value,email:$('#v141BuyerEmail').value},salvarComprador:$('#v141SaveBuyer').checked,criadoPorId:actor.id,criadoPorNome:actor.nome,criadoPorPerfil:actor.perfil},{button:btn,statusHost:host});
    if(data.preparando)return;
    const url=normalizeCheckoutUrlV141(data.checkout_url);
    if(!url)throw new Error('O pagamento foi registrado, mas o link ainda não está disponível. Consulte Pagamentos pendentes.');
    if(context==='responsavel'){location.href=url;return;}
    host.innerHTML=`<div class="v141-payment-link"><strong>Link gerado:</strong><br>${esc(url)}<div class="actions" style="margin-top:8px"><button class="btn btn-light" onclick="navigator.clipboard.writeText('${esc(url)}');toast('Link copiado.')">Copiar link</button><button class="btn btn-primary" onclick="window.open('${esc(url)}','_blank')">Abrir checkout</button></div><div class="v141-mini">NSU: ${esc(data.order_nsu||'')}</div></div>`;toast('Link de pagamento gerado.');
  }catch(e){appMessage(e.message)}
}
window.confirmAccountCheckoutV141=confirmAccountCheckoutV141;

function registerManualPaymentV141(id){
  openModal('Registrar pagamento presencial',`<div class="alert">Este lançamento entra na mesma conta corrente do aluno. Não gera link InfinitePay.</div><div class="fg"><label>Valor recebido</label><input id="manualPayAmount" class="fi" placeholder="0,00"></div><div class="fg"><label>Forma</label><select id="manualPayMethod" class="fi"><option value="dinheiro">Dinheiro</option><option value="pix_manual">Pix manual</option><option value="maquininha">Maquininha</option><option value="pix_banco">Pix banco</option><option value="pix_rede">Pix Rede / Laranjinha</option><option value="cartao_rede">Cartão Rede / Laranjinha</option></select></div><div class="fg"><label>Observação <span class="muted">opcional</span></label><input id="manualPayObs" class="fi" placeholder="Ex.: pagamento recebido na secretaria"></div><button class="btn btn-green" style="width:100%" onclick="saveManualPaymentV141('${id}')">Confirmar recebimento</button>`);
}
window.registerManualPayment=registerManualPaymentV141;
window.registerManualPaymentV141=registerManualPaymentV141;

async function saveManualPaymentV141(id){
  const amount=parseBRL($('#manualPayAmount').value);if(amount<=0)return appMessage('Informe o valor.');
  const method=$('#manualPayMethod').value,obs=$('#manualPayObs')?.value||'',accRef=financialAccountRefV167(id),move=db.collection('movimentos_conta').doc(),pay=db.collection('pagamentos').doc(),actor=actorV141();
  await db.runTransaction(async tx=>{const s=await tx.get(accRef),a=s.exists?s.data():{};const before=accountNetV141(a),after=before+amount,split=splitNetV141(after);tx.set(accRef,{...split,bloqueioSaldoSemanal:after<0?Boolean(a.bloqueioSaldoSemanal):false,bloqueadoPorLimite:after<0&&centsV141(a.limiteFiadoCentavos)>0&&Math.abs(after)>=centsV141(a.limiteFiadoCentavos),ultimaRegularizacaoEm:after>=0?nowIso():(a.ultimaRegularizacaoEm||null),atualizadoEm:nowIso()},{merge:true});tx.set(move,{id:move.id,alunoId:id,tipo:'entrada_conta_aluno',subtipo:'pagamento_presencial',valorCentavos:amount,saldoAntesCentavos:before,saldoDepoisCentavos:after,formaPagamento:method,observacao:obs,usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:nowIso()});tx.set(pay,{id:pay.id,alunoId:id,valorBrutoCentavos:amount,formaPagamento:method,status:'confirmado',origem:'secretaria_presencial',usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,dataChave:dateKey(),criadoEm:nowIso(),observacao:obs})});
  await audit('pagamento_presencial_conta_aluno',{alunoId:id,valorCentavos:amount,forma:method,descricao:`Pagamento presencial de ${fmt(amount)} registrado.`});closeModal();toast('Pagamento presencial registrado.');
}
window.saveManualPayment=saveManualPaymentV141;
window.saveManualPaymentV141=saveManualPaymentV141;

const _registerAccountConsumptionV141Before=window.registerAccountConsumption;
window.registerAccountConsumption=registerAccountConsumption=async function(){
  if(!state.cart.length)return;const student=state.selectedStudent,items=expandCart(state.cart),total=items.reduce((s,x)=>s+x.quantidade*x.precoUnitarioCentavos,0);
  try{const accountRef=financialAccountRefV167(student.id),moveRef=db.collection('movimentos_conta').doc(),saleRef=db.collection('vendas').doc();await db.runTransaction(async tx=>{const snap=await tx.get(accountRef),a=snap.exists?snap.data():{};const stock=await readSalgadoUpdateTx(tx,items,'consumo_conta');const before=accountNetV141(a),limite=centsV141(a.limiteFiadoCentavos||cfgV141().limiteMaximoFiadoCentavos),after=before-total;if(a.bloqueioManual)throw new Error('A conta está bloqueada pela secretaria ou gestão.');if(a.bloqueioSaldoSemanal&&before<0)throw new Error('A conta está bloqueada por saldo em aberto no fechamento semanal. Regularize o saldo para liberar novos consumos.');if(after<0&&!a.autorizadoSemSaldo)throw new Error('O responsável não autorizou compras sem saldo.');if(after<0&&Math.abs(after)>limite)throw new Error(`A compra ultrapassa o limite de saldo em aberto. Disponível: ${fmt(Math.max(0,limite-Math.max(0,-before)))}.`);const split=splitNetV141(after),hit=after<0&&Math.abs(after)>=limite;if(stock)tx.set(stock.ref,stock.data,{merge:true});tx.set(accountRef,{...split,bloqueadoPorLimite:hit,atualizadoEm:nowIso()},{merge:true});tx.set(moveRef,{id:moveRef.id,alunoId:student.id,tipo:'consumo',subtipo:'consumo_cantina',valorCentavos:total,saldoAntesCentavos:before,saldoDepoisCentavos:after,itens:items,origem:'cantina',usuarioId:state.user.id,usuarioNome:state.user.nome,dataChave:dateKey(),criadoEm:nowIso()});tx.set(saleRef,{id:saleRef.id,alunoId:student.id,origem:'cantina',operadorId:state.user.id,operadorNome:state.user.nome,formaPagamento:after>=0?'conta_credito':'conta_aluno',valorBrutoCentavos:total,itens:items,dataChave:dateKey(),criadoEm:nowIso(),status:'confirmada'});if(hit){const alertRef=db.collection('alertas').doc();tx.set(alertRef,{tipo:'limite_atingido',alunoId:student.id,alunoNome:student.nome,saldoContaCentavos:after,limiteCentavos:limite,status:'pendente',criadoEm:nowIso()})}});await audit('consumo_conta',{alunoId:student.id,valorCentavos:total});closeModal();toast('Consumo registrado na conta.')}catch(e){appMessage(e.message)}
};

window.weeklyClose=weeklyClose=async function(){
  if(!canStaffManageV141())return appMessage('Apenas secretaria, gestão ou administração podem executar o fechamento.');
  if(!await appConfirm('Todos os alunos com saldo negativo serão bloqueados até regularizar o saldo.',{title:'Aplicar fechamento semanal?',confirmLabel:'Aplicar fechamento',cancelLabel:'Voltar',danger:true}))return;
  const snap=await financialAccountsSnapshotV167(),batch=db.batch();let blocked=0,negative=0;const now=nowIso();
  snap.docs.forEach(d=>{const acc={id:d.id,...d.data()},net=accountNetV141(acc);if(net<0){negative++;blocked++;batch.set(d.ref,{...splitNetV141(net),bloqueioSaldoSemanal:true,bloqueadoEm:now,motivoBloqueio:'saldo_em_aberto_fechamento_semanal',atualizadoEm:now},{merge:true});}else{batch.set(d.ref,{...splitNetV141(net),bloqueioSaldoSemanal:false,atualizadoEm:now},{merge:true});}});
  await batch.commit();await db.collection('fechamentos_semanais').add({dataChave:dateKey(),tipo:'bloqueio_saldo_semanal',alunosNegativos:negative,alunosBloqueados:blocked,usuarioId:state.user.id,usuarioNome:state.user.nome,criadoEm:now});await audit('bloqueio_semanal_saldo',{quantidadeBloqueada:blocked,descricao:`Fechamento semanal bloqueou ${blocked} aluno(s) com saldo negativo.`});toast(`Fechamento aplicado: ${blocked} conta(s) bloqueada(s).`);renderCobrancas();
};

async function renderCobrancasV141(){
  const el=$('#mainContent');el.innerHTML=pageHeader('Cobranças e saldos','Conta corrente dos alunos, bloqueio semanal e pagamentos InfinitePay.')+'<div class="empty">Carregando...</div>';
  const [snap,checkouts]=await Promise.all([financialAccountsSnapshotV167(),recentCheckoutsV141(60)]);
  const rows=snap.docs.map(d=>({id:d.id,...d.data(),saldoContaCentavos:accountNetV141(d.data())})).filter(x=>x.saldoContaCentavos<0||isBlockedV141(x)).sort((a,b)=>a.saldoContaCentavos-b.saldoContaCentavos);
  const blocked=rows.filter(isBlockedV141).length,totalOpen=rows.reduce((s,x)=>s+Math.max(0,-accountNetV141(x)),0),pending=checkouts.filter(x=>(x.status||'aguardando_pagamento')==='aguardando_pagamento').length,paid=checkouts.filter(x=>x.status==='pago').length;
  el.innerHTML=pageHeader('Cobranças e saldos','Conta corrente dos alunos, bloqueio semanal e pagamentos InfinitePay.',`<button class="btn btn-orange" onclick="weeklyClose()">Fechamento semanal</button>`)+`<div class="grid g4"><div class="kpi orange clickable" onclick="renderCobrancasV162?.('saldo')"><div class="kpi-label">Saldo em aberto</div><div class="kpi-value">${fmt(totalOpen)}</div></div><div class="kpi red clickable" onclick="renderCobrancasV162?.('bloqueada')"><div class="kpi-label">Contas bloqueadas</div><div class="kpi-value">${blocked}</div></div><div class="kpi clickable" onclick="renderCobrancasV162?.('pendente')"><div class="kpi-label">Links pendentes</div><div class="kpi-value">${pending}</div></div><div class="kpi green clickable" onclick="renderCobrancasV162?.('pago')"><div class="kpi-label">Pagos recentes</div><div class="kpi-value">${paid}</div></div></div><div class="grid g2" style="margin-top:14px"><div class="card"><div class="card-head"><div class="card-title">Alunos com saldo em aberto / bloqueio</div><span class="badge b-yellow">${rows.length}</span></div>${rows.length?`<div class="table-wrap" style="border:0;border-radius:0"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Status</th><th>Limite</th><th style="text-align:right">Saldo</th><th>Ações</th></tr></thead><tbody>${rows.map(r=>{const a=state.students.find(x=>x.id===r.id)||{};const net=accountNetV141(r);return`<tr class="${isBlockedV141(r)?'v141-row-blocked':net<0?'v141-row-warn':''}"><td><strong>${esc(a.nome||r.id)}</strong><div class="muted">${esc(a.matricula||'')}</div></td><td>${esc(a.turma||'-')}</td><td><span class="badge ${isBlockedV141(r)?'b-red':'b-yellow'}">${isBlockedV141(r)?'bloqueada':'em aberto'}</span><div class="muted">${esc(blockedReasonV141(r))}</div></td><td>${fmt(r.limiteFiadoCentavos||cfgV141().limiteMaximoFiadoCentavos)}</td><td class="money">${fmtSignedV141(net)}</td><td><div class="actions"><button class="btn btn-primary" onclick="openAccountPaymentV141('${r.id}','staff')">Gerar link</button><button class="btn btn-green" onclick="registerManualPaymentV141('${r.id}')">Registrar pgto.</button><button class="btn btn-light" onclick="copyParentLink('${r.id}')">Portal</button></div></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Nenhuma conta em aberto ou bloqueada.</div>'}</div><div class="card"><div class="card-head"><div class="card-title">Pagamentos InfinitePay</div><button class="btn btn-light" onclick="renderCobrancas()">Atualizar</button></div>${checkoutTableV141(checkouts)}</div></div>`;
}
function checkoutTableV141(rows){if(!rows.length)return '<div class="empty">Nenhum link gerado ainda.</div>';return `<div class="table-wrap" style="border:0;border-radius:0"><table><thead><tr><th>Data</th><th>Aluno</th><th>Status</th><th style="text-align:right">Valor</th><th>Ações</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${humanDate(p.criadoEm)}</td><td><strong>${esc(p.alunoNome||'-')}</strong><div class="muted">${esc(p.orderNsu||p.id)}</div></td><td><span class="badge ${p.status==='pago'?'b-green':p.status==='aguardando_pagamento'?'b-yellow':'b-red'}">${paymentStatusLabelV141(p.status||'aguardando_pagamento')}</span></td><td class="money">${fmt(p.totalCentavos)}</td><td><div class="actions">${p.checkoutUrl&&p.checkoutUrlAtivo!==false&&!['descartado_responsavel','substituido_nova_cobranca'].includes(p.status)?`<button class="btn btn-light" onclick="window.open('${esc(p.checkoutUrl)}','_blank')">Abrir</button>`:''}<button class="btn btn-primary" onclick="verifyCheckoutPaymentV141('${esc(p.orderNsu||p.id)}','${esc(p.transactionNsu||'')}','${esc(p.invoiceSlug||'')}')">Atualizar status</button></div></td></tr>`).join('')}</tbody></table></div>`}
window.renderCobrancas=renderCobrancas=renderCobrancasV141;
window.renderCobrancasV141=renderCobrancasV141;

async function verifyCheckoutPaymentV141(orderNsu,transactionNsu='',invoiceSlug=''){if(typeof window.syncInfinitePayV218==='function')return window.syncInfinitePayV218(orderNsu,transactionNsu,invoiceSlug);try{const resp=await fetch('/api/verificar-pagamento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_nsu:orderNsu,transaction_nsu:transactionNsu,slug:invoiceSlug,contexto:'staff_sync'})});const data=await resp.json().catch(()=>({}));if(!resp.ok)throw new Error(data.error||'Erro ao atualizar pagamento.');toast(data.paid?(data.applicationPending?'Pagamento localizado; processamento pendente.':'Pagamento confirmado e aplicado.'):data.needsIdentifiers?'A InfinitePay ainda não retornou os identificadores da transação.':'Pagamento ainda não confirmado.');renderCobrancas();}catch(e){appMessage(e.message)}}
window.verifyCheckoutPaymentV141=verifyCheckoutPaymentV141;

async function renderDashboardV141(){
  const el=$('#mainContent');el.innerHTML=pageHeader('Resumo do sistema','Operação atual da escola.')+'<div class="empty">Carregando indicadores...</div>';const today=dateKey();
  const [vs,os,acs,fs,pcs]=await Promise.all([db.collection('vendas').where('dataChave','==',today).limit(250).get().catch(()=>({docs:[]})),db.collection('ocorrencias_entrega').where('dataChave','==',today).limit(250).get().catch(()=>({docs:[]})),financialAccountsSnapshotV167(),db.collection('pedidos_farda').limit(150).get().catch(()=>({docs:[]})),recentCheckoutsV141(40)]);
  const salesAll=vs.docs.map(d=>d.data()),sales=salesAll.filter(x=>!String(x.status||'').toLowerCase().includes('cancel')),occ=os.docs.map(d=>d.data()),accounts=acs.docs.map(d=>d.data()),fardas=fs.docs.map(d=>d.data());const gross=sales.reduce((s,x)=>s+Number(x.valorBrutoCentavos||0),0);const open=accounts.reduce((s,x)=>s+Math.max(0,-accountNetV141(x)),0);const blocked=accounts.filter(isBlockedV141).length;const pendingUniform=fardas.filter(x=>!['entregue','cancelado'].includes(x.statusAtendimento)).length;const pendingPay=pcs.filter(x=>(x.status||'aguardando_pagamento')==='aguardando_pagamento').length;
  el.innerHTML=pageHeader('Resumo do sistema','Operação atual da escola.')+`<div class="grid g4"><div class="kpi clickable" onclick="renderVendasV162?.('concluidas')"><div class="kpi-label">Vendas registradas hoje</div><div class="kpi-value">${fmt(gross)}</div><div class="kpi-sub">${sales.length} operações</div></div><div class="kpi orange clickable" onclick="renderCobrancasV162?.('saldo')"><div class="kpi-label">Saldo em aberto</div><div class="kpi-value">${fmt(open)}</div><div class="kpi-sub">Conta corrente dos alunos</div></div><div class="kpi red clickable" onclick="renderCobrancasV162?.('bloqueada')"><div class="kpi-label">Contas bloqueadas</div><div class="kpi-value">${blocked}</div><div class="kpi-sub">saldo semanal, limite ou manual</div></div><div class="kpi green clickable" onclick="renderCobrancasV162?.('pendente')"><div class="kpi-label">Links pendentes</div><div class="kpi-value">${pendingPay}</div><div class="kpi-sub">InfinitePay aguardando</div></div></div><div class="grid g2" style="margin-top:14px"><div class="card clickable" onclick="navigate('pedidos');state.v166OrdersCategory='cantina';setTimeout(()=>renderPedidosV166?.(),0)"><div class="card-head"><div class="card-title">Entregas de hoje</div></div><div class="card-body"><div class="kpi-value">${occ.filter(x=>x.status==='programado').length}</div><span class="muted">Pedidos programados para a data.</span></div></div><div class="card clickable" onclick="state.v166OrdersCategory='fardamento';navigate('pedidos')"><div class="card-head"><div class="card-title">Fardas pendentes</div></div><div class="card-body"><div class="kpi-value">${pendingUniform}</div><span class="muted">Pedidos em reserva, produção ou entrega.</span></div></div></div>`;
}
window.renderDashboard=renderDashboard=renderDashboardV141;

function renderConfigV141(){const c=cfgV141();$('#mainContent').innerHTML=pageHeader('Configurações','Parâmetros operacionais da escola e da conta corrente.')+`<div class="grid g2"><div class="card"><div class="card-head"><div class="card-title">Conta corrente do aluno</div></div><div class="card-body"><div class="fg"><label>Limite máximo de saldo em aberto</label><input id="cfgLimit" class="fi" value="${(c.limiteMaximoFiadoCentavos/100).toFixed(2).replace('.',',')}"></div><div class="fg"><label>Valor mínimo para checkout com saldo regular</label><input id="cfgMinCheckout" class="fi" value="${(c.valorMinimoCheckoutPositivoCentavos/100).toFixed(2).replace('.',',')}"></div><label class="switch-line"><div><strong>Bloqueio semanal automático</strong><div class="muted">Toda sexta-feira, alunos com saldo negativo são bloqueados até regularizar.</div></div><input id="cfgBlockWeekly" type="checkbox" ${c.bloqueioSemanalSaldoAtivo?'checked':''}></label><label class="switch-line"><div><strong>Permitir novo link com pagamento pendente</strong><div class="muted">Se dois links forem pagos, os dois valores entram na conta.</div></div><input id="cfgMultiPending" type="checkbox" ${c.permitirMultiplosLinksPendentes?'checked':''}></label><button class="btn btn-primary" onclick="saveConfig()">Salvar</button></div></div><div class="card"><div class="card-head"><div class="card-title">Preços e estoque base</div></div><div class="card-body"><div class="fg"><label>Salgados padrão por dia</label><input id="cfgSalgado" type="number" class="fi" value="${state.config.quantidadePadraoSalgados||30}"></div><div class="alert"><strong>Fardamento:</strong> preços e estoques são administrados por tamanho em Catálogo de vendas → Camisa de farda.</div><button class="btn btn-primary" onclick="saveConfig()">Salvar</button></div></div></div>`}
window.renderConfig=renderConfig=renderConfigV141;
window.saveConfig=async function saveConfigV141(){await db.collection('configuracoes').doc('sistema').set({versao:V141_VERSION,limiteMaximoFiadoCentavos:parseBRL($('#cfgLimit')?.value||50),valorMinimoCheckoutPositivoCentavos:parseBRL($('#cfgMinCheckout')?.value||1),bloqueioSemanalSaldoAtivo:!!$('#cfgBlockWeekly')?.checked,diaBloqueioSemanalSaldo:'sexta',permitirMultiplosLinksPendentes:!!$('#cfgMultiPending')?.checked,quantidadePadraoSalgados:Number($('#cfgSalgado')?.value||state.config.quantidadePadraoSalgados||30),checkoutInfinitePayAtivo:true,atualizadoEm:nowIso()},{merge:true});await loadCore();toast('Configurações salvas.');};

const _saveParentLimitV141Before=window.saveParentLimit;
window.saveParentLimit=saveParentLimit=async function(){const max=cfgV141().limiteMaximoFiadoCentavos/100;const v=Math.max(0,Math.min(max,Number($('#parentLimit').value||0))),acc=await getAccount(state.parentStudent.id),limit=Math.round(v*100);await financialAccountRefV167(state.parentStudent.id).set({limiteFiadoCentavos:limit,bloqueadoPorLimite:accountNetV141(acc)<0&&Math.abs(accountNetV141(acc))>=limit,atualizadoEm:nowIso()},{merge:true});await audit('limite_responsavel',{alunoId:state.parentStudent.id,limiteCentavos:limit});toast('Limite salvo.');renderParentPortal();};

window.parentToggleAuthorization=parentToggleAuthorization=async function(val){const max=cfgV141().limiteMaximoFiadoCentavos;const typed=Math.round(Number($('#parentLimit')?.value||max/100)*100);const limit=val?Math.max(0,Math.min(max,typed)):centsV141((await getAccount(state.parentStudent.id)).limiteFiadoCentavos||0);await financialAccountRefV167(state.parentStudent.id).set({autorizadoSemSaldo:val,limiteFiadoCentavos:limit,atualizadoEm:nowIso()},{merge:true});await audit('autorizacao_responsavel',{alunoId:state.parentStudent.id,autorizado:val,limiteCentavos:limit});renderParentPortal();};

window.askCreditAmount=function askCreditAmountV141(){if(!state.parentStudent)return;openAccountPaymentV141(state.parentStudent.id,'responsavel');};
window.startCheckout=async function startCheckoutV141(type,amount=0,order=null){if(!state.parentStudent)return appMessage('Aluno não identificado.');if(type==='quitar_divida'||type==='adicionar_credito'||type==='regularizar_saldo'||type==='entrada_conta_aluno')return openAccountPaymentV141(state.parentStudent.id,'responsavel');appMessage('Nesta versão, o checkout ativo é a entrada na conta corrente do aluno.');};

/* inicialização herdada consolidada pela V1.5.0-dev2 */
})();



/* Escola Piaget — V1.4.2: comprovante, retorno automático e extrato humanizado */
(function(){
const V142_VERSION='1.4.2-checkout-comprovante';
function centsV142(v){return Math.round(Number(v||0));}
function savedParentV142(){try{return localStorage.getItem('vp_parent_student')||''}catch(e){return ''}}
function movementTypeLabelV142(m={}){
  const key=String(m.subtipo||m.tipo||'').toLowerCase();
  const map={
    pagamento_checkout_infinitepay:'Crédito via InfinitePay',
    entrada_conta_aluno:'Entrada na conta do aluno',
    pagamento_presencial:'Pagamento presencial',
    consumo_cantina:'Consumo na cantina',
    consumo:'Consumo na cantina',
    venda_conta:'Compra lançada na conta',
    compra_farda:'Compra de farda',
    ajuste_manual:'Ajuste manual',
    estorno:'Estorno',
    credito_convertido:'Crédito convertido'
  };
  return map[key]||String(m.subtipo||m.tipo||'Lançamento').replace(/_/g,' ');
}
function movementMethodLabelV142(m={}){
  const method=m.formaPagamento||m.origem||'';
  if(typeof paymentMethodLabelV141==='function')return paymentMethodLabelV141(method);
  const map={dinheiro:'Dinheiro',pix_manual:'Pix manual',maquininha:'Maquininha',checkout_infinitepay:'InfinitePay',cantina:'Cantina'};
  return map[method]||method||'-';
}
function movementDescriptionV142(m={}){
  if(m.observacao)return esc(m.observacao);
  if(m.orderNsu)return `NSU: ${esc(m.orderNsu)}`;
  if(Array.isArray(m.itens)&&m.itens.length)return m.itens.map(x=>`${x.quantidade||1}× ${esc(x.nome||x.descricao||'item')}`).join(', ');
  if(typeof movementDetailsV141==='function')return movementDetailsV141(m);
  return '-';
}
function movementSignedValueV142(m={}){
  if(typeof movementValueV141==='function')return movementValueV141(m);
  const v=centsV142(m.valorCentavos);return ['consumo','venda_conta','compra_farda'].includes(m.tipo)?-Math.abs(v):v;
}
function ledgerTableV142(moves=[],opts={}){
  if(!moves.length)return '<div class="empty">Nenhum lançamento.</div>';
  const showActions=opts.actions!==false;
  return `<div class="table-wrap" style="border:0"><table><thead><tr><th>Data</th><th>Movimento</th><th>Forma</th><th>Detalhes</th><th style="text-align:right">Valor</th><th style="text-align:right">Saldo</th>${showActions?'<th>Ações</th>':''}</tr></thead><tbody>${moves.map(m=>{const val=movementSignedValueV142(m);return `<tr><td>${humanDate(m.criadoEm)}</td><td><span class="v142-ledger-badge ${val>=0?'in':'out'}">${esc(movementTypeLabelV142(m))}</span></td><td>${esc(movementMethodLabelV142(m))}</td><td>${movementDescriptionV142(m)}</td><td class="money">${fmtSignedV141(val)}</td><td class="money">${m.saldoDepoisCentavos!==undefined?fmtSignedV141(m.saldoDepoisCentavos):'-'}</td>${showActions?`<td>${m.orderNsu?`<button class="btn btn-light" onclick="openReceiptV142('${esc(m.orderNsu)}')">Comprovante</button>`:'-'}</td>`:''}</tr>`}).join('')}</tbody></table></div>`;
}
window.openReceiptV142=function(orderNsu){if(!orderNsu)return;window.open(`/obrigado.html?order_nsu=${encodeURIComponent(orderNsu)}&origem=sistema`,'_blank')};
window.saveBuyerFromPortalV142=async function(alunoId){
  const a=(state.students||[]).find(x=>x.id===alunoId);if(!a)return appMessage('Aluno não encontrado.');
  const customer={};
  const name=String($('#v142BuyerName')?.value||'').trim(),phone=String($('#v142BuyerPhone')?.value||'').trim(),email=String($('#v142BuyerEmail')?.value||'').trim().toLowerCase();
  if(name)customer.name=name;if(phone)customer.phone_number=phone;if(email)customer.email=email;
  await db.collection('dados_pagamento_responsavel').doc(alunoId).set({alunoId,alunoNome:a.nome,matricula:a.matricula||null,customer,atualizadoEm:nowIso(),atualizadoPorId:'portal_responsavel',atualizadoPorNome:a.responsavelFinanceiro||'Responsável',atualizadoPorPerfil:'responsavel'},{merge:true});
  await audit('dados_comprador_atualizados',{alunoId,descricao:'Responsável atualizou os dados do comprador para próximos pagamentos.'}).catch(()=>{});
  toast('Dados do comprador salvos.');
};
async function buyerCardHtmlV142(a){
  const buyer=await getSavedBuyerV141(a.id).catch(()=>({}));
  return `<div class="card v142-buyer-card" style="margin-top:14px"><div class="card-head"><div class="card-title">Dados do comprador</div></div><div class="card-body"><p class="muted">Esses dados são opcionais e servem para facilitar os próximos pagamentos. O sistema não armazena cartão.</p><div class="grid g3"><div class="fg"><label>Nome</label><input id="v142BuyerName" class="fi" value="${esc(buyer.name||a.responsavelFinanceiro||'')}"></div><div class="fg"><label>Telefone</label><input id="v142BuyerPhone" class="fi" value="${esc(buyer.phone_number||a.celularResponsavel||'')}"></div><div class="fg"><label>E-mail</label><input id="v142BuyerEmail" class="fi" value="${esc(buyer.email||'')}"></div></div><button class="btn btn-primary" onclick="saveBuyerFromPortalV142('${a.id}')">Salvar dados para próximas compras</button></div></div>`;
}
async function openStudentDetailsV142(id){
  const a=state.students.find(x=>x.id===id),acc=await getAccount(id);if(!a)return;
  const ms=await db.collection('movimentos_conta').where('alunoId','==',id).limit(200).get().catch(()=>({docs:[]}));
  const moves=ms.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>String(y.criadoEm).localeCompare(String(x.criadoEm))).slice(0,50);
  const pending=await pendingCheckoutsV141(id),canManage=canStaffManageV141();
  openModal('Conta do aluno',`<div class="status-panel"><div class="small">${esc(a.turma)} · Matrícula ${esc(a.matricula)}</div><div class="big">${esc(a.nome)}</div><div class="small">Responsável: ${esc(a.responsavelFinanceiro)}</div></div>${balanceSummaryHtmlV141(acc)}${accountStatusHtmlV141(acc)}${pending.length?`<div class="v141-alert-inline"><strong>${pending.length} pagamento(s) pendente(s).</strong><br>É permitido gerar outro link, mas se mais de um for pago, todos os valores entram no saldo do aluno.</div>`:''}<div class="switch-line"><div><strong>Compra sem saldo</strong><div class="muted">${acc.autorizadoSemSaldo?'Autorizada pelo responsável':'Bloqueada pelo responsável'}</div></div><span class="badge ${acc.autorizadoSemSaldo?'b-green':'b-red'}">${acc.autorizadoSemSaldo?'liberada':'bloqueada'}</span></div>${canManage?`<div class="actions" style="margin:12px 0"><button class="btn btn-primary" onclick="openAccountPaymentV141('${id}','staff')">Gerar link InfinitePay</button><button class="btn btn-green" onclick="registerManualPaymentV141('${id}')">Registrar pagamento presencial</button><button class="btn btn-outline" onclick="toggleManualBlock('${id}',${!acc.bloqueioManual})">${acc.bloqueioManual?'Remover bloqueio manual':'Bloquear conta'}</button><button class="btn btn-light" onclick="generateReport('${id}')">Relatório PDF / imagem</button></div>`:''}<div class="card-title" style="margin:15px 0 8px">Extrato recente</div>${ledgerTableV142(moves,{actions:true})}`);
}
window.openStudentDetails=openStudentDetails=openStudentDetailsV142;window.openStudentDetailsV142=openStudentDetailsV142;
function checkoutTableV142(rows){if(!rows.length)return '<div class="empty">Nenhum link gerado ainda.</div>';return `<div class="table-wrap" style="border:0;border-radius:0"><table><thead><tr><th>Data</th><th>Aluno</th><th>Status</th><th style="text-align:right">Valor</th><th>NSU</th><th>Ações</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${humanDate(p.criadoEm)}</td><td><strong>${esc(p.alunoNome||'-')}</strong><div class="muted">${esc(p.matricula||'')}</div></td><td><span class="badge ${p.status==='pago'?'b-green':p.status==='aguardando_pagamento'?'b-yellow':'b-red'}">${paymentStatusLabelV141(p.status||'aguardando_pagamento')}</span></td><td class="money">${fmt(p.totalCentavos)}</td><td>${esc(p.orderNsu||p.id)}</td><td><div class="actions">${p.checkoutUrl&&p.checkoutUrlAtivo!==false&&!['descartado_responsavel','substituido_nova_cobranca'].includes(p.status)?`<button class="btn btn-light" onclick="window.open('${esc(p.checkoutUrl)}','_blank')">Abrir</button>`:''}<button class="btn btn-primary" onclick="verifyCheckoutPaymentV141('${esc(p.orderNsu||p.id)}','${esc(p.transactionNsu||'')}','${esc(p.invoiceSlug||'')}')">Atualizar status</button>${p.status==='pago'?`<button class="btn btn-green" onclick="openReceiptV142('${esc(p.orderNsu||p.id)}')">Comprovante</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`}
try{window.checkoutTableV141=checkoutTableV141=checkoutTableV142}catch(e){window.checkoutTableV141=checkoutTableV142}
/* atualização de versão herdada removida pela V1.5.0-dev2 */
})();



/* Escola Piaget — V1.4.3: auditoria e correção do Meu Piaget.
   Correção principal: a V1.4.2 chamava helpers da V1.4.1 que estavam protegidos dentro de outro escopo.
   O resultado era login parcialmente concluído: topo mudava para Responsável, mas o perfil não renderizava.
*/
(function(){
const V143_VERSION='1.4.3-checkout-auditoria';
const CHECKOUT_COLLECTION_V143='pagamentos_checkout';
function centsV143(v){return Math.round(Number(v||0));}
function cfgV143(){return {limiteMaximoFiadoCentavos:centsV143(state.config?.limiteMaximoFiadoCentavos||5000),valorMinimoCheckoutPositivoCentavos:centsV143(state.config?.valorMinimoCheckoutPositivoCentavos||100),bloqueioSemanalSaldoAtivo:state.config?.bloqueioSemanalSaldoAtivo!==false,permitirMultiplosLinksPendentes:state.config?.permitirMultiplosLinksPendentes!==false,diaBloqueioSemanalSaldo:state.config?.diaBloqueioSemanalSaldo||'sexta'};}
function netV143(acc){if(acc&&typeof acc.saldoContaCentavos==='number')return centsV143(acc.saldoContaCentavos);return centsV143(acc?.saldoCreditoCentavos)-centsV143(acc?.dividaCentavos);}
function fmtSignedV143(c){const n=centsV143(c);return (n<0?'-':'')+fmt(Math.abs(n));}
function isBlockedV143(acc){return Boolean(acc?.bloqueioManual||acc?.bloqueioSaldoSemanal||acc?.bloqueadoPorLimite);}
function blockedReasonV143(acc){if(acc?.bloqueioManual)return 'Bloqueio manual da secretaria/gestão';if(acc?.bloqueioSaldoSemanal)return 'Bloqueio semanal por saldo em aberto';if(acc?.bloqueadoPorLimite)return 'Limite de saldo em aberto atingido';return 'Conta liberada';}
function paymentMethodLabelV143(m){const map={dinheiro:'Dinheiro',pix_manual:'Pix manual',pix_banco:'Pix banco',pix_rede:'Pix Rede / Laranjinha',cartao_rede:'Cartão Rede / Laranjinha',maquininha:'Maquininha',checkout_infinitepay:'Checkout InfinitePay',cantina:'Cantina',secretaria_presencial:'Secretaria presencial',checkout:'Checkout'};return map[m]||m||'-';}
function paymentStatusLabelV143(s){const map={preparando_link:'Preparando link',aguardando_pagamento:'Aguardando pagamento',erro_timeout:'Tempo excedido',pago:'Pago',confirmado:'Confirmado',erro_gerar_link:'Erro ao gerar link',erro_sem_url:'Erro sem URL',cancelado:'Cancelado',expirado:'Expirado',pagamento_localizado_processando:'Pagamento localizado — processando',pagamento_localizado_aguardando_processamento:'Pagamento localizado — aguardando processamento',descartado_responsavel:'Descartada pelo responsável',substituido_nova_cobranca:'Substituída',pago_descartado_creditado:'Pago após descarte — creditado',sem_retorno_infinitepay:'Sem retorno da InfinitePay'};return map[s]||s||'-';}
function movementTypeLabelV143(m={}){const key=String(m.subtipo||m.tipo||'').toLowerCase();const map={pagamento_checkout_infinitepay:'Crédito via InfinitePay',entrada_conta_aluno:'Entrada na conta do aluno',pagamento_presencial:'Pagamento presencial',consumo_cantina:'Consumo na cantina',consumo:'Consumo na cantina',venda_conta:'Compra lançada na conta',compra_farda:'Compra de farda',ajuste_manual:'Ajuste manual',estorno:'Estorno',credito_convertido:'Crédito convertido'};return map[key]||String(m.subtipo||m.tipo||'Lançamento').replace(/_/g,' ');}
function movementValueV143(m={}){const v=centsV143(m.valorCentavos);if(['consumo','venda_conta','compra_farda'].includes(m.tipo)||m.subtipo==='consumo'||m.subtipo==='consumo_cantina')return -Math.abs(v);return v;}
function movementDetailsV143(m={}){if(m.observacao)return esc(m.observacao);if(m.orderNsu)return `NSU: ${esc(m.orderNsu)}`;if(m.saldoAntesCentavos!==undefined)return `Saldo: ${fmtSignedV143(m.saldoAntesCentavos)} → ${fmtSignedV143(m.saldoDepoisCentavos)}`;if(Array.isArray(m.itens)&&m.itens.length)return m.itens.map(x=>`${x.quantidade||1}× ${esc(x.nome||x.descricao||'item')}`).join(', ');return '-';}
function balanceSummaryHtmlV143(acc){const net=netV143(acc),open=Math.max(0,-net),credit=Math.max(0,net);return `<div class="v141-balance-box"><div class="v141-balance-card"><small>Saldo da conta</small><strong>${fmtSignedV143(net)}</strong><div class="v141-mini">positivo = crédito · negativo = saldo em aberto</div></div><div class="v141-balance-card"><small>Saldo em aberto</small><strong>${fmt(open)}</strong><div class="v141-mini">valor mínimo para regularizar quando negativo</div></div><div class="v141-balance-card"><small>Crédito disponível</small><strong>${fmt(credit)}</strong><div class="v141-mini">usado em novas compras</div></div></div>`;}
function accountStatusHtmlV143(acc){const net=netV143(acc),blocked=isBlockedV143(acc);if(blocked)return `<div class="v141-status blocked"><strong>Conta bloqueada.</strong><br>${esc(blockedReasonV143(acc))}. ${net<0?`Para desbloquear, regularize pelo menos ${fmt(Math.abs(net))}.`:'A conta será liberada ao regularizar a pendência.'}</div>`;if(net<0)return `<div class="v141-status open"><strong>Saldo em aberto.</strong><br>A conta ainda pode operar dentro do limite definido, mas será bloqueada no fechamento semanal de sexta-feira se continuar negativa.</div>`;return `<div class="v141-status"><strong>Conta liberada.</strong><br>Saldo regular para consumo e novos pedidos.</div>`;}
async function pendingCheckoutsV143(alunoId){const active=new Set(['preparando_link','aguardando_pagamento','erro_timeout','erro_gerar_link','erro_sem_url','pagamento_localizado_processando','pagamento_localizado_aguardando_processamento','sem_retorno_infinitepay']);try{const rows=[];let cursor=null;while(true){let q=db.collection(CHECKOUT_COLLECTION_V143).where('alunoId','==',alunoId).limit(100);if(cursor)q=q.startAfter(cursor);const snap=await q.get();rows.push(...snap.docs.map(d=>({id:d.id,...d.data()})));if(snap.docs.length<100)break;cursor=snap.docs[snap.docs.length-1]}return rows.filter(x=>active.has(x.status||'aguardando_pagamento')).sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||'')));}catch(e){console.warn('pendingCheckoutsV143',e);try{appMessage('Não foi possível conferir os pagamentos pendentes. A operação foi interrompida para evitar uma cobrança duplicada.',{title:'Falha ao conferir cobranças',tone:'danger'})}catch(_){}throw e}}
async function recentCheckoutsV143(limit=40){try{const snap=await db.collection(CHECKOUT_COLLECTION_V143).orderBy('criadoEm','desc').limit(limit).get().catch(()=>db.collection(CHECKOUT_COLLECTION_V143).limit(limit).get());return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||'')));}catch(e){console.warn('recentCheckoutsV143',e);return [];}}
async function getSavedBuyerV143(alunoId){try{const s=await db.collection('dados_pagamento_responsavel').doc(alunoId).get();return s.exists?(s.data().customer||{}):{};}catch(e){return {};}}
function canStaffManageV143(){return state.user&&['secretaria','gestao','admin','administracao'].includes(state.user.perfil);}
function ledgerTableV143(moves=[],opts={}){if(!moves.length)return '<div class="empty">Nenhum lançamento.</div>';const showActions=opts.actions!==false;return `<div class="table-wrap" style="border:0"><table><thead><tr><th>Data</th><th>Movimento</th><th>Forma</th><th>Detalhes</th><th style="text-align:right">Valor</th><th style="text-align:right">Saldo</th>${showActions?'<th>Ações</th>':''}</tr></thead><tbody>${moves.map(m=>{const val=movementValueV143(m);return `<tr><td>${humanDate(m.criadoEm)}</td><td><span class="v143-ledger-badge ${val>=0?'in':'out'}">${esc(movementTypeLabelV143(m))}</span></td><td>${esc(paymentMethodLabelV143(m.formaPagamento||m.origem||''))}</td><td>${movementDetailsV143(m)}</td><td class="money">${fmtSignedV143(val)}</td><td class="money">${m.saldoDepoisCentavos!==undefined?fmtSignedV143(m.saldoDepoisCentavos):'-'}</td>${showActions?`<td>${m.orderNsu?`<button class="btn btn-light" onclick="openReceiptV142('${esc(m.orderNsu)}')">Comprovante</button>`:'-'}</td>`:''}</tr>`}).join('')}</tbody></table></div>`;}
async function buyerCardHtmlV143(a){const buyer=await getSavedBuyerV143(a.id);return `<div class="card v142-buyer-card" style="margin-top:14px"><div class="card-head"><div class="card-title">Dados do comprador</div></div><div class="card-body"><p class="muted">Esses dados são opcionais e servem para facilitar os próximos pagamentos. O sistema não armazena cartão.</p><div class="grid g3"><div class="fg"><label>Nome</label><input id="v142BuyerName" class="fi" value="${esc(buyer.name||a.responsavelFinanceiro||'')}"></div><div class="fg"><label>Telefone</label><input id="v142BuyerPhone" class="fi" value="${esc(buyer.phone_number||a.celularResponsavel||'')}"></div><div class="fg"><label>E-mail</label><input id="v142BuyerEmail" class="fi" value="${esc(buyer.email||'')}"></div></div><button class="btn btn-primary" onclick="saveBuyerFromPortalV142('${a.id}')">Salvar dados para próximas compras</button></div></div>`;}

// Expõe os helpers que a V1.4.2 passou a chamar sem estarem no escopo global.
window.cfgV141=window.cfgV141||cfgV143;
window.fmtSignedV141=window.fmtSignedV141||fmtSignedV143;
window.paymentMethodLabelV141=window.paymentMethodLabelV141||paymentMethodLabelV143;
window.paymentStatusLabelV141=window.paymentStatusLabelV141||paymentStatusLabelV143;
window.movementValueV141=window.movementValueV141||movementValueV143;
window.movementDetailsV141=window.movementDetailsV141||movementDetailsV143;
window.pendingCheckoutsV141=window.pendingCheckoutsV141||pendingCheckoutsV143;
window.recentCheckoutsV141=window.recentCheckoutsV141||recentCheckoutsV143;
window.getSavedBuyerV141=window.getSavedBuyerV141||getSavedBuyerV143;
window.balanceSummaryHtmlV141=window.balanceSummaryHtmlV141||balanceSummaryHtmlV143;
window.accountStatusHtmlV141=window.accountStatusHtmlV141||accountStatusHtmlV143;
window.canStaffManageV141=window.canStaffManageV141||canStaffManageV143;
window.accountNetV141=window.accountNetV141||netV143;

async function openStudentDetailsV143(id){
  const a=state.students.find(x=>x.id===id),acc=await getAccount(id);if(!a)return;
  const ms=await db.collection('movimentos_conta').where('alunoId','==',id).limit(200).get().catch(()=>({docs:[]}));
  const moves=ms.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>String(y.criadoEm||'').localeCompare(String(x.criadoEm||''))).slice(0,50);
  const pending=await pendingCheckoutsV143(id),canManage=canStaffManageV143();
  openModal('Conta do aluno',`<div class="status-panel"><div class="small">${esc(a.turma)} · Matrícula ${esc(a.matricula)}</div><div class="big">${esc(a.nome)}</div><div class="small">Responsável: ${esc(a.responsavelFinanceiro)}</div></div>${balanceSummaryHtmlV143(acc)}${accountStatusHtmlV143(acc)}${pending.length?`<div class="v141-alert-inline"><strong>${pending.length} pagamento(s) pendente(s).</strong><br>É permitido gerar outro link, mas se mais de um for pago, todos os valores entram no saldo do aluno.</div>`:''}<div class="switch-line"><div><strong>Compra sem saldo</strong><div class="muted">${acc.autorizadoSemSaldo?'Autorizada pelo responsável':'Bloqueada pelo responsável'}</div></div><span class="badge ${acc.autorizadoSemSaldo?'b-green':'b-red'}">${acc.autorizadoSemSaldo?'liberada':'bloqueada'}</span></div>${canManage?`<div class="actions" style="margin:12px 0"><button class="btn btn-primary" onclick="openAccountPaymentV141('${id}','staff')">Gerar link InfinitePay</button><button class="btn btn-green" onclick="registerManualPaymentV141('${id}')">Registrar pagamento presencial</button><button class="btn btn-outline" onclick="toggleManualBlock('${id}',${!acc.bloqueioManual})">${acc.bloqueioManual?'Remover bloqueio manual':'Bloquear conta'}</button><button class="btn btn-light" onclick="generateReport('${id}')">Relatório PDF / imagem</button></div>`:''}<div class="card-title" style="margin:15px 0 8px">Extrato recente</div>${ledgerTableV143(moves,{actions:true})}`);
}
function checkoutTableV143(rows){if(!rows.length)return '<div class="empty">Nenhum link gerado ainda.</div>';return `<div class="table-wrap" style="border:0;border-radius:0"><table><thead><tr><th>Data</th><th>Aluno</th><th>Status</th><th style="text-align:right">Valor</th><th>NSU</th><th>Ações</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${humanDate(p.criadoEm)}</td><td><strong>${esc(p.alunoNome||'-')}</strong><div class="muted">${esc(p.matricula||'')}</div></td><td><span class="badge ${p.status==='pago'?'b-green':p.status==='aguardando_pagamento'?'b-yellow':'b-red'}">${paymentStatusLabelV143(p.status||'aguardando_pagamento')}</span></td><td class="money">${fmt(p.totalCentavos)}</td><td>${esc(p.orderNsu||p.id)}</td><td><div class="actions">${p.checkoutUrl&&p.checkoutUrlAtivo!==false&&!['descartado_responsavel','substituido_nova_cobranca'].includes(p.status)?`<button class="btn btn-light" onclick="window.open('${esc(p.checkoutUrl)}','_blank')">Abrir</button>`:''}<button class="btn btn-primary" onclick="verifyCheckoutPaymentV141('${esc(p.orderNsu||p.id)}','${esc(p.transactionNsu||'')}','${esc(p.invoiceSlug||'')}')">Atualizar status</button>${p.status==='pago'?`<button class="btn btn-green" onclick="openReceiptV142('${esc(p.orderNsu||p.id)}')">Comprovante</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`;}
window.parentLogoutV143=function(){try{localStorage.removeItem('vp_parent_student')}catch(e){};state.parentStudent=null;state.parentChallenge=null;renderParentLogin();};
window.openStudentDetails=openStudentDetails=openStudentDetailsV143;window.openStudentDetailsV143=openStudentDetailsV143;
window.checkoutTableV141=checkoutTableV141=checkoutTableV143;window.checkoutTableV143=checkoutTableV143;
window.saveParentLimit=saveParentLimit=async function(){const max=cfgV143().limiteMaximoFiadoCentavos/100;const v=Math.max(0,Math.min(max,Number(($('#parentLimit')?.value||'0').replace?.(',','.')||$('#parentLimit')?.value||0))),acc=await getAccount(state.parentStudent.id),limit=Math.round(v*100);await financialAccountRefV167(state.parentStudent.id).set({limiteFiadoCentavos:limit,bloqueadoPorLimite:netV143(acc)<0&&Math.abs(netV143(acc))>=limit,atualizadoEm:nowIso()},{merge:true});await audit('limite_responsavel',{alunoId:state.parentStudent.id,limiteCentavos:limit,versao:'v1.4.3'}).catch(()=>{});toast('Limite salvo.');renderParentPortal();};
window.parentToggleAuthorization=parentToggleAuthorization=async function(val){const max=cfgV143().limiteMaximoFiadoCentavos;const typed=Math.round(Number(($('#parentLimit')?.value||String(max/100)).replace?.(',','.')||max/100)*100);const limit=val?Math.max(0,Math.min(max,typed)):centsV143((await getAccount(state.parentStudent.id)).limiteFiadoCentavos||0);await financialAccountRefV167(state.parentStudent.id).set({autorizadoSemSaldo:val,limiteFiadoCentavos:limit,atualizadoEm:nowIso()},{merge:true});await audit('autorizacao_responsavel',{alunoId:state.parentStudent.id,autorizado:val,limiteCentavos:limit,versao:'v1.4.3'}).catch(()=>{});renderParentPortal();};
/* atualização de versão herdada removida pela V1.5.0-dev2 */
})();


/* V1.6.0-rc2.7.23 — tentativa idempotente e feedback de checkout */
function stableCheckoutStringV154(value){
  if(Array.isArray(value))return `[${value.map(stableCheckoutStringV154).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableCheckoutStringV154(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function checkoutHashV154(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function newAttemptIdV154(){try{return crypto.randomUUID()}catch(e){return `piaget-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}}
function checkoutAttemptV154(payload){
  const fingerprint=checkoutHashV154(stableCheckoutStringV154({...payload,idTentativa:undefined}));
  const key=`vp_checkout_attempt_${fingerprint}`;let saved=null;
  try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
  if(!saved||!saved.id||Date.now()-Number(saved.createdAt||0)>15*60*1000){saved={id:newAttemptIdV154(),createdAt:Date.now()};try{localStorage.setItem(key,JSON.stringify(saved))}catch(e){}}
  return {id:saved.id,key,fingerprint};
}
function clearCheckoutAttemptV154(attempt){if(!attempt)return;try{localStorage.removeItem(attempt.key)}catch(e){}}
async function requestCheckoutV154(payload,{button=null,statusHost=null}={}){
  const attempt=checkoutAttemptV154(payload);payload={...payload,idTentativa:attempt.id};
  const original=button?.textContent||'';let phaseTimer=null,controller=new AbortController(),timeout=null;
  if(button){button.disabled=true;button.textContent='Validando pedido...';phaseTimer=setTimeout(()=>{if(button)button.textContent='Abrindo InfinitePay...'},2200)}
  if(statusHost)statusHost.innerHTML='<div class="v151-inline-loader">Preparando o pagamento...</div>';
  try{
    timeout=setTimeout(()=>controller.abort(),25000);
    const response=await fetch('/api/criar-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(data.preparando){
      if(statusHost)statusHost.innerHTML='<div class="alert warn"><strong>O link ainda está sendo preparado.</strong><br>Você pode fechar esta tela e acompanhar em Pagamentos pendentes.</div>';
      return data;
    }
    if(!response.ok){clearCheckoutAttemptV154(attempt);throw new Error(data.error||'Não foi possível gerar o checkout.')}
    if(data.sem_checkout)clearCheckoutAttemptV154(attempt);
    return data;
  }catch(error){
    if(error?.name==='AbortError'){
      if(statusHost)statusHost.innerHTML='<div class="alert warn"><strong>A geração está demorando mais que o esperado.</strong><br>Não clique novamente. Consulte Pagamentos pendentes em alguns instantes.</div>';
      const e=new Error('O link ainda pode estar sendo preparado. Consulte Pagamentos pendentes antes de tentar novamente.');e.checkoutPending=true;throw e;
    }
    throw error;
  }finally{
    clearTimeout(timeout);clearTimeout(phaseTimer);
    if(button){button.disabled=false;button.textContent=original||'Continuar'}
  }
}
window.requestCheckoutV154=requestCheckoutV154;
