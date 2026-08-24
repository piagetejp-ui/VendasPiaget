const {initFirebase,json,parseBody,nowIso,admin}=require('./_utils');
const {validateFamilySession,familySessionTokenFromReq,studentsForResponsible}=require('./_family-utils');

const VERSION='1.6.0-rc2.7.35';
const ALLOWED_COLLECTIONS=new Set([
  'movimentos_conta','pagamentos_checkout','vendas','vendas_online_links',
  'pedidos','pedidos_farda','pedidos_operacionais','ocorrencias_entrega'
]);
const DEFAULT_ARRAY_FIELD={
  movimentos_conta:'alunosIds',pagamentos_checkout:'alunosIds',vendas:'alunosIds',
  vendas_online_links:'alunosIds',pedidos:'alunosIds',pedidos_farda:'alunosIds',
  pedidos_operacionais:'alunosIds',ocorrencias_entrega:null
};
const FINAL_DELIVERY=new Set(['entregue','aluno_ausente','ausente','nao_entregue','cancelado','cancelado_responsavel','remarcado','encerrado']);

function clamp(v,min,max,fallback){const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function safeArrayField(collection,value){if(value===null||value==='')return null;const v=String(value||DEFAULT_ARRAY_FIELD[collection]||'alunosIds');return ['alunosIds','destinatariosAlunos'].includes(v)?v:DEFAULT_ARRAY_FIELD[collection]}
function stamp(row,field='criadoEm'){return String(row?.[field]||row?.atualizadoEm||row?.pagoEm||row?.criadoEm||row?.dataChave||'')}
function jsonSafe(value){
  if(value==null||typeof value!=='object')return value;
  if(typeof value.toDate==='function'){try{return value.toDate().toISOString()}catch(_){}}
  if(Array.isArray(value))return value.map(jsonSafe);
  const out={};for(const [k,v] of Object.entries(value))out[k]=jsonSafe(v);return out;
}
function toRow(doc,collection){return jsonSafe({id:doc.id,...(doc.data()||{}),_collection:collection})}
function ownsRow(row,responsavelId,studentIds,arrayField='alunosIds'){
  const ids=new Set((studentIds||[]).map(String));
  if(String(row?.responsavelFinanceiroId||'')===String(responsavelId))return true;
  if(String(row?.responsavelId||'')===String(responsavelId))return true;
  if(ids.has(String(row?.alunoId||'')))return true;
  if(Array.isArray(row?.alunosIds)&&row.alunosIds.some(id=>ids.has(String(id))))return true;
  if(arrayField&&Array.isArray(row?.[arrayField])&&row[arrayField].some(id=>ids.has(String(id))))return true;
  return false;
}
async function queryRows(q,collection){const s=await q.get();return s.docs.map(d=>toRow(d,collection))}
async function collectFamilyRecords(db,collection,responsavelId,studentIds,{arrayField=DEFAULT_ARRAY_FIELD[collection]}={}){
  if(!ALLOWED_COLLECTIONS.has(collection))throw Object.assign(new Error('Coleção não permitida para o Meu Piaget.'),{status:400});
  arrayField=safeArrayField(collection,arrayField);
  const col=db.collection(collection),jobs=[];
  jobs.push(queryRows(col.where('responsavelFinanceiroId','==',responsavelId),collection));
  jobs.push(queryRows(col.where('responsavelId','==',responsavelId),collection));
  for(const id of studentIds){
    jobs.push(queryRows(col.where('alunoId','==',id),collection));
    if(arrayField)jobs.push(queryRows(col.where(arrayField,'array-contains',id),collection));
  }
  const packs=await Promise.all(jobs),seen=new Map();
  for(const row of packs.flat())if(ownsRow(row,responsavelId,studentIds,arrayField))seen.set(row.id,row);
  return [...seen.values()];
}
function notificationVisible(row,responsavelId,studentIds){
  const ids=new Set(studentIds.map(String));
  if(String(row?.responsavelFinanceiroId||'')===String(responsavelId)||String(row?.responsavelId||'')===String(responsavelId))return true;
  if(ids.has(String(row?.alunoId||'')))return true;
  if(Array.isArray(row?.destinatariosAlunos)&&row.destinatariosAlunos.some(id=>ids.has(String(id))))return true;
  return false;
}
async function collectNotifications(db,responsavelId,studentIds){
  const col=db.collection('notificacoes'),jobs=[];
  jobs.push(queryRows(col.where('responsavelFinanceiroId','==',responsavelId),'notificacoes'));
  jobs.push(queryRows(col.where('responsavelId','==',responsavelId),'notificacoes'));
  for(const id of studentIds){
    jobs.push(queryRows(col.where('destinatariosAlunos','array-contains',id),'notificacoes'));
    jobs.push(queryRows(col.where('alunoId','==',id),'notificacoes'));
  }
  const seen=new Map();for(const row of (await Promise.all(jobs)).flat())if(notificationVisible(row,responsavelId,studentIds))seen.set(row.id,row);
  return [...seen.values()].sort((a,b)=>stamp(b).localeCompare(stamp(a)));
}
async function familyContext(db,req){
  const session=await validateFamilySession(db,familySessionTokenFromReq(req));
  if(!session)throw Object.assign(new Error('Sessão encerrada. Entre novamente no Meu Piaget.'),{status:401});
  const students=await studentsForResponsible(db,session.responsavelId),studentIds=students.map(a=>String(a.id));
  return{session,responsavelId:String(session.responsavelId),students,studentIds};
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  const db=initFirebase(),b=parseBody(req),action=String(b.acao||'');
  try{
    const ctx=await familyContext(db,req),{responsavelId,studentIds}=ctx;
    if(action==='query_records'){
      const collection=String(b.collection||''),mode=String(b.mode||'compact'),arrayField=safeArrayField(collection,b.arrayField===undefined?DEFAULT_ARRAY_FIELD[collection]:b.arrayField),orderField=String(b.orderField||'criadoEm').slice(0,60),limit=clamp(b.limit,1,300,80);
      let rows=await collectFamilyRecords(db,collection,responsavelId,studentIds,{arrayField});
      rows.sort((a,c)=>stamp(c,orderField).localeCompare(stamp(a,orderField)));
      if(mode!=='full')rows=rows.slice(0,limit);
      return json(res,200,{ok:true,version:VERSION,collection,rows,totalRetornado:rows.length});
    }
    if(action==='history'){
      const collection=String(b.collection||''),arrayField=safeArrayField(collection,b.arrayField===undefined?DEFAULT_ARRAY_FIELD[collection]:b.arrayField),orderField=String(b.orderField||'criadoEm').slice(0,60),pageSize=clamp(b.pageSize,1,100,30),offset=clamp(b.offset,0,1000000,0);
      let rows=await collectFamilyRecords(db,collection,responsavelId,studentIds,{arrayField});
      rows.sort((a,c)=>stamp(c,orderField).localeCompare(stamp(a,orderField)));
      const page=rows.slice(offset,offset+pageSize),nextOffset=offset+page.length,done=nextOffset>=rows.length;
      return json(res,200,{ok:true,version:VERSION,collection,rows:page,total:rows.length,offset,nextOffset,done});
    }
    if(action==='notifications'){
      const limit=clamp(b.limit,1,200,80),rows=(await collectNotifications(db,responsavelId,studentIds)).slice(0,limit);
      return json(res,200,{ok:true,version:VERSION,rows});
    }
    if(action==='notification'){
      const id=String(b.id||'').trim();if(!id)return json(res,400,{ok:false,error:'Notificação não informada.'});
      const snap=await db.collection('notificacoes').doc(id).get();if(!snap.exists)return json(res,404,{ok:false,error:'Notificação não encontrada.'});
      const row=toRow(snap,'notificacoes');if(!notificationVisible(row,responsavelId,studentIds))return json(res,403,{ok:false,error:'Esta notificação não pertence à sua família.'});
      return json(res,200,{ok:true,notification:row});
    }
    if(action==='mark_notification_read'){
      const id=String(b.id||'').trim();if(!id)return json(res,400,{ok:false,error:'Notificação não informada.'});
      const ref=db.collection('notificacoes').doc(id),snap=await ref.get();if(!snap.exists)return json(res,404,{ok:false,error:'Notificação não encontrada.'});
      const row=toRow(snap,'notificacoes');if(!notificationVisible(row,responsavelId,studentIds))return json(res,403,{ok:false,error:'Esta notificação não pertence à sua família.'});
      const actor=`responsavel:${responsavelId}`;await ref.set({lidoPor:admin.firestore.FieldValue.arrayUnion(actor),lidoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});
      return json(res,200,{ok:true,id});
    }
    if(action==='mark_all_notifications_read'){
      const actor=`responsavel:${responsavelId}`,rows=(await collectNotifications(db,responsavelId,studentIds)).slice(0,200),batch=db.batch(),now=nowIso();
      for(const row of rows)batch.set(db.collection('notificacoes').doc(row.id),{lidoPor:admin.firestore.FieldValue.arrayUnion(actor),lidoEm:now,atualizadoEm:now},{merge:true});
      if(rows.length)await batch.commit();
      return json(res,200,{ok:true,quantidade:rows.length});
    }
    if(action==='programs'){
      const today=String(b.today||new Date().toISOString().slice(0,10)).slice(0,10);
      const [allOcc,allOrders]=await Promise.all([
        collectFamilyRecords(db,'ocorrencias_entrega',responsavelId,studentIds,{arrayField:null}),
        collectFamilyRecords(db,'pedidos',responsavelId,studentIds,{arrayField:'alunosIds'})
      ]);
      const activeOrderIds=new Set(allOcc.filter(x=>String(x.dataChave||'')>=today&&!FINAL_DELIVERY.has(String(x.status||''))&&x.pedidoId).map(x=>String(x.pedidoId)));
      const orders=allOrders.filter(x=>activeOrderIds.has(String(x.id))&&String(x.tipoPedido||'cantina')==='cantina');
      const validIds=new Set(orders.map(x=>String(x.id))),occ=allOcc.filter(x=>validIds.has(String(x.pedidoId||''))).sort((a,c)=>String(a.dataChave||'').localeCompare(String(c.dataChave||'')));
      return json(res,200,{ok:true,version:VERSION,orders,occ});
    }
    return json(res,400,{ok:false,error:'Ação inválida.'});
  }catch(e){console.error('family-data',e);return json(res,e.status||500,{ok:false,error:e.message||'Não foi possível carregar os dados da família.'})}
};

module.exports.__test={collectFamilyRecords,collectNotifications,notificationVisible,ownsRow,safeArrayField};
