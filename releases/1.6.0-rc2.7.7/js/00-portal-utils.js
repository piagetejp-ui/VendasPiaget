/* Escola Piaget — utilitários compartilhados do portal RC1.4 */
(()=>{
'use strict';
const FINAL=new Set(['entregue','aluno_ausente','ausente','nao_entregue','cancelado','cancelado_responsavel','remarcado','encerrado']);
const REFUND=new Set(['aluno_ausente','ausente','nao_entregue','cancelado_responsavel']);
const CANCELLED=new Set(['cancelado','cancelado_responsavel']);
const PAYMENT_PAID=new Set(['pago','pago_com_saldo','confirmado','aplicado']);
const PAYMENT_PENDING=new Set(['preparando_link','aguardando_pagamento','reservado']);
const PAYMENT_FAILED=new Set(['nao_concluido','cancelado_reserva','erro_gerar_link','erro_sem_url','descartado_responsavel','substituido_nova_cobranca','confirmacao_ignorada_valor_devolvido']);
function dateFromKey(key){return new Date(`${String(key||'').slice(0,10)}T12:00:00`)}
function addDays(key,days){const d=dateFromKey(key);if(Number.isNaN(d.getTime()))return String(key||'');d.setDate(d.getDate()+Number(days||0));const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function normalizeDays(order={}){return (Array.isArray(order.dias)?order.dias:[]).filter(x=>x&&x.dataChave).slice().sort((a,b)=>String(a.dataChave).localeCompare(String(b.dataChave)))}
function orderPeriod(order={},formatDate=(v)=>v,fallback=()=>'-'){
 const days=normalizeDays(order);if(days.length){const a=days[0].dataChave,b=days[days.length-1].dataChave;return a===b?formatDate(a):`${formatDate(a)} a ${formatDate(b)}`}
 return fallback(order.criadoEm)
}
function latestByDate(rows=[]){const map=new Map();for(const row of rows){if(!row?.dataChave||row.status==='remarcado')continue;const prev=map.get(row.dataChave),stamp=String(row.atualizadoEm||row.criadoEm||row.finalizadoEm||'');if(!prev||stamp>=String(prev.atualizadoEm||prev.criadoEm||prev.finalizadoEm||''))map.set(row.dataChave,row)}return map}
function resolveUniform(order={},statusLabel=(v)=>String(v||'-')){
 const payment=String(order.statusPagamento||'').toLowerCase(),service=String(order.statusAtendimento||'').toLowerCase();
 const paid=PAYMENT_PAID.has(payment);
 if(service==='entregue')return{code:'entregue',label:'Entregue',done:true,finalized:1,total:1,refunds:0,delivered:1,pending:0,cancelled:0,summary:'Pedido entregue'};
 if(!paid&&(PAYMENT_FAILED.has(payment)||service==='cancelado'))return{code:'nao_concluido',label:'Pagamento não concluído',done:true,finalized:1,total:1,refunds:0,delivered:0,pending:0,cancelled:1,summary:'Pedido encerrado sem pagamento'};
 if(!paid&&(PAYMENT_PENDING.has(payment)||service==='aguardando_pagamento'))return{code:'aguardando_pagamento',label:'Aguardando pagamento',done:false,finalized:0,total:1,refunds:0,delivered:0,pending:1,cancelled:0,summary:'Pagamento pendente'};
 if(service==='cancelado')return{code:'cancelado',label:'Cancelado',done:true,finalized:1,total:1,refunds:0,delivered:0,pending:0,cancelled:1,summary:'Pedido cancelado'};
 const map={reservado_estoque:['reservado_estoque','Reservado em estoque'],aguardando_producao:['aguardando_producao','Aguardando produção'],enviado_fabrica:['enviado_fabrica','Enviado para a fábrica'],em_producao:['em_producao','Em produção'],pronto_retirada:['pronto_retirada','Pronto para retirada']};
 if(map[service])return{code:map[service][0],label:map[service][1],done:false,finalized:0,total:1,refunds:0,delivered:0,pending:1,cancelled:0,summary:`Pagamento confirmado · ${map[service][1].toLowerCase()}`};
 const code=service||payment||'confirmado';return{code,label:statusLabel(code),done:false,finalized:0,total:1,refunds:0,delivered:0,pending:1,cancelled:0,summary:statusLabel(code)};
}
function aggregateOrder(order={},occ=[],statusLabel=(v)=>String(v||'-')){
 if(order.tipoPedido==='farda')return resolveUniform(order,statusLabel);
 const payment=String(order.statusPagamento||'').toLowerCase(),orderStatus=String(order.statusPedido||'').toLowerCase();
 const paid=PAYMENT_PAID.has(payment)||orderStatus==='confirmado'||orderStatus==='concluido';
 if(!paid&&PAYMENT_FAILED.has(payment))return{code:'nao_concluido',label:'Pagamento não concluído',done:true,finalized:0,total:normalizeDays(order).length,refunds:0,delivered:0,pending:0,cancelled:normalizeDays(order).length,summary:'Pedido encerrado sem pagamento'};
 if(!paid&&(PAYMENT_PENDING.has(payment)||['aguardando_pagamento','reservado'].includes(orderStatus)))return{code:'aguardando_pagamento',label:'Aguardando pagamento',done:false,finalized:0,total:normalizeDays(order).length,refunds:0,delivered:0,pending:normalizeDays(order).length,cancelled:0,summary:'Pagamento pendente'};
 if(['cancelado','cancelado_reserva'].includes(orderStatus)&&!paid)return{code:'nao_concluido',label:'Pagamento não concluído',done:true,finalized:0,total:normalizeDays(order).length,refunds:0,delivered:0,pending:0,cancelled:normalizeDays(order).length,summary:'Pedido encerrado sem pagamento'};
 const days=normalizeDays(order),byDate=latestByDate(occ),keys=days.length?days.map(x=>x.dataChave):[...byDate.keys()].sort();
 const selected=keys.map(k=>byDate.get(k)).filter(Boolean),total=keys.length||selected.length;
 const finalized=selected.filter(x=>FINAL.has(String(x.status||''))).length;
 const refunds=selected.filter(x=>REFUND.has(String(x.status||''))).length;
 const delivered=selected.filter(x=>String(x.status||'')==='entregue').length;
 const cancelled=selected.filter(x=>CANCELLED.has(String(x.status||''))).length;
 const pending=Math.max(0,total-finalized);
 if(total&&cancelled===total)return{code:'cancelado',label:'Cancelado',done:true,finalized,total,refunds,delivered,pending,cancelled,summary:'Todas as entregas foram canceladas'};
 if(total&&finalized===total){
   if(refunds>0)return{code:'concluido_devolucoes',label:'Concluído com devoluções',done:true,finalized,total,refunds,delivered,pending,cancelled,summary:`${delivered} entregue(s) · ${refunds} com valor devolvido`};
   return{code:'concluido',label:'Concluído',done:true,finalized,total,refunds,delivered,pending,cancelled,summary:`${delivered||total} entrega(s) concluída(s)`};
 }
 if(finalized>0)return{code:'em_andamento',label:'Em andamento',done:false,finalized,total,refunds,delivered,pending,cancelled,summary:`${finalized} de ${total} entrega(s) finalizada(s)`};
 if(orderStatus==='revisao')return{code:'revisao',label:'Em revisão',done:false,finalized,total,refunds,delivered,pending,cancelled,summary:'Pedido aguardando revisão da escola'};
 if(paid||['confirmado','reservado'].includes(orderStatus))return{code:'pedido_confirmado',label:'Pedido confirmado — aguardando entrega',done:false,finalized,total,refunds,delivered,pending:total||1,cancelled,summary:`${total||1} entrega(s) programada(s), aguardando entrega`};
 const code=orderStatus||payment||'confirmado';return{code,label:statusLabel(code),done:false,finalized,total,refunds,delivered,pending:total,cancelled,summary:statusLabel(code)};
}

const _externalScriptLoadsV175={};
function loadExternalScriptV175(src,key){
  const k=String(key||src);if(_externalScriptLoadsV175[k])return _externalScriptLoadsV175[k];
  _externalScriptLoadsV175[k]=new Promise((resolve,reject)=>{const existing=[...document.scripts].find(x=>x.src===src);if(existing){if(existing.dataset.piagetLoaded==='1'||existing.readyState==='complete')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('Não foi possível carregar o recurso necessário.')),{once:true});return}const el=document.createElement('script');el.src=src;el.async=true;el.crossOrigin='anonymous';el.dataset.piagetDynamic='1';el.onload=()=>{el.dataset.piagetLoaded='1';resolve()};el.onerror=()=>reject(new Error('Não foi possível carregar o recurso necessário.'));document.head.appendChild(el)});
  return _externalScriptLoadsV175[k];
}
async function ensureJsPdfV175(){
  if(window.jspdf?.jsPDF)return window.jspdf;
  await loadExternalScriptV175('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','jspdf');
  if(!window.jspdf?.jsPDF)throw new Error('Não foi possível preparar o PDF. Tente novamente.');
  return window.jspdf;
}
window.ensureJsPdfV175=ensureJsPdfV175;

window.PiagetPortalUtils=Object.freeze({addDays,orderPeriod,aggregateOrder,normalizeDays,latestByDate,FINAL,REFUND,CANCELLED,PAYMENT_PAID,PAYMENT_PENDING,PAYMENT_FAILED});
})();
