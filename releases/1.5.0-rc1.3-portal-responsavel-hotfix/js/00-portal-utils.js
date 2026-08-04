/* Escola Piaget — utilitários compartilhados do portal RC1.3 */
(()=>{
'use strict';
const FINAL=new Set(['entregue','aluno_ausente','ausente','nao_entregue','cancelado','cancelado_responsavel','encerrado']);
const REFUND=new Set(['aluno_ausente','ausente','nao_entregue','cancelado_responsavel']);
function dateFromKey(key){return new Date(`${String(key||'').slice(0,10)}T12:00:00`)}
function addDays(key,days){const d=dateFromKey(key);if(Number.isNaN(d.getTime()))return String(key||'');d.setDate(d.getDate()+Number(days||0));const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function normalizeDays(order={}){return (Array.isArray(order.dias)?order.dias:[]).filter(x=>x&&x.dataChave).slice().sort((a,b)=>String(a.dataChave).localeCompare(String(b.dataChave)))}
function orderPeriod(order={},formatDate=(v)=>v,fallback=()=>'-'){
 const days=normalizeDays(order);if(days.length){const a=days[0].dataChave,b=days[days.length-1].dataChave;return a===b?formatDate(a):`${formatDate(a)} a ${formatDate(b)}`}
 return fallback(order.criadoEm)
}
function latestByDate(rows=[]){const map=new Map();for(const row of rows){if(!row?.dataChave||row.status==='remarcado')continue;const prev=map.get(row.dataChave),stamp=String(row.atualizadoEm||row.criadoEm||row.finalizadoEm||'');if(!prev||stamp>=String(prev.atualizadoEm||prev.criadoEm||prev.finalizadoEm||''))map.set(row.dataChave,row)}return map}
function aggregateOrder(order={},occ=[],statusLabel=(v)=>String(v||'-')){
 if(order.tipoPedido==='farda'){
  const done=['entregue','cancelado'].includes(order.statusAtendimento),label=statusLabel(order.statusAtendimento||order.statusPagamento);
  return {label,done,finalized:done?1:0,total:1,refunds:0};
 }
 const days=normalizeDays(order),byDate=latestByDate(occ),keys=days.length?days.map(x=>x.dataChave):[...byDate.keys()].sort();
 const selected=keys.map(k=>byDate.get(k)).filter(Boolean),total=keys.length||selected.length;
 const finalized=selected.filter(x=>FINAL.has(String(x.status||''))).length,refunds=selected.filter(x=>REFUND.has(String(x.status||''))).length;
 let label=statusLabel(order.statusPedido||order.statusPagamento);
 if(total&&finalized===total)label=refunds?'Concluído com devoluções':'Concluído';else if(finalized>0)label='Em andamento';else if(order.statusPedido==='confirmado')label='Programado';
 return {label,done:total>0&&finalized===total,finalized,total,refunds};
}
window.PiagetPortalUtils=Object.freeze({addDays,orderPeriod,aggregateOrder,normalizeDays,FINAL,REFUND});
})();
