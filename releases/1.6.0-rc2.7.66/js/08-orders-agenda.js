
(()=>{
'use strict';
const V150_VERSION='1.6.0-rc2.7.66';
const V150_FINAL_STATUSES=['entregue','aluno_ausente','nao_entregue','cancelado'];
state.v150AgendaDate=state.v150AgendaDate||dateKey();
state.v150AgendaTurn=state.v150AgendaTurn||'todos';
state.v150OrderMode=state.v150OrderMode||'semanal';
state.v150OrderDates=state.v150OrderDates||[];

const V221_AGENDA_PAGE=200;
function docIdFieldV221(){return firebase.firestore.FieldPath.documentId()}
async function collectExactV221(query,pageSize=V221_AGENDA_PAGE){
  const rows=[];let cursor=null;
  while(true){
    let q=query.orderBy(docIdFieldV221()).limit(pageSize);if(cursor)q=q.startAfter(cursor);
    const snap=await q.get();rows.push(...snap.docs.map(d=>({id:d.id,...d.data()})));
    if(snap.docs.length<pageSize)break;cursor=snap.docs[snap.docs.length-1];
  }
  return rows;
}

function netV150(a={}){if(typeof a.saldoContaCentavos==='number')return Math.round(Number(a.saldoContaCentavos||0));return Math.round(Number(a.saldoCreditoCentavos||0))-Math.round(Number(a.dividaCentavos||0))}
function splitV150(n){n=Math.round(Number(n||0));return{saldoContaCentavos:n,saldoCreditoCentavos:Math.max(0,n),dividaCentavos:Math.max(0,-n)}}
function cfg150(){return{quantidadePadraoSalgados:30,reservaPedidoMinutos:5,valorMinimoCheckoutPositivoCentavos:100,...(state.config||{})}}
function dateFromKeyV150(key){return new Date(String(key)+'T12:00:00')}
function addDaysV150(key,days){return window.PiagetPortalUtils.addDays(key,days)}
window.addDaysV150=addDaysV150;
function nextBusinessV150(from=dateKey()){let key=from;for(let i=0;i<10;i++){const d=dateFromKeyV150(key);if(![0,6].includes(d.getDay()))return key;key=addDaysV150(key,1)}return from}
function nextMondayV150(){const d=new Date();const add=(8-d.getDay())%7;d.setDate(d.getDate()+add);return dateKey(d)}
function dateLabelV150(key){const d=dateFromKeyV150(key);return d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','')}
function statusLabelV150(s){return({aguardando_pagamento:'Aguardando pagamento',pago_com_saldo:'Pago com saldo',confirmado:'Confirmado',concluido:'Concluído',revisao:'Em revisão',reservado:'Reservado',cancelado_reserva:'Reserva expirada',erro_gerar_link:'Erro no pagamento',pendente_entrega:'Pendente',entregue:'Entregue',aluno_ausente:'Aluno ausente',nao_entregue:'Não entregue',revisao_solicitada:'Correção solicitada',cancelado:'Cancelado'})[s]||String(s||'-').replaceAll('_',' ')}
function badgeClassV150(s){if(['confirmado','concluido','entregue','pago','pago_com_saldo'].includes(s))return'b-green';if(['revisao','nao_entregue','cancelado','erro_gerar_link'].includes(s))return'b-red';return'b-yellow'}
function activeReservationsV150(map={}){const now=Date.now();return Object.values(map||{}).reduce((s,r)=>new Date(r?.expiraEm||0).getTime()>now?s+Number(r.quantidade||0):s,0)}
function dailyAvailabilityV150(d={},day=dateKey()){const planned=Math.max(0,Number(d.quantidadePlanejada??cfg150().quantidadePadraoSalgados??30)),receivedDefined=d.quantidadeRecebida!==undefined&&d.quantidadeRecebida!==null&&d.quantidadeRecebida!=='',received=receivedDefined?Math.max(0,Number(d.quantidadeRecebida||0)):null,capacity=receivedDefined?received:planned,reserved=activeReservationsV150(d.reservas),confirmed=Number(d.pedidosConfirmados||0),cash=Number(d.vendidoDinheiro||0)+Number(d.vendidoAvulso||0),account=Number(d.consumoConta||0),used=reserved+confirmed+cash+account,baseActive=![0,6].includes(dateFromKeyV150(day).getDay())&&!(cfg150().diasSemAula||[]).includes(day),active=typeof d.vendaAtiva==='boolean'?d.vendaAtiva:baseActive;return{active,planned,received,capacity,reserved,confirmed,cash,account,used,released:Number(d.liberadoPorAusencia||0),available:Math.max(0,capacity-used),deficit:Math.max(0,used-capacity)}}
function productSalgadoQtyV150(productId,qty=1,seen=new Set()){const p=productById(productId);if(!p||seen.has(productId))return 0;if(productId==='salgado')return qty;if(!p.combo)return 0;const next=new Set(seen);next.add(productId);return(p.componentes||[]).reduce((s,c)=>s+productSalgadoQtyV150(c.produtoId,qty*Number(c.quantidade||1),next),0)}
function orderProductsV150(){
  const staff=['staff','mixed_sale'].includes(state.v151OrderContext);
  return (state.products||[])
    .filter(p=>{
      const active=p.ativo!==false;
      const notUniform=(p.areaComercial||'cantina')!=='fardas';
      const allowed=staff
        ? p.vendaSecretaria!==false
        : (p.portal!==false&&p.vendaResponsavel!==false);
      return active&&notUniform&&allowed;
    })
    .sort((a,b)=>(a.categoria||'').localeCompare(b.categoria||'')||a.nome.localeCompare(b.nome));
}
function optionsProductsV150(selected=''){return orderProductsV150().map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.nome)} — ${fmt(productPrice(p))}</option>`).join('')}


async function loadOrdersForStudentV150(studentId){
  const rows=await collectExactV221(db.collection('pedidos').where('alunoId','==',studentId));
  return rows.sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||'')));
}
async function renderParentOrdersV150(){
  const host=$('#v150ParentOrders');if(!host||!state.parentStudent)return;
  const rows=(await loadOrdersForStudentV150(state.parentStudent.id)).filter(x=>(x.tipoPedido||'cantina')==='cantina').sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||''))).slice(0,8);
  if(!rows.length){host.innerHTML='<div class="alert" style="margin-top:4px">Ainda não há pedidos programados para este aluno.</div>';return}
  host.innerHTML=`<div class="card-title" style="margin-bottom:8px">Pedidos recentes</div><div class="v150-order-list">${rows.map(r=>{const days=r.dias||[],first=days[0]?.dataChave,last=days[days.length-1]?.dataChave,period=first?(first===last?dateLabelV150(first):`${dateLabelV150(first)} a ${dateLabelV150(last)}`):'-';const expired=r.statusPagamento==='aguardando_pagamento'&&r.reservaExpiraEm&&new Date(r.reservaExpiraEm).getTime()<=Date.now(),shownStatus=expired?'cancelado_reserva':(r.statusPedido||r.statusPagamento);return`<div class="v150-order-row"><div><strong>${esc(r.modalidade==='mensal'?'Programação mensal':r.modalidade==='semanal'?'Programação semanal':'Pedido avulso')}</strong><div class="muted" style="font-size:12px">${period} · ${days.length} entrega(s) · ${fmt(r.totalCentavos)}</div>${r.reservaExpiraEm&&r.statusPagamento==='aguardando_pagamento'?`<div class="v150-status-note">Reserva temporária até ${new Date(r.reservaExpiraEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>`:''}</div><span class="badge ${badgeClassV150(shownStatus)}">${esc(statusLabelV150(shownStatus))}</span></div>`}).join('')}</div>`;
}
window.renderParentOrdersV150=renderParentOrdersV150;

function orderModeLabelV1523(mode){return mode==='avulso'?'um dia':mode==='mensal'?'o mês':'a semana'}
function periodInputIdV1523(mode){return mode==='avulso'?'v150OrderDate':mode==='mensal'?'v150OrderMonth':'v150OrderWeek'}
function currentPeriodValueV1523(){return document.getElementById(periodInputIdV1523(state.v150OrderMode))?.value||''}
function openParentOrderV150(mode='semanal',restore=false){
  state.v150OrderMode=mode;
  openModal('Programar lanches',`<div class="tabs" aria-label="Período do pedido"><button class="tab ${mode==='avulso'?'active':''}" onclick="setParentOrderModeV150('avulso',this)">Um dia</button><button class="tab ${mode==='semanal'?'active':''}" onclick="setParentOrderModeV150('semanal',this)">Semana</button><button class="tab ${mode==='mensal'?'active':''}" onclick="setParentOrderModeV150('mensal',this)">Mês</button></div><div id="v150OrderPeriod"></div><div id="v150OrderPlanner"></div>`);
  document.querySelector('.modal')?.classList.add('v151-modal-wide');
  setParentOrderModeV150(mode,null,restore);
}
window.openParentOrderV150=openParentOrderV150;window.openParentOrder=openParentOrderV150;
function periodToolbarV1523(mode){
  if(mode==='avulso')return `<div class="v150-order-toolbar"><div class="fg"><label>Data da entrega</label><input id="v150OrderDate" type="date" class="fi" min="${dateKey()}" value="${nextBusinessV150(dateKey())}"></div><button class="btn btn-primary" onclick="buildOrderPlannerV150()">Montar pedido</button></div>`;
  if(mode==='mensal')return `<div class="v150-order-toolbar"><div class="fg"><label>Mês</label><input id="v150OrderMonth" type="month" class="fi" min="${dateKey().slice(0,7)}" value="${dateKey().slice(0,7)}"></div><button class="btn btn-primary" onclick="buildOrderPlannerV150()">Montar mês</button></div>`;
  return `<div class="v150-order-toolbar"><div class="fg"><label>Segunda-feira da semana</label><input id="v150OrderWeek" type="date" class="fi" min="${dateKey()}" value="${nextMondayV150()}"></div><button class="btn btn-primary" onclick="buildOrderPlannerV150()">Montar semana</button></div>`;
}
function setParentOrderModeV150(mode,btn,restore=false){
  const changed=state.v150OrderMode!==mode;state.v150OrderMode=mode;
  if(changed&&!restore)state.v1523OrderDraft=null;
  if(btn){$$('#modalBody .tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}
  const host=$('#v150OrderPeriod');if(!host)return;host.innerHTML=periodToolbarV1523(mode);
  $('#v150OrderPlanner').innerHTML=`<div class="v1523-compact-help"><span>Escolha ${orderModeLabelV1523(mode)} e monte os lanches.</span>${infoButton('Como programar','Você poderá marcar os dias, adicionar vários produtos em cada data e ajustar as quantidades antes de revisar o pedido.')}</div>`;
  if(restore&&state.v1523OrderDraft?.mode===mode)setTimeout(restoreOrderPlannerV1523,0);
}
window.setParentOrderModeV150=setParentOrderModeV150;
function plannerDatesV150(){
  const mode=state.v150OrderMode;
  if(mode==='avulso'){const value=$('#v150OrderDate')?.value;return value&&value>=dateKey()?[value]:[]}
  if(mode==='semanal'){const start=$('#v150OrderWeek')?.value;if(!start)return[];const arr=[];for(let i=0;i<7;i++){const key=addDaysV150(start,i);if(key>=dateKey())arr.push(key)}return arr}
  const value=$('#v150OrderMonth')?.value;if(!value)return[];const [y,m]=value.split('-').map(Number),arr=[];for(let day=1;day<=new Date(y,m,0).getDate();day++){const d=new Date(y,m-1,day,12),key=dateKey(d);if(key>=dateKey())arr.push(key)}return arr;
}
function normalizePlannerItemV164(item,defaultId){
  const products=orderProductsV150(),fallback=products.some(p=>p.id===defaultId)?defaultId:(products[0]?.id||'');
  const productId=products.some(p=>p.id===item?.productId)?item.productId:fallback;
  return{productId,quantity:Math.min(10,Math.max(1,Math.round(Number(item?.quantity||1))))};
}
function normalizePlannerDraftRowsV164(draftRows=[],defaultId=''){
  const grouped=new Map();
  for(const raw of draftRows||[]){
    if(!raw?.date)continue;
    const current=grouped.get(raw.date)||{date:raw.date,checked:raw.checked!==false,items:[]};
    current.checked=current.checked&&raw.checked!==false;
    const source=Array.isArray(raw.items)&&raw.items.length?raw.items:(raw.productId?[{productId:raw.productId,quantity:raw.quantity}]:[]);
    current.items.push(...source.map(x=>normalizePlannerItemV164(x,defaultId)).filter(x=>x.productId));
    grouped.set(raw.date,current);
  }
  return grouped;
}
function plannerRowsV150(){
  return[...document.querySelectorAll('.v150-day')].map(row=>({
    row,
    date:row.dataset.date,
    check:row.querySelector('.v150-day-check'),
    items:[...row.querySelectorAll('.v164-day-item')].map(item=>({
      row:item,
      product:item.querySelector('.v150-day-product'),
      qty:item.querySelector('.v150-day-qty')
    }))
  }));
}
function plannerDayV164(day){return plannerRowsV150().find(x=>x.date===day)}
function plannerItemHtmlV164(day,item,index){
  return `<div class="v164-day-item" data-item-index="${index}"><select class="fi v150-day-product" aria-label="Produto de ${dateLabelV150(day)}" onchange="refreshOrderAvailabilityV150()">${optionsProductsV150(item.productId)}</select><input class="fi v150-day-qty" type="number" min="1" max="10" value="${item.quantity}" aria-label="Quantidade" oninput="refreshOrderAvailabilityV150()" onchange="refreshOrderAvailabilityV150(true)"><button class="v164-remove-item" type="button" aria-label="Remover produto" title="Remover produto" onclick="removePlannerItemV164('${day}',this)">×</button></div>`;
}
function renderPlannerDayItemsV164(day,items){
  const host=document.querySelector(`.v150-day[data-date="${day}"] .v164-day-items`);if(!host)return;
  const list=(items||[]).map(x=>normalizePlannerItemV164(x,orderProductsV150()[0]?.id||'')).filter(x=>x.productId);
  host.innerHTML=list.length?list.map((item,index)=>plannerItemHtmlV164(day,item,index)).join(''):'<div class="v164-day-empty">Nenhum produto neste dia.</div>';
}
function addPlannerItemV164(day){
  const target=plannerDayV164(day),items=(target?.items||[]).map(x=>({productId:x.product?.value||'',quantity:Number(x.qty?.value||1)})),products=orderProductsV150();
  if(!products.length)return appMessage('Não há produtos disponíveis.');
  items.push({productId:products.find(x=>x.id==='salgado')?.id||products[0].id,quantity:1});
  renderPlannerDayItemsV164(day,items);refreshOrderAvailabilityV150(true);
}
function removePlannerItemV164(day,button){
  const target=plannerDayV164(day),index=[...button.closest('.v164-day-items').querySelectorAll('.v164-day-item')].indexOf(button.closest('.v164-day-item'));
  const items=(target?.items||[]).map(x=>({productId:x.product?.value||'',quantity:Number(x.qty?.value||1)}));
  if(index>=0)items.splice(index,1);
  renderPlannerDayItemsV164(day,items);refreshOrderAvailabilityV150(true);
}
function copyDayCompositionV164(day){
  const source=plannerDayV164(day),items=(source?.items||[]).map(x=>({productId:x.product?.value||'',quantity:Number(x.qty?.value||1)})).filter(x=>x.productId);
  if(!items.length)return appMessage('Adicione ao menos um produto antes de copiar a composição.');
  plannerRowsV150().filter(x=>x.check?.checked).forEach(x=>renderPlannerDayItemsV164(x.date,items));
  refreshOrderAvailabilityV150(true);toast('Composição aplicada aos dias marcados.');
}
function orderPlannerSelectionV1523(){
  const grouped=new Map();
  for(const day of plannerRowsV150().filter(x=>x.check?.checked)){
    for(const item of day.items){
      const productId=item.product?.value||'',product=productById(productId);if(!productId||!product)continue;
      const quantity=Math.min(10,Math.max(1,Math.round(Number(item.qty?.value||1)))),key=`${day.date}__${productId}`,unitPrice=productPrice(product),current=grouped.get(key);
      if(current){current.quantity+=quantity;current.totalCentavos=current.unitPriceCentavos*current.quantity;}
      else grouped.set(key,{date:day.date,productId,productName:product.nome||'Produto',quantity,unitPriceCentavos:unitPrice,totalCentavos:unitPrice*quantity});
    }
  }
  const items=[...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.productName.localeCompare(b.productName)),dates=[...new Set(items.map(x=>x.date))];
  return{items,dates,deliveryCount:dates.length,itemCount:items.length,total:items.reduce((sum,x)=>sum+x.totalCentavos,0)};
}
function saveOrderDraftV1523(){
  const rows=plannerRowsV150().map(x=>({date:x.date,checked:Boolean(x.check?.checked),items:x.items.map(item=>({productId:item.product?.value||'',quantity:Math.min(10,Math.max(1,Math.round(Number(item.qty?.value||1))))})).filter(item=>item.productId)}));
  state.v1523OrderDraft={mode:state.v150OrderMode,periodValue:currentPeriodValueV1523(),rows};return state.v1523OrderDraft;
}
function updatePlannerDaySubtotalV164(day){
  const target=plannerDayV164(day),host=document.querySelector(`.v150-day[data-date="${day}"] .v164-day-subtotal`);if(!host)return;
  const total=(target?.items||[]).reduce((sum,item)=>{const product=productById(item.product?.value),qty=Math.min(10,Math.max(1,Number(item.qty?.value||1)));return sum+productPrice(product)*qty},0);
  host.textContent=fmt(total);
}
function updateOrderTotalV150(){
  const selection=orderPlannerSelectionV1523(),host=$('#v150OrderTotal');saveOrderDraftV1523();plannerRowsV150().forEach(x=>updatePlannerDaySubtotalV164(x.date));
  if(host)host.innerHTML=`<div class="v1523-order-total-line"><strong>${selection.deliveryCount} entrega(s) · ${selection.itemCount} item(ns)</strong><strong>${fmt(selection.total)}</strong></div><div class="v165-planner-mini-list">${selection.items.slice(0,8).map(x=>`<span>${datePtV151(x.date)} · ${x.quantity}× ${esc(x.productName)}</span>`).join('')}${selection.items.length>8?`<span>+ ${selection.items.length-8} item(ns)</span>`:''}</div><div class="v1523-order-total-note"><span>O uso do saldo será escolhido na revisão.</span>${infoButton('Uso do saldo','O saldo positivo não é usado automaticamente. Na revisão, você decide se quer utilizá-lo para reduzir o pagamento.')}</div>`;
  return selection;
}
window.updateOrderTotalV150=updateOrderTotalV150;
let availabilityTimerV1523=null,availabilityRequestV1523=0;
const availabilityCacheV1523=new Map();
async function availabilityForDateV1523(day){const cached=availabilityCacheV1523.get(day);if(cached&&Date.now()-cached.at<30000)return cached.info;const snap=await db.collection('disponibilidade_salgados').doc(day).get(),info=dailyAvailabilityV150(snap.exists?snap.data():{},day);availabilityCacheV1523.set(day,{at:Date.now(),info});return info}
async function runAvailabilityRefreshV1523(){
  const request=++availabilityRequestV1523,rows=plannerRowsV150();
  await Promise.all(rows.map(async x=>{const target=x.row.querySelector('.v150-availability');if(!target)return;try{const info=await availabilityForDateV1523(x.date);if(request!==availabilityRequestV1523)return;x.row.dataset.saleActive=info.active?'1':'0';if(!info.active){x.check.checked=false;x.check.disabled=true;target.className='v150-availability err';target.textContent='Sem venda de lanche';updateOrderTotalV150();return}x.check.disabled=false;if(!x.check.checked){target.className='v150-availability';target.textContent='Dia não selecionado';return}if(!x.items.length){target.className='v150-availability err';target.textContent='Adicione um produto';return}const q=x.items.reduce((sum,item)=>sum+productSalgadoQtyV150(item.product?.value,Math.min(10,Math.max(1,Number(item.qty?.value||1)))),0);if(!q){target.className='v150-availability ok';target.textContent='Venda ativa · itens disponíveis';return}target.className=`v150-availability ${info.available>=q?'ok':info.available>0?'warn':'err'}`;const base=info.received!=null?`${info.received} recebidos`:`${info.planned} planejados`;target.textContent=info.available>=q?`${base} · ${info.available} disponível(is)`:info.available>0?`${base} · precisa de ${q}; só ${info.available} disponível(is)`:`${base} · sem disponibilidade`;}catch(e){target.className='v150-availability warn';target.textContent='Validação final na reserva';}}));
}
function refreshOrderAvailabilityV150(immediate=false){updateOrderTotalV150();clearTimeout(availabilityTimerV1523);availabilityTimerV1523=setTimeout(runAvailabilityRefreshV1523,immediate?0:250)}
window.refreshOrderAvailabilityV150=refreshOrderAvailabilityV150;
function renderOrderPlannerV1523(dates,draftRows=[]){
  const products=orderProductsV150();if(!products.length)throw new Error('Não há produtos disponíveis no portal.');const defaultId=products.find(x=>x.id==='combo_suco')?.id||products[0].id,drafts=normalizePlannerDraftRowsV164(draftRows,defaultId);state.v150OrderDates=dates;
  const days=`<div class="v150-planner">${dates.map(key=>{const draft=drafts.get(key)||{checked:true,items:[{productId:defaultId,quantity:1}]},items=draft.items?.length?draft.items:[{productId:defaultId,quantity:1}];return`<div class="v150-day v164-day" data-date="${key}"><div class="v164-day-head"><label class="v164-day-check-label"><input class="v150-day-check" type="checkbox" ${draft.checked!==false?'checked':''} onchange="refreshOrderAvailabilityV150()"><span class="v150-date"><strong>${dateLabelV150(key)}</strong><small>${key}</small></span></label><div class="v150-availability">Consultando...</div></div><div class="v164-day-items">${items.map((item,index)=>plannerItemHtmlV164(key,normalizePlannerItemV164(item,defaultId),index)).join('')}</div><div class="v164-day-actions"><button class="btn btn-light" type="button" onclick="addPlannerItemV164('${key}')">+ Adicionar produto</button><button class="btn btn-outline" type="button" onclick="copyDayCompositionV164('${key}')">Aplicar aos dias marcados</button><strong class="v164-day-subtotal">${fmt(0)}</strong></div></div>`}).join('')}</div>`;
  const mixed=state.v151OrderContext==='mixed_sale';
  $('#v150OrderPlanner').innerHTML=`<div class="v1523-planner-tools"><div class="v1523-compact-help"><strong>Monte o lanche de cada dia</strong><span>Adicione quantos produtos quiser e copie uma composição para os outros dias marcados.</span></div><div class="actions"><button class="btn btn-outline" onclick="toggleAllOrderDaysV150(true)">Marcar todos</button><button class="btn btn-outline" onclick="toggleAllOrderDaysV150(false)">Desmarcar todos</button></div></div><div class="v165-planner-layout"><div class="v165-planner-main">${days}</div><aside class="v165-planner-cart"><div class="card-title">${mixed?'Adicionar ao carrinho':'Resumo do pedido'}</div><div id="v150OrderTotal" class="v1523-order-total"></div><div id="v1523PlannerStatus" aria-live="polite"></div><button id="v1523ReviewOrderBtn" class="btn btn-primary" style="width:100%;margin-top:10px" onclick="reviewParentOrderV150()">${mixed?'Adicionar ao carrinho':'Revisar pedido'}</button></aside></div>`;
  refreshOrderAvailabilityV150(true);
}
function buildOrderPlannerV150(){try{const dates=plannerDatesV150();if(!dates.length)throw new Error('Não há datas disponíveis nesse período.');renderOrderPlannerV1523(dates,[])}catch(e){const host=$('#v150OrderPlanner');if(host)host.innerHTML=`<div class="alert danger">${esc(e.message||'Não foi possível montar o pedido.')}</div>`}}
window.buildOrderPlannerV150=buildOrderPlannerV150;
function restoreOrderPlannerV1523(){const draft=state.v1523OrderDraft;if(!draft)return buildOrderPlannerV150();const input=document.getElementById(periodInputIdV1523(draft.mode));if(input&&draft.periodValue)input.value=draft.periodValue;const dates=[...new Set((draft.rows||[]).map(x=>x.date).filter(Boolean))];try{renderOrderPlannerV1523(dates.length?dates:plannerDatesV150(),draft.rows||[])}catch(e){buildOrderPlannerV150()}}
function returnToOrderPlannerV1523(){const draft=state.v1523OrderDraft;openParentOrderV150(draft?.mode||state.v150OrderMode,true)}
window.returnToOrderPlannerV1523=returnToOrderPlannerV1523;
function applyBulkOrderV150(){const source=plannerRowsV150().find(x=>x.check?.checked);if(source)copyDayCompositionV164(source.date)}
function toggleAllOrderDaysV150(value){plannerRowsV150().forEach(x=>{if(!x.check.disabled)x.check.checked=value});refreshOrderAvailabilityV150(true)}
window.applyBulkOrderV150=applyBulkOrderV150;window.toggleAllOrderDaysV150=toggleAllOrderDaysV150;window.addPlannerItemV164=addPlannerItemV164;window.removePlannerItemV164=removePlannerItemV164;window.copyDayCompositionV164=copyDayCompositionV164;
window.PiagetOrderPlanner={getSelection:orderPlannerSelectionV1523,saveDraft:saveOrderDraftV1523,restore:returnToOrderPlannerV1523,refresh:refreshOrderAvailabilityV150};

async function getAgendaDataV150(day){
  /* A agenda precisa ser completa para a data selecionada. Pendências antigas são buscadas
     pela condição operacional (pendente_entrega), nunca por uma janela arbitrária do histórico.
     O consumo avulso do dia é buscado junto (uma consulta só, por data) para cruzar com a
     programação sem depender de um clique — o aviso de duplicidade fica visível na própria lista. */
  const [rows,stockSnap,pendingRows,avulsoSnap]=await Promise.all([
    collectExactV221(db.collection('ocorrencias_entrega').where('dataChave','==',day)),
    db.collection('disponibilidade_salgados').doc(day).get(),
    collectExactV221(db.collection('ocorrencias_entrega').where('status','==','pendente_entrega')),
    db.collection('vendas').where('dataChave','==',day).get().catch(()=>({docs:[]}))
  ]);
  const previous=pendingRows.filter(x=>String(x.dataChave||'')<dateKey());
  const avulsos=avulsoSnap.docs.map(d=>({id:d.id,...d.data()})).filter(v=>String(v.origem||'').toLowerCase()==='cantina'&&!String(v.status||'').toLowerCase().includes('cancel'));
  return{rows,stock:stockSnap.exists?stockSnap.data():{},previous,avulsos};
}
async function renderEntregasV150(){const el=$('#mainContent');if(!el)return;el.innerHTML=pageHeader('Agenda da cantina','Obrigações de entrega por data e turno.')+'<div class="empty">Carregando agenda...</div>';try{const day=state.v150AgendaDate||dateKey(),data=await getAgendaDataV150(day),info=dailyAvailabilityV150(data.stock);const visible=data.rows.filter(x=>state.v150AgendaTurn==='todos'||(x.turno||state.students.find(a=>a.id===x.alunoId)?.turno||'manha')===state.v150AgendaTurn).sort((a,b)=>(a.turno||'').localeCompare(b.turno||'')||(a.turma||'').localeCompare(b.turma||'')||(a.alunoNome||'').localeCompare(b.alunoNome||''));const pending=visible.filter(x=>!V150_FINAL_STATUSES.includes(x.status)).length;const byStudent=new Map();visible.forEach(o=>{const k=o.alunoId||o.id;if(!byStudent.has(k))byStudent.set(k,[]);byStudent.get(k).push(o)});const avulsoByStudent=new Map();(data.avulsos||[]).forEach(v=>{if(!v.alunoId)return;if(!avulsoByStudent.has(v.alunoId))avulsoByStudent.set(v.alunoId,[]);avulsoByStudent.get(v.alunoId).push(v)});const cardsHtml=[...byStudent.entries()].map(([alunoId,occList])=>studentDayCardV150(alunoId,occList,avulsoByStudent.get(alunoId)||[])).join('');el.innerHTML=pageHeader('Agenda da cantina','Lista de entregas confirmadas. Sem divisão obrigatória por recreio.',`<div class="v150-agenda-toolbar"><button class="btn btn-outline" onclick="moveAgendaDayV150(-1)">‹</button><input id="v150AgendaDate" class="fi" type="date" value="${day}" onchange="setAgendaDayV150(this.value)"><button class="btn btn-outline" onclick="moveAgendaDayV150(1)">›</button></div>`)+`${data.previous.length?`<div class="v150-pending-banner"><div><strong>${data.previous.length} pendência(s) de dias anteriores</strong><div class="muted" style="font-size:12px">Há pedidos que ainda precisam receber uma situação final.</div></div><button class="btn btn-orange" onclick="openPreviousPendingV150()">Ver pendências</button></div>`:''}<div class="grid g4"><div class="kpi"><div class="kpi-label">Planejados</div><div class="kpi-value">${info.planned}</div></div><div class="kpi orange"><div class="kpi-label">Pedidos confirmados</div><div class="kpi-value">${info.confirmed}</div><div class="kpi-sub">Salgados já comprometidos</div></div><div class="kpi green"><div class="kpi-label">Disponíveis agora</div><div class="kpi-value">${info.available}</div></div><div class="kpi red"><div class="kpi-label">Entregas pendentes</div><div class="kpi-value">${pending}</div></div></div><div class="card" style="margin-top:14px"><div class="card-head"><div><div class="card-title">Obrigações de ${dateFromKeyV150(day).toLocaleDateString('pt-BR')}</div><div class="muted" style="font-size:12px">${byStudent.size} aluno(s) · ${visible.length} pedido(s) no filtro atual</div></div><div class="v150-segment"><button class="${state.v150AgendaTurn==='todos'?'active':''}" onclick="setAgendaTurnV150('todos')">Todos</button><button class="${state.v150AgendaTurn==='manha'?'active':''}" onclick="setAgendaTurnV150('manha')">Manhã</button><button class="${state.v150AgendaTurn==='tarde'?'active':''}" onclick="setAgendaTurnV150('tarde')">Tarde</button></div></div><div class="card-body">${cardsHtml||'<div class="empty">Nenhuma obrigação confirmada para esta data.</div>'}</div></div><div class="actions" style="margin-top:12px"><button class="btn btn-light" onclick="closeCantinaDayV150()">Encerrar atendimento da data</button></div>`;state.v150PreviousPending=data.previous}catch(e){el.innerHTML=pageHeader('Agenda da cantina','Não foi possível carregar as obrigações de entrega.')+`<div class="alert danger">${esc(e?.message||'Falha ao consultar a agenda.')}</div><button class="btn btn-outline" onclick="renderEntregasV150()">Tentar novamente</button>`}}
window.renderEntregas=renderEntregas=renderEntregasV150;
function studentDayCardV150(alunoId,occList,avulsoList){
  const student=state.students.find(a=>a.id===alunoId)||{},first=occList[0]||{},turno=first.turno||student.turno||'manha',turma=first.turma||student.turma||'-',nome=student.nome||first.alunoNome||avulsoList[0]?.alunoNome||'-';
  const occTotal=occList.reduce((s,o)=>s+Number(o.valorCentavos||0),0),avulsoTotal=avulsoList.reduce((s,v)=>s+Number(v.valorBrutoCentavos||0),0),conflict=occList.length>0&&avulsoList.length>0;
  const occRows=occList.map(o=>{const pending=!V150_FINAL_STATUSES.includes(o.status),items=(o.itens||[]).map(x=>`${x.quantidade}× ${esc(x.nome)}`).join(', ')||'Lanche programado';return `<div class="v150-item-row"><div><strong>${items}</strong><span class="v150-item-origin">Programação · ${fmt(o.valorCentavos||0)}</span>${o.motivoNaoEntrega?`<div class="v150-status-note">${esc(o.motivoNaoEntrega)}</div>`:''}${o.corrigidoEm?`<div class="v150-status-note">Corrigido por ${esc(o.corrigidoPorNome||'-')} em ${humanDate(o.corrigidoEm)}</div>`:''}</div><span class="badge ${badgeClassV150(o.status)}">${esc(statusLabelV150(o.status))}</span><div class="actions">${pending?`<button class="btn btn-green" onclick="confirmOccurrenceStatusV221('${o.id}','entregue','${alunoId}','${o.dataChave}')">Entregue</button><button class="btn btn-outline" onclick="confirmOccurrenceStatusV221('${o.id}','aluno_ausente','${alunoId}','${o.dataChave}')">Ausente</button><button class="btn btn-red" onclick="confirmOccurrenceStatusV221('${o.id}','nao_entregue','${alunoId}','${o.dataChave}')">Não entregue</button>`:`<button class="btn btn-outline" onclick="openCorrectOccurrenceV150('${o.id}')">Corrigir</button>`}</div></div>`}).join('');
  const avulsoRows=avulsoList.map(v=>`<div class="v150-item-row"><div><strong>${(v.itens||[]).map(x=>`${x.quantidade}× ${esc(x.nome)}`).join(', ')||'Consumo avulso'}</strong><span class="v150-item-origin">Consumo avulso · ${fmt(v.valorBrutoCentavos||0)}${v.criadoEm?` · ${humanDate(v.criadoEm)}`:''}</span></div></div>`).join('');
  return `<div class="v150-student-day-card${conflict?' v150-conflict':''}"><div class="v150-student-day-head"><div><strong>${esc(nome)}</strong><span>${esc(turma)} · ${turno==='tarde'?'Tarde':'Manhã'}</span></div><strong class="v150-day-total">${fmt(occTotal+avulsoTotal)}</strong></div>${conflict?`<div class="v150-conflict-note">⚠️ Este aluno tem programação de lanche <strong>e</strong> consumo avulso hoje — confira se não é a mesma refeição antes de confirmar a entrega.</div>`:''}${occRows}${avulsoRows}</div>`;
}
function setAgendaDayV150(day){state.v150AgendaDate=day;renderEntregasV150()}function moveAgendaDayV150(n){state.v150AgendaDate=addDaysV150(state.v150AgendaDate||dateKey(),n);renderEntregasV150()}function setAgendaTurnV150(turn){state.v150AgendaTurn=turn;renderEntregasV150()}
window.setAgendaDayV150=setAgendaDayV150;window.moveAgendaDayV150=moveAgendaDayV150;window.setAgendaTurnV150=setAgendaTurnV150;
function openPreviousPendingV150(){const rows=state.v150PreviousPending||[];openModal('Pendências anteriores',rows.length?`<div class="v150-order-list">${rows.sort((a,b)=>a.dataChave.localeCompare(b.dataChave)).map(o=>`<div class="v150-order-row"><div><strong>${esc(o.alunoNome)}</strong><div class="muted">${dateLabelV150(o.dataChave)} · ${esc(o.turma||'')} · ${(o.itens||[]).map(x=>`${x.quantidade}× ${esc(x.nome)}`).join(', ')}</div></div><button class="btn btn-primary" onclick="closeModal();setAgendaDayV150('${o.dataChave}')">Abrir data</button></div>`).join('')}</div>`:'<div class="empty">Sem pendências.</div>')}
window.openPreviousPendingV150=openPreviousPendingV150;
async function setOccurrenceV150(id,status,reason=''){if(!['entregue','aluno_ausente','nao_entregue'].includes(status))return;const ref=db.collection('ocorrencias_entrega').doc(id);try{let pedidoId='',alunoId='',alunoNome='';await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)throw new Error('Pedido não encontrado.');const o={id:s.id,...s.data()};pedidoId=o.pedidoId||'';alunoId=o.alunoId||'';alunoNome=o.alunoNome||'';if(V150_FINAL_STATUSES.includes(o.status))throw new Error('Este pedido já recebeu uma situação final.');const now=nowIso(),actor=state.user||{id:'cantina',nome:'Operador da cantina',perfil:'cantina'};if(status==='entregue'){tx.set(ref,{status:'entregue',entregueEm:now,alteradoPorId:actor.id,alteradoPorNome:actor.nome,atualizadoEm:now},{merge:true});return}const accRef=financialAccountRefV167(o.alunoId),stockRef=db.collection('disponibilidade_salgados').doc(o.dataChave),accSnap=await tx.get(accRef),stockSnap=await tx.get(stockRef),acc=accSnap.exists?accSnap.data():{},stock=stockSnap.exists?stockSnap.data():{},value=Number(o.valorCentavos||(o.itens||[]).reduce((sum,x)=>sum+Number(x.totalCentavos||x.quantidade*x.precoUnitarioCentavos||0),0)),before=netV150(acc),after=before+value,q=Number(o.quantidadeSalgados||(o.componentes||[]).filter(x=>x.produtoId==='salgado').reduce((sum,x)=>sum+Number(x.quantidade||0),0)),move=db.collection('movimentos_conta').doc();tx.set(accRef,{...splitV150(after),bloqueioSaldoSemanal:after<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:after<0&&Number(acc.limiteFiadoCentavos||0)>0&&Math.abs(after)>=Number(acc.limiteFiadoCentavos||0),atualizadoEm:now},{merge:true});tx.set(move,{id:move.id,alunoId:o.alunoId,tipo:'credito',subtipo:status==='aluno_ausente'?'credito_ausencia':'credito_nao_entrega',valorCentavos:value,saldoAntesCentavos:before,saldoDepoisCentavos:after,pedidoId:o.pedidoId,ocorrenciaId:id,origem:'pedido_pago_nao_entregue',usuarioId:actor.id,usuarioNome:actor.nome,dataChave:o.dataChave,criadoEm:now,motivo:reason||status});tx.set(stockRef,{pedidosConfirmados:Math.max(0,Number(stock.pedidosConfirmados||0)-q),liberadoPorAusencia:Number(stock.liberadoPorAusencia||0)+q,atualizadoEm:now},{merge:true});tx.set(ref,{status,motivoNaoEntrega:reason||(status==='aluno_ausente'?'Aluno ausente':'Não entregue'),creditadoCentavos:value,finalizadoEm:now,alteradoPorId:actor.id,alteradoPorNome:actor.nome,atualizadoEm:now},{merge:true})});await audit('ocorrencia_'+status,{ocorrenciaId:id,pedidoId,alunoId,alunoNome,usuarioId:state.user?.id,usuarioNome:state.user?.nome,motivo:reason});await syncOrderStatusV150(pedidoId);try{const current=await ref.get(),o=current.exists?current.data():{};await createNotificationV134({tipo:status==='entregue'?'pedido_entregue':'pedido_nao_entregue',titulo:status==='entregue'?'Lanche entregue':'Entrega não realizada',mensagem:status==='entregue'?`A entrega de ${dateLabelV150(o.dataChave)} foi confirmada.`:`A entrega de ${dateLabelV150(o.dataChave)} não foi realizada e o valor retornou para a conta.`,prioridade:'normal',alunoId:o.alunoId,alunoNome:o.alunoNome,turma:o.turma||null,pedidoId:o.pedidoId,ocorrenciaId:id,origem:(state.user?.perfil||'cantina'),canal:(state.user?.perfil||'cantina'),destinatariosAlunos:[o.alunoId],destinatariosPerfis:['cantina','secretaria','gestao','admin'],acaoPrincipal:'abrir_pedido'})}catch(e){console.warn('notificacao entrega',e)}toast(status==='entregue'?'Entrega confirmada.':'Valor devolvido como crédito e salgado liberado.');if(state.currentPage==='pedidos'&&window.renderPedidosV166)window.renderPedidosV166({refresh:true});else renderEntregasV150()}catch(e){appMessage(e.message)}}
window.setOccurrenceV150=setOccurrenceV150;window.setOccurrence=setOccurrenceV150;
function openNotDeliveredV150(id){openModal('Registrar não entrega',`<div class="fg"><label>Motivo</label><select id="v150NoDeliveryReason" class="fi"><option value="Produto indisponível">Produto indisponível</option><option value="Aluno não localizado">Aluno não localizado</option><option value="Erro no pedido">Erro no pedido</option><option value="Cancelamento da escola">Cancelamento da escola</option><option value="Outro motivo">Outro motivo</option></select></div><div class="fg"><label>Observação</label><input id="v150NoDeliveryObs" class="fi" placeholder="Detalhe opcional"></div><div class="alert">O valor desta entrega voltará para a conta do aluno e o salgado será liberado.</div><button class="btn btn-red" style="width:100%;margin-top:12px" onclick="confirmNotDeliveredV150('${id}')">Confirmar não entrega</button>`)}
function confirmNotDeliveredV150(id){const r=$('#v150NoDeliveryReason').value,obs=$('#v150NoDeliveryObs').value.trim(),reason=obs?`${r}: ${obs}`:r;closeModal();setOccurrenceV150(id,'nao_entregue',reason)}
window.openNotDeliveredV150=openNotDeliveredV150;window.confirmNotDeliveredV150=confirmNotDeliveredV150;
/* Consumo avulso e programação de lanche não se falam — antes de finalizar uma situação
   de entrega, avisa se este aluno já tem consumo avulso lançado no mesmo dia, pra evitar
   contar a mesma refeição duas vezes. Falha na checagem nunca bloqueia a ação normal. */
async function confirmOccurrenceStatusV221(id,status,alunoId,day){
  try{
    const {avulsos}=await window.sameDayCantinaEventsV221(alunoId,day);
    if(avulsos.length){
      const resumo=window.cantinaEventItemsSummaryV221(avulsos),total=avulsos.reduce((s,v)=>s+Number(v.valorBrutoCentavos||0),0);
      const ok=await appConfirm(`Este aluno já tem consumo avulso lançado hoje na cantina: ${resumo} (${fmt(total)}). Confirme que esta entrega programada é realmente separada, e não o mesmo lanche sendo contado duas vezes.`,{title:'Possível lançamento em duplicidade',confirmLabel:'Confirmar mesmo assim',cancelLabel:'Cancelar',danger:true});
      if(!ok)return;
    }
  }catch(e){}
  if(status==='nao_entregue')return openNotDeliveredV150(id);
  return setOccurrenceV150(id,status);
}
window.confirmOccurrenceStatusV221=confirmOccurrenceStatusV221;
/* Correção direta de entrega já finalizada — sem fila de aprovação. Quem percebe o
   erro corrige na hora, com justificativa obrigatória; a auditoria é quem garante o
   controle (não um bloqueio esperando outra pessoa aprovar). */
function correctionStatusLabelV150(s){return({entregue:'Entregue',aluno_ausente:'Aluno ausente',nao_entregue:'Não entregue'})[s]||statusLabelV150(s)}
function occurrenceEffectV150(status,value){return ['aluno_ausente','nao_entregue'].includes(status)?value:0}
function occurrenceStockReleaseV150(status,q){return ['aluno_ausente','nao_entregue'].includes(status)?q:0}
async function openCorrectOccurrenceV150(id){
  const snap=await db.collection('ocorrencias_entrega').doc(id).get();if(!snap.exists)return appMessage('Pedido não encontrado.');
  const o={id:snap.id,...snap.data()},options=['entregue','nao_entregue','aluno_ausente'].filter(s=>s!==o.status);
  openModal('Corrigir entrega',`<div class="alert">Situação atual: <strong>${esc(statusLabelV150(o.status))}</strong>. A correção é aplicada na hora, sem fila de aprovação, e fica registrada na Auditoria com seu nome, a data e a justificativa abaixo.</div><div class="v162-detail-grid" style="margin:12px 0"><div><small>Aluno</small><strong>${esc(o.alunoNome||'-')}</strong></div><div><small>Itens</small><strong>${(o.itens||[]).map(x=>`${x.quantidade}× ${esc(x.nome)}`).join(', ')||'-'}</strong></div><div><small>Valor</small><strong>${fmt(o.valorCentavos||0)}</strong></div></div><div class="fg"><label>Nova situação</label><select id="v150CorrectStatus" class="fi">${options.map(s=>`<option value="${s}">${esc(correctionStatusLabelV150(s))}</option>`).join('')}</select></div><div class="fg"><label>Justificativa <span class="muted">obrigatória</span></label><textarea id="v150CorrectReason" class="fi" rows="3" placeholder="Explique o que aconteceu e por que esta correção é necessária"></textarea></div><div id="v150CorrectStatusHost"></div><div class="actions" style="margin-top:14px"><button class="btn btn-outline" onclick="closeModal()">Voltar</button><button id="v150CorrectBtn" class="btn btn-primary" onclick="confirmCorrectOccurrenceV150('${esc(id)}')">Confirmar correção</button></div>`);
}
window.openCorrectOccurrenceV150=openCorrectOccurrenceV150;
async function confirmCorrectOccurrenceV150(id){
  const btn=$('#v150CorrectBtn'),host=$('#v150CorrectStatusHost'),newStatus=$('#v150CorrectStatus')?.value,reason=($('#v150CorrectReason')?.value||'').trim();
  if(reason.length<8){if(host)host.innerHTML='<div class="alert warn" style="margin-top:8px">Descreva a justificativa com mais detalhe (mínimo 8 caracteres).</div>';return}
  if(btn){btn.disabled=true;btn.textContent='Corrigindo...'}
  try{await correctFinalizedOccurrenceV150(id,newStatus,reason);closeModal();toast('Entrega corrigida.');if(state.currentPage==='pedidos'&&window.renderPedidosV166)window.renderPedidosV166({refresh:true});else renderEntregasV150()}
  catch(e){if(host)host.innerHTML=`<div class="alert danger" style="margin-top:8px">${esc(e.message)}</div>`;else appMessage(e.message);if(btn){btn.disabled=false;btn.textContent='Confirmar correção'}}
}
window.confirmCorrectOccurrenceV150=confirmCorrectOccurrenceV150;
async function correctFinalizedOccurrenceV150(id,newStatus,justificativa){
  if(!['entregue','aluno_ausente','nao_entregue'].includes(newStatus))throw new Error('Situação inválida.');
  const ref=db.collection('ocorrencias_entrega').doc(id);let pedidoId='',alunoId='',alunoNome='',oldStatus='',dataChave='';
  await db.runTransaction(async tx=>{
    const s=await tx.get(ref);if(!s.exists)throw new Error('Pedido não encontrado.');
    const o={id:s.id,...s.data()};oldStatus=String(o.status||'');pedidoId=o.pedidoId||'';alunoId=o.alunoId||'';alunoNome=o.alunoNome||'';dataChave=o.dataChave||'';
    if(!V150_FINAL_STATUSES.includes(oldStatus))throw new Error('Este pedido ainda está pendente — use os botões normais de entrega.');
    if(oldStatus===newStatus)throw new Error('O pedido já está nesta situação.');
    const value=Number(o.valorCentavos||(o.itens||[]).reduce((sum,x)=>sum+Number(x.totalCentavos||x.quantidade*x.precoUnitarioCentavos||0),0)),q=Number(o.quantidadeSalgados||(o.componentes||[]).filter(x=>x.produtoId==='salgado').reduce((sum,x)=>sum+Number(x.quantidade||0),0));
    const deltaValue=occurrenceEffectV150(newStatus,value)-occurrenceEffectV150(oldStatus,value),deltaStock=occurrenceStockReleaseV150(newStatus,q)-occurrenceStockReleaseV150(oldStatus,q);
    const accRef=deltaValue!==0?financialAccountRefV167(alunoId):null,stockRef=deltaStock!==0?db.collection('disponibilidade_salgados').doc(dataChave):null;
    const [accSnap,stockSnap]=await Promise.all([accRef?tx.get(accRef):Promise.resolve(null),stockRef?tx.get(stockRef):Promise.resolve(null)]);
    const now=nowIso(),actor=state.user||{id:'cantina',nome:'Operador da cantina',perfil:'cantina'},move=deltaValue!==0?db.collection('movimentos_conta').doc():null;
    if(accRef){const acc=accSnap.exists?accSnap.data():{},before=netV150(acc),after=before+deltaValue;tx.set(accRef,{...splitV150(after),bloqueioSaldoSemanal:after<0?Boolean(acc.bloqueioSaldoSemanal):false,bloqueadoPorLimite:after<0&&Number(acc.limiteFiadoCentavos||0)>0&&Math.abs(after)>=Number(acc.limiteFiadoCentavos||0),atualizadoEm:now},{merge:true});tx.set(move,{id:move.id,alunoId,tipo:deltaValue>0?'credito':'compra',subtipo:'correcao_entrega',valorCentavos:deltaValue,saldoAntesCentavos:before,saldoDepoisCentavos:after,pedidoId,ocorrenciaId:id,origem:'correcao_entrega_finalizada',usuarioId:actor.id,usuarioNome:actor.nome,usuarioPerfil:actor.perfil,justificativa,motivo:`Correção: ${statusLabelV150(oldStatus)} → ${statusLabelV150(newStatus)}`,dataChave,criadoEm:now})}
    if(stockRef){const stock=stockSnap.exists?stockSnap.data():{};tx.set(stockRef,{pedidosConfirmados:Math.max(0,Number(stock.pedidosConfirmados||0)-deltaStock),liberadoPorAusencia:Math.max(0,Number(stock.liberadoPorAusencia||0)+deltaStock),atualizadoEm:now},{merge:true})}
    const patch={status:newStatus,statusAnteriorCorrecao:oldStatus,corrigidoPorId:actor.id,corrigidoPorNome:actor.nome,corrigidoPorPerfil:actor.perfil,corrigidoEm:now,justificativaCorrecao:justificativa,atualizadoEm:now};
    if(newStatus==='entregue'){patch.entregueEm=now;patch.motivoNaoEntrega=null}else patch.motivoNaoEntrega=newStatus==='aluno_ausente'?'Aluno ausente (correção)':'Não entregue (correção)';
    tx.set(ref,patch,{merge:true});
  });
  await audit('ocorrencia_corrigida',{ocorrenciaId:id,pedidoId,alunoId,alunoNome,statusAnterior:oldStatus,statusNovo:newStatus,justificativa,usuarioId:state.user?.id,usuarioNome:state.user?.nome,usuarioPerfil:state.user?.perfil,severidade:'warning',descricaoHumana:`${state.user?.nome||'Operador'} corrigiu a entrega de ${alunoNome||'aluno'} de "${statusLabelV150(oldStatus)}" para "${statusLabelV150(newStatus)}". Justificativa: ${justificativa}`});
  await syncOrderStatusV150(pedidoId);
}
window.correctFinalizedOccurrenceV150=correctFinalizedOccurrenceV150;
async function syncOrderStatusV150(pedidoId){if(!pedidoId)return;const rows=await collectExactV221(db.collection('ocorrencias_entrega').where('pedidoId','==',pedidoId));if(rows.length&&rows.every(x=>V150_FINAL_STATUSES.includes(x.status)))await db.collection('pedidos').doc(pedidoId).set({statusPedido:'concluido',concluidoEm:nowIso(),atualizadoEm:nowIso()},{merge:true})}
async function closeCantinaDayV150(){const day=state.v150AgendaDate||dateKey(),data=await getAgendaDataV150(day),pending=data.rows.filter(x=>!V150_FINAL_STATUSES.includes(x.status));if(pending.length)return appMessage(`Ainda existem ${pending.length} pedido(s) sem situação final nesta data.`);const actor=state.user||{};await db.collection('fechamentos_cantina').doc(day).set({dataChave:day,status:'encerrado',encerradoPorId:actor.id||null,encerradoPorNome:actor.nome||'Operador da cantina',encerradoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});await audit('encerramento_cantina',{dataChave:day,usuarioId:actor.id,usuarioNome:actor.nome});toast('Atendimento da data encerrado.')}
window.closeCantinaDayV150=closeCantinaDayV150;

/* atualização de versão herdada removida pela V1.6.0-rc2.7.66 */
})();
