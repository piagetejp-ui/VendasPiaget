const {admin,initFirebase,json,parseBody,nowIso}=require('./_utils');
const {verifyStaff}=require('./_family-utils');

const VERSION='1.6.0-rc2.7.24';
const PAGE=250;
const ACCOUNT_TX_CHUNK=80;
const FieldPath=admin.firestore.FieldPath;
function n(v){return Number(v||0)}
async function pageAll(q){const out=[];let cursor=null;while(true){let x=q.limit(PAGE);if(cursor)x=x.startAfter(cursor);const s=await x.get();out.push(...s.docs);if(s.docs.length<PAGE)break;cursor=s.docs[s.docs.length-1]}return out}
async function commitSets(db,ops,size=380){for(let i=0;i<ops.length;i+=size){const b=db.batch();for(const x of ops.slice(i,i+size)){if(x.delete)b.delete(x.ref);else b.set(x.ref,x.data,{merge:x.merge!==false})}await b.commit()}}
function maxIso(rows,field,fallback){let m=String(fallback||'');for(const d of rows){const v=String((d.data()||{})[field]||'');if(v>m)m=v}return m||String(fallback||nowIso())}

async function acquireLock(db){const ref=db.collection('metricas_operacionais').doc('_lock_dashboard'),owner=`${Date.now()}_${Math.random().toString(36).slice(2)}`,now=Date.now();let ok=false;await db.runTransaction(async tx=>{const s=await tx.get(ref),d=s.exists?s.data():{};if(n(d.ateMs)>now)return;tx.set(ref,{owner,ateMs:now+20000,atualizadoEm:nowIso(),versao:VERSION},{merge:true});ok=true});return {ok,owner,ref}}
async function releaseLock(lock){if(!lock?.ok)return;await lock.ref.set({ateMs:0,liberadoEm:nowIso()},{merge:true}).catch(()=>{})}

function accountVector(data={}){const net=n(data.saldoContaCentavos ?? (n(data.saldoCreditoCentavos)-n(data.dividaCentavos))),open=Math.max(0,-net);return{open,pending:open>0?1:0,blocked:(data.bloqueioManual||data.bloqueioSaldoSemanal||data.bloqueadoPorLimite)?1:0}}
async function accountPendingDocs(db){const prefix='conta_familiar__';return pageAll(db.collection('entidades_pendentes').orderBy(FieldPath.documentId()).startAt(prefix).endAt(`${prefix}\uf8ff`))}
async function initializeAccounts(db,actor){
  const docs=await pageAll(db.collection('contas_responsaveis').orderBy(FieldPath.documentId())),ops=[];let open=0,pending=0,blocked=0;
  for(const d of docs){const v=accountVector(d.data()||{});open+=v.open;pending+=v.pending;blocked+=v.blocked;ops.push({ref:db.collection('resumos_contas').doc(d.id),data:{responsavelId:d.id,...v,fonteAtualizadaEm:d.data()?.atualizadoEm||null,atualizadoEm:nowIso(),versao:VERSION}})}
  if(ops.length)await commitSets(db,ops);
  const row={saldoEmAbertoCentavos:open,familiasPendentes:pending,familiasBloqueadas:blocked,contasIndexadas:docs.length,atualizadoEm:nowIso(),modo:'reconstrucao_completa',reconstruidoPorId:actor.id||null,versao:VERSION};
  await db.collection('metricas_operacionais').doc('contas_familiares').set(row,{merge:false});
  return{...row,_reads:docs.length+1,_changed:docs.length};
}
async function syncAccountChunk(db,metricRef,chunk,actor){
  let result={reads:0,changed:0};
  await db.runTransaction(async tx=>{
    const metricSnap=await tx.get(metricRef);result.reads+=1;const cur=metricSnap.exists?metricSnap.data()||{}:{};
    const pendingSnaps=await Promise.all(chunk.map(d=>tx.get(d.ref)));result.reads+=pendingSnaps.length;
    const active=pendingSnaps.map((s,i)=>({snap:s,seed:chunk[i]})).filter(x=>x.snap.exists);
    if(!active.length)return;
    const ids=active.map(x=>String(x.snap.data()?.entidadeId||x.seed.id.replace(/^conta_familiar__/,'')));
    const accountRefs=ids.map(id=>db.collection('contas_responsaveis').doc(id)),summaryRefs=ids.map(id=>db.collection('resumos_contas').doc(id));
    const accountSnaps=await Promise.all(accountRefs.map(r=>tx.get(r))),summarySnaps=await Promise.all(summaryRefs.map(r=>tx.get(r)));result.reads+=accountSnaps.length+summarySnaps.length;
    let dOpen=0,dPending=0,dBlocked=0,dCount=0,changed=0;
    for(let i=0;i<active.length;i++){
      const old=summarySnaps[i].exists?summarySnaps[i].data()||{}:{},exists=accountSnaps[i].exists,next=exists?accountVector(accountSnaps[i].data()||{}):{open:0,pending:0,blocked:0};
      dOpen+=next.open-n(old.open);dPending+=next.pending-n(old.pending);dBlocked+=next.blocked-n(old.blocked);if(exists&&!summarySnaps[i].exists)dCount++;if(!exists&&summarySnaps[i].exists)dCount--;changed++;
    }
    for(let i=0;i<active.length;i++){
      const id=ids[i],exists=accountSnaps[i].exists,next=exists?accountVector(accountSnaps[i].data()||{}):null;
      if(exists)tx.set(summaryRefs[i],{responsavelId:id,...next,fonteAtualizadaEm:accountSnaps[i].data()?.atualizadoEm||null,atualizadoEm:nowIso(),versao:VERSION},{merge:true});else if(summarySnaps[i].exists)tx.delete(summaryRefs[i]);
      tx.delete(active[i].snap.ref);
    }
    tx.set(metricRef,{saldoEmAbertoCentavos:Math.max(0,n(cur.saldoEmAbertoCentavos)+dOpen),familiasPendentes:Math.max(0,n(cur.familiasPendentes)+dPending),familiasBloqueadas:Math.max(0,n(cur.familiasBloqueadas)+dBlocked),contasIndexadas:Math.max(0,n(cur.contasIndexadas)+dCount),atualizadoEm:nowIso(),modo:'fila_incremental',ultimaSincronizacaoPorId:actor.id||null,versao:VERSION},{merge:true});
    result.changed=changed;
  });
  return result;
}
async function syncAccounts(db,actor,{force=false}={}){
  const ref=db.collection('metricas_operacionais').doc('contas_familiares'),s=await ref.get();if(force||!s.exists)return initializeAccounts(db,actor);
  const pending=await accountPendingDocs(db);if(!pending.length)return{...(s.data()||{}),modo:'sem_alteracoes',_reads:1,_changed:0};
  let reads=1+pending.length,changed=0;
  for(let i=0;i<pending.length;i+=ACCOUNT_TX_CHUNK){const r=await syncAccountChunk(db,ref,pending.slice(i,i+ACCOUNT_TX_CHUNK),actor);reads+=r.reads;changed+=r.changed}
  const final=await ref.get();reads+=1;return{...(final.exists?final.data():{}),modo:'fila_incremental',_reads:reads,_changed:changed};
}

function stockVector(d={}){const available=n(d.quantidadeFisica)-n(d.quantidadeReservada);return{attention:(d.configurado===false||available<=3)?1:0}}
async function syncSimpleSnapshot(db,{summaryId,collection,snapshotCollection,vector,updatedField='atualizadoEm',force=false}){
  const ref=db.collection('metricas_operacionais').doc(summaryId),s=await ref.get();
  if(force||!s.exists){const docs=await pageAll(db.collection(collection).orderBy(FieldPath.documentId())),ops=[];let total=0;for(const d of docs){const v=vector(d.data()||{});total+=n(v.value??v.attention);ops.push({ref:db.collection(snapshotCollection).doc(d.id),data:{...v,fonteAtualizadaEm:d.data()?.[updatedField]||null,atualizadoEm:nowIso(),versao:VERSION}})}if(ops.length)await commitSets(db,ops);const row={valor:total,itensIndexados:docs.length,lastSyncAt:maxIso(docs,updatedField,''),atualizadoEm:nowIso(),modo:'reconstrucao_completa',versao:VERSION};await ref.set(row,{merge:false});return{...row,_reads:docs.length+1,_changed:docs.length}}
  const cur=s.data()||{};if(!cur.lastSyncAt)return syncSimpleSnapshot(db,{summaryId,collection,snapshotCollection,vector,updatedField,force:true});
  const changed=await pageAll(db.collection(collection).where(updatedField,'>',cur.lastSyncAt).orderBy(updatedField,'asc'));if(!changed.length)return{...cur,modo:'sem_alteracoes',_reads:1,_changed:0};
  const prev=[];for(let i=0;i<changed.length;i+=300)prev.push(...await db.getAll(...changed.slice(i,i+300).map(d=>db.collection(snapshotCollection).doc(d.id))));let delta=0,newCount=0,actualChanged=0;const ops=[];
  changed.forEach((doc,i)=>{const v=vector(doc.data()||{}),old=prev[i]?.exists?(prev[i].data()||{}):{},oldValue=n(old.value??old.attention),newValue=n(v.value??v.attention),source=String(doc.data()?.[updatedField]||'');if(!prev[i]?.exists)newCount++;if(!prev[i]?.exists||source!==String(old.fonteAtualizadaEm||'')||newValue!==oldValue){delta+=newValue-oldValue;actualChanged++;ops.push({ref:db.collection(snapshotCollection).doc(doc.id),data:{...v,fonteAtualizadaEm:source||null,atualizadoEm:nowIso(),versao:VERSION}})}});
  if(ops.length)await commitSets(db,ops);const patch={valor:Math.max(0,n(cur.valor)+delta),itensIndexados:n(cur.itensIndexados)+newCount,lastSyncAt:maxIso(changed,updatedField,cur.lastSyncAt),atualizadoEm:nowIso(),modo:'incremental',versao:VERSION};await ref.set(patch,{merge:true});return{...cur,...patch,_reads:1+changed.length+prev.length,_changed:actualChanged};
}
function uniformVector(d={}){return{value:['cancelado','entregue','nao_concluido'].includes(String(d.statusAtendimento||''))?0:1}}

function saleVectorV222(d={}){const cancelled=String(d.status||'').toLowerCase().includes('cancel');return{count:cancelled?0:1,value:cancelled?0:n(d.valorBrutoCentavos||d.totalCentavos)}}
async function syncDailySales(db,date,{force=false}={}){
  const ref=db.collection('metricas_diarias').doc(date),s=await ref.get(),cur=s.exists?s.data()||{}:{};
  if(force||!s.exists||!cur.salesInitialized||n(cur.salesSummaryVersion)!==2){const docs=await pageAll(db.collection('vendas').where('dataChave','==',date)),ops=[];let count=0,value=0;for(const d of docs){const v=saleVectorV222(d.data()||{});count+=v.count;value+=v.value;ops.push({ref:db.collection('resumos_vendas').doc(d.id),data:{...v,dataChave:date,fonteAtualizadaEm:d.data()?.atualizadoEm||d.data()?.criadoEm||null,status:d.data()?.status||null,atualizadoEm:nowIso(),versao:VERSION}})}if(ops.length)await commitSets(db,ops);const patch={salesInitialized:true,salesSummaryVersion:2,vendasQuantidade:count,vendasCentavos:value,lastSalesSyncAt:maxIso(docs,'atualizadoEm',maxIso(docs,'criadoEm','')),salesAtualizadoEm:nowIso(),versao:VERSION};await ref.set(patch,{merge:true});return{...patch,_reads:docs.length+1,_changed:docs.length}}
  if(!cur.lastSalesSyncAt)return syncDailySales(db,date,{force:true});
  const changed=await pageAll(db.collection('vendas').where('atualizadoEm','>',cur.lastSalesSyncAt).orderBy('atualizadoEm','asc'));if(!changed.length)return{vendasQuantidade:n(cur.vendasQuantidade),vendasCentavos:n(cur.vendasCentavos),lastSalesSyncAt:cur.lastSalesSyncAt,_reads:1,_changed:0};
  const relevant=changed.filter(d=>String(d.data()?.dataChave||'')===date),cursor=maxIso(changed,'atualizadoEm',cur.lastSalesSyncAt);if(!relevant.length){await ref.set({lastSalesSyncAt:cursor,salesAtualizadoEm:nowIso(),versao:VERSION},{merge:true});return{vendasQuantidade:n(cur.vendasQuantidade),vendasCentavos:n(cur.vendasCentavos),lastSalesSyncAt:cursor,_reads:1+changed.length,_changed:0}}
  const prev=[];for(let i=0;i<relevant.length;i+=300)prev.push(...await db.getAll(...relevant.slice(i,i+300).map(d=>db.collection('resumos_vendas').doc(d.id))));let dCount=0,dValue=0,ops=[],actualChanged=0;
  relevant.forEach((doc,i)=>{const v=saleVectorV222(doc.data()||{}),old=prev[i]?.exists?prev[i].data()||{}:{count:0,value:0},source=String(doc.data()?.atualizadoEm||doc.data()?.criadoEm||'');if(prev[i]?.exists&&source===String(old.fonteAtualizadaEm||'')&&n(v.count)===n(old.count)&&n(v.value)===n(old.value))return;actualChanged++;dCount+=n(v.count)-n(old.count);dValue+=n(v.value)-n(old.value);ops.push({ref:db.collection('resumos_vendas').doc(doc.id),data:{...v,dataChave:date,fonteAtualizadaEm:source||null,status:doc.data()?.status||null,atualizadoEm:nowIso(),versao:VERSION}})});if(ops.length)await commitSets(db,ops);
  const patch={vendasQuantidade:Math.max(0,n(cur.vendasQuantidade)+dCount),vendasCentavos:Math.max(0,n(cur.vendasCentavos)+dValue),lastSalesSyncAt:cursor,salesAtualizadoEm:nowIso(),salesSummaryVersion:2,versao:VERSION};await ref.set(patch,{merge:true});return{...patch,_reads:1+changed.length+prev.length,_changed:actualChanged};
}
function deliveryVector(d={}){const s=String(d.status||'');return{programadas:['programado','pendente_entrega'].includes(s)?1:0,entregues:s==='entregue'?1:0,ausencias:['ausente','aluno_ausente','nao_entregue'].includes(s)?1:0}}
async function syncDailyDeliveries(db,date,{force=false}={}){
  const ref=db.collection('metricas_diarias').doc(date),s=await ref.get(),cur=s.exists?s.data()||{}:{};
  if(force||!s.exists||!cur.deliveryInitialized){const docs=await pageAll(db.collection('ocorrencias_entrega').where('dataChave','==',date)),ops=[];let totals={programadas:0,entregues:0,ausencias:0};for(const d of docs){const v=deliveryVector(d.data()||{});for(const k of Object.keys(totals))totals[k]+=v[k];ops.push({ref:db.collection('resumos_ocorrencias').doc(d.id),data:{...v,dataChave:date,fonteAtualizadaEm:d.data()?.atualizadoEm||d.data()?.criadoEm||null,atualizadoEm:nowIso(),versao:VERSION}})}if(ops.length)await commitSets(db,ops);const patch={deliveryInitialized:true,...totals,lastDeliverySyncAt:maxIso(docs,'atualizadoEm',maxIso(docs,'criadoEm','')),deliveryAtualizadoEm:nowIso(),versao:VERSION};await ref.set(patch,{merge:true});return{...patch,_reads:docs.length+1,_changed:docs.length}}
  if(!cur.lastDeliverySyncAt)return syncDailyDeliveries(db,date,{force:true});
  const changed=await pageAll(db.collection('ocorrencias_entrega').where('atualizadoEm','>',cur.lastDeliverySyncAt).orderBy('atualizadoEm','asc'));if(!changed.length)return{programadas:n(cur.programadas),entregues:n(cur.entregues),ausencias:n(cur.ausencias),lastDeliverySyncAt:cur.lastDeliverySyncAt,_reads:1,_changed:0};
  const relevant=changed.filter(d=>String(d.data()?.dataChave||'')===date),cursor=maxIso(changed,'atualizadoEm',cur.lastDeliverySyncAt);if(!relevant.length){await ref.set({lastDeliverySyncAt:cursor,deliveryAtualizadoEm:nowIso(),versao:VERSION},{merge:true});return{programadas:n(cur.programadas),entregues:n(cur.entregues),ausencias:n(cur.ausencias),lastDeliverySyncAt:cursor,_reads:1+changed.length,_changed:0}}
  const prev=[];for(let i=0;i<relevant.length;i+=300)prev.push(...await db.getAll(...relevant.slice(i,i+300).map(d=>db.collection('resumos_ocorrencias').doc(d.id))));let delta={programadas:0,entregues:0,ausencias:0},ops=[],actualChanged=0;
  relevant.forEach((doc,i)=>{const v=deliveryVector(doc.data()||{}),old=prev[i]?.exists?prev[i].data()||{}:{},source=String(doc.data()?.atualizadoEm||'');const different=!prev[i]?.exists||source!==String(old.fonteAtualizadaEm||'')||Object.keys(delta).some(k=>n(v[k])!==n(old[k]));if(!different)return;actualChanged++;for(const k of Object.keys(delta))delta[k]+=n(v[k])-n(old[k]);ops.push({ref:db.collection('resumos_ocorrencias').doc(doc.id),data:{...v,dataChave:date,fonteAtualizadaEm:source||null,atualizadoEm:nowIso(),versao:VERSION}})});if(ops.length)await commitSets(db,ops);
  const patch={programadas:Math.max(0,n(cur.programadas)+delta.programadas),entregues:Math.max(0,n(cur.entregues)+delta.entregues),ausencias:Math.max(0,n(cur.ausencias)+delta.ausencias),lastDeliverySyncAt:cursor,deliveryAtualizadoEm:nowIso(),versao:VERSION};await ref.set(patch,{merge:true});return{...patch,_reads:1+changed.length+prev.length,_changed:actualChanged};
}

async function readExistingSummaries(db,date){const [a,st,u,d]=await Promise.all([db.collection('metricas_operacionais').doc('contas_familiares').get(),db.collection('metricas_operacionais').doc('estoque').get(),db.collection('metricas_operacionais').doc('fardas_pendentes').get(),db.collection('metricas_diarias').doc(date).get()]),daily=d.exists?d.data()||{}:{};return{accounts:a.exists?a.data()||{}:{},stock:st.exists?st.data()||{}:{},uniforms:u.exists?u.data()||{}:{},daily,reads:4,ready:Boolean(a.exists&&st.exists&&u.exists&&d.exists&&daily.salesInitialized&&daily.deliveryInitialized)}}
async function dashboard(db,actor,date){const lock=await acquireLock(db);let accounts,stock,uniforms,sales,deliveries,extraReads=1;try{if(lock.ok){[accounts,stock,uniforms,sales,deliveries]=await Promise.all([syncAccounts(db,actor),syncSimpleSnapshot(db,{summaryId:'estoque',collection:'estoques',snapshotCollection:'resumos_estoque',vector:stockVector}),syncSimpleSnapshot(db,{summaryId:'fardas_pendentes',collection:'pedidos_farda',snapshotCollection:'resumos_fardas',vector:uniformVector}),syncDailySales(db,date),syncDailyDeliveries(db,date)]);extraReads=0}else{const x=await readExistingSummaries(db,date);extraReads=x.reads;if(!x.ready){const err=new Error('Os indicadores ainda estão sendo inicializados por outra sessão.');err.status=503;throw err}accounts=x.accounts;stock=x.stock;uniforms=x.uniforms;sales={vendasQuantidade:n(x.daily.vendasQuantidade),vendasCentavos:n(x.daily.vendasCentavos),_reads:0,_changed:0};deliveries={programadas:n(x.daily.programadas),entregues:n(x.daily.entregues),ausencias:n(x.daily.ausencias),_reads:0,_changed:0}}}finally{await releaseLock(lock)}
  const reads=n(accounts?._reads)+n(stock?._reads)+n(uniforms?._reads)+n(sales?._reads)+n(deliveries?._reads)+extraReads;return{ok:true,version:VERSION,date,accounts:{saldoEmAbertoCentavos:n(accounts?.saldoEmAbertoCentavos),familiasPendentes:n(accounts?.familiasPendentes),familiasBloqueadas:n(accounts?.familiasBloqueadas),contasIndexadas:n(accounts?.contasIndexadas),atualizadoEm:accounts?.atualizadoEm||null,modo:accounts?.modo||null,contasAlteradas:n(accounts?._changed)},sales:{quantidade:n(sales?.vendasQuantidade),valorCentavos:n(sales?.vendasCentavos)},deliveries:{programadas:n(deliveries?.programadas),entregues:n(deliveries?.entregues),ausencias:n(deliveries?.ausencias)},uniforms:{pendentes:n(uniforms?.valor)},stock:{atencao:n(stock?.valor)},diagnostics:{estimatedDocumentReads:reads,accountReads:n(accounts?._reads),changedAccounts:n(accounts?._changed),changedStock:n(stock?._changed),changedUniforms:n(uniforms?._changed),changedSales:n(sales?._changed),changedDeliveries:n(deliveries?._changed),lockReused:!lock.ok,noRuntimeCap:true,accountStrategy:'changed_entity_queue'}}}

module.exports=async function(req,res){if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,error:'Método não permitido.'});try{const db=initFirebase(),body=req.method==='POST'?parseBody(req):{},actor=await verifyStaff(db,req,['admin','gestao','secretaria','cantina']),action=String(body.acao||req.query?.acao||'dashboard'),date=String(body.dataChave||req.query?.dataChave||new Date().toISOString().slice(0,10));if(action==='dashboard')return json(res,200,await dashboard(db,actor,date));if(action==='contas_resumo'){const accounts=await syncAccounts(db,actor);return json(res,200,{ok:true,version:VERSION,accounts:{saldoEmAbertoCentavos:n(accounts?.saldoEmAbertoCentavos),familiasPendentes:n(accounts?.familiasPendentes),familiasBloqueadas:n(accounts?.familiasBloqueadas),contasIndexadas:n(accounts?.contasIndexadas),atualizadoEm:accounts?.atualizadoEm||null,modo:accounts?.modo||null,contasAlteradas:n(accounts?._changed)},diagnostics:{estimatedDocumentReads:n(accounts?._reads),changedAccounts:n(accounts?._changed),noRuntimeCap:true,accountStrategy:'changed_entity_queue'}})}if(action==='reconstruir_contas'){if(!['admin','gestao'].includes(actor.perfil))return json(res,403,{ok:false,error:'Somente Gestão/Admin pode reconstruir os indicadores.'});const result=await syncAccounts(db,actor,{force:true});return json(res,200,{ok:true,accounts:result})}return json(res,400,{ok:false,error:'Ação inválida.'})}catch(e){console.error('resumo-operacional',e);return json(res,e.status||500,{ok:false,error:e.message||'Não foi possível atualizar os indicadores.'})}};
