/* Escola Piaget — RC2.7.24
   Firestore Read Budget: carregamento preguiçoso, cache curto e consultas limitadas.
   Objetivo operacional: impedir varreduras completas repetitivas durante a rotina. */
(function(){
'use strict';
const VERSION='1.6.0-rc2.7.39';
const STUDENT_CACHE_KEY='vp_staff_students_v218';
const STUDENT_TTL=10*60*1000;
const CORE_CACHE_KEY='vp_staff_core_v218';
const CORE_TTL=2*60*1000;
const ACCOUNT_TTL=30*1000;
const DASHBOARD_TTL=45*1000;
const STUDENT_PAGES=new Set(['atendimento','entregas','consulta','alunos','pedidos','usuarios','notificacoes']);
function now(){return Date.now()}
function studentSort(a,b){return Number(a.ordemTurma||999)-Number(b.ordemTurma||999)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR')}
function readStudentCache(){try{const raw=sessionStorage.getItem(STUDENT_CACHE_KEY);if(!raw)return null;const x=JSON.parse(raw);if(!x||!Array.isArray(x.rows)||now()-Number(x.at||0)>STUDENT_TTL)return null;return x.rows}catch(_){return null}}
function writeStudentCache(rows){try{sessionStorage.setItem(STUDENT_CACHE_KEY,JSON.stringify({at:now(),rows}))}catch(_){}}
function readCoreCache(){try{const raw=sessionStorage.getItem(CORE_CACHE_KEY);if(!raw)return null;const x=JSON.parse(raw);if(!x||now()-Number(x.at||0)>CORE_TTL||x.day!==dateKey())return null;return x}catch(_){return null}}
function writeCoreCache(){try{sessionStorage.setItem(CORE_CACHE_KEY,JSON.stringify({at:now(),day:dateKey(),products:state.products||[],config:state.config||{},inventory:state.inventory||[],uniformModels:state.uniformModels||[],dailyCapacity:state.dailyCapacity||null}))}catch(_){}}
window.invalidateCoreReadCacheV218=function(){try{sessionStorage.removeItem(CORE_CACHE_KEY)}catch(_){}};
async function ensureStudentsLoadedV218(force=false){
 if(!state.user)return state.students||[];
 if(!force&&Array.isArray(state.students)&&state.students.length&&now()-Number(state.v218StudentsLoadedAt||0)<STUDENT_TTL)return state.students;
 if(!force){const cached=readStudentCache();if(cached?.length){state.students=cached;state.v218StudentsLoadedAt=now();return cached;}}
 const rows=(typeof window.allCollectionRowsV221==='function'?await window.allCollectionRowsV221('alunos',200):(await db.collection('alunos').get()).docs.map(d=>({id:d.id,...d.data()}))).sort(studentSort);
 state.students=rows;state.v218StudentsLoadedAt=now();writeStudentCache(rows);return rows;
}
window.ensureStudentsLoadedV218=ensureStudentsLoadedV218;

/* Carregamento inicial da equipe sem baixar todos os alunos.
   Referências pequenas continuam frescas; alunos só entram ao abrir um módulo que realmente precisa deles. */
window.loadCore=loadCore=async function loadCoreV218(force=false){
 // Em refresh/relogin na mesma aba, reutiliza por 2 minutos as referências quase estáticas.
 // Alterações operacionais podem chamar loadCore(true) ou invalidar o cache explicitamente.
 if(!force&&!(state.products||[]).length&&!(state.inventory||[]).length&&!(state.uniformModels||[]).length){
  const c=readCoreCache();
  if(c){
   state.products=Array.isArray(c.products)?c.products:[];
   state.config=c.config||{};
   state.inventory=Array.isArray(c.inventory)?c.inventory:[];
   state.uniformModels=Array.isArray(c.uniformModels)?c.uniformModels:[];
   state.dailyCapacity=c.dailyCapacity||{dataChave:dateKey(),quantidadePlanejada:Number(state.config?.quantidadePadraoSalgados||30),vendidoDinheiro:0,vendidoAvulso:0,consumoConta:0,pedidosConfirmados:0,reservas:{}};
   if(!Array.isArray(state.students))state.students=[];
   if(!state.students.length){const sc=readStudentCache();if(sc?.length){state.students=sc;state.v218StudentsLoadedAt=now();}}
   return;
  }
 }
 const [ps,cs,ss,ms,ds]=await Promise.all([
  db.collection('produtos').limit(200).get(),
  db.collection('configuracoes').doc('sistema').get(),
  db.collection('estoques').limit(500).get().catch(()=>({docs:[]})),
  db.collection('modelos_farda').limit(100).get().catch(()=>({docs:[]})),
  db.collection('disponibilidade_salgados').doc(dateKey()).get().catch(()=>({exists:false,data:()=>({})}))
 ]);
 state.products=ps.docs.map(d=>({id:d.id,...d.data()}));
 state.config=cs.exists?cs.data():(state.config||{});
 state.inventory=ss.docs.map(d=>({id:d.id,...d.data()}));
 state.uniformModels=ms.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.ativo!==false);
 state.dailyCapacity=ds.exists?ds.data():{dataChave:dateKey(),quantidadePlanejada:Number(state.config?.quantidadePadraoSalgados||30),vendidoDinheiro:0,vendidoAvulso:0,consumoConta:0,pedidosConfirmados:0,reservas:{}};
 writeCoreCache();
 if(!Array.isArray(state.students))state.students=[];
 if(!state.students.length){const cached=readStudentCache();if(cached?.length){state.students=cached;state.v218StudentsLoadedAt=now();}}
 if(state.config&&!state.config.v120Migrado&&typeof migrateV120Schema==='function'){await ensureStudentsLoadedV218(true);await migrateV120Schema();invalidateCoreReadCacheV218();return loadCoreV218(true)}
};

/* Cache curto das contas familiares para cards/listagens. Leituras pontuais de uma conta continuam diretas. */
const baseFinancialSnapshot=window.financialAccountsSnapshotV167;
function familyModeV219(){return Boolean(state?.config?.baseOficial2026Preparada&&state?.config?.modeloContaFinanceira==='responsavel')}
function studentFamilyKeyV219(a={}){return String(a.contaFinanceiraId||a.responsavelFinanceiroId||'')}
function linkedStudentsLocalV219(responsavelId){const rid=String(responsavelId||'');return (state.students||[]).filter(a=>a.ativo!==false&&studentFamilyKeyV219(a)===rid).sort(studentSort)}
window.financialAccountsSnapshotV167=financialAccountsSnapshotV167=async function financialAccountsSnapshotEfficientV219(force=false){
 if(!force&&state.v218AccountSnapshot&&now()-Number(state.v218AccountSnapshotAt||0)<ACCOUNT_TTL)return state.v218AccountSnapshot;
 const toDoc=row=>({id:row.id,ref:db.collection(familyModeV219()?'contas_responsaveis':'contas_alunos').doc(row.id),exists:true,data:()=>row});
 if(!familyModeV219()){
   const rows=typeof window.allCollectionRowsV221==='function'?await window.allCollectionRowsV221('contas_alunos',200):(await db.collection('contas_alunos').get()).docs.map(d=>({id:d.id,...d.data()}));
   const wrapped={docs:rows.map(toDoc),size:rows.length,empty:!rows.length};state.v218AccountSnapshot=wrapped;state.v218AccountSnapshotAt=now();return wrapped;
 }
 await ensureStudentsLoadedV218();
 const raw=typeof window.allCollectionRowsV221==='function'?await window.allCollectionRowsV221('contas_responsaveis',200):(await db.collection('contas_responsaveis').get()).docs.map(d=>({id:d.id,...d.data()}));
 const docs=raw.map(stored=>{const children=linkedStudentsLocalV219(stored.id),preferred=children.find(a=>String(a.id)===String(stored.alunoPrincipalId||''))||children[0]||null,ids=children.length?children.map(a=>a.id):(Array.isArray(stored.alunosIds)?stored.alunosIds:[]),data={...stored,responsavelId:stored.id,alunosIds:ids,alunoPrincipalId:preferred?.id||stored.alunoPrincipalId||ids[0]||null,quantidadeAlunosAtivos:children.length||Number(stored.quantidadeAlunosAtivos||ids.length||0)};return{id:data.alunoPrincipalId||stored.id,ref:db.collection('contas_responsaveis').doc(stored.id),exists:true,data:()=>data}});
 const wrapped={docs,size:docs.length,empty:!docs.length};state.v218AccountSnapshot=wrapped;state.v218AccountSnapshotAt=now();return wrapped;
};
window.financialAccountsRowsV167=financialAccountsRowsV167=async function(force=false){const s=await financialAccountsSnapshotV167(force);return s.docs.map(d=>({id:d.id,...d.data()}))};
window.invalidateAccountReadCacheV218=function(){state.v218AccountSnapshot=null;state.v218AccountSnapshotAt=0;state.v218DashboardData=null};

/* Dashboard: sem varredura de alunos e com pedidos de farda limitados aos mais recentes. */
window.renderDashboard=renderDashboard=async function renderDashboardEfficientV218(){
 const el=$('#mainContent');if(!el)return;el.innerHTML=pageHeader('Resumo do sistema','Operação atual da escola.')+'<div class="empty">Carregando indicadores...</div>';
 const today=dateKey();
 try{
  let cached=state.v218DashboardData;
  if(!cached||cached.day!==today||now()-Number(cached.at||0)>DASHBOARD_TTL){
   const [vs,os,accountsSnap,fardas]=await Promise.all([
    db.collection('vendas').where('dataChave','==',today).get(),
    db.collection('ocorrencias_entrega').where('dataChave','==',today).get(),
    financialAccountsSnapshotV167(true),
    typeof window.allCollectionRowsV221==='function'?window.allCollectionRowsV221('pedidos_farda',100):(await db.collection('pedidos_farda').get()).docs.map(d=>({id:d.id,...d.data()}))
   ]);
   cached={day:today,at:now(),sales:vs.docs.map(d=>d.data()),occ:os.docs.map(d=>d.data()),accounts:accountsSnap.docs.map(d=>d.data()),fardas};state.v218DashboardData=cached;
  }
  const sales=cached.sales||[],occ=cached.occ||[],accounts=cached.accounts||[],fardas=cached.fardas||[];
  const validSales=sales.filter(x=>!String(x.status||'').toLowerCase().includes('cancel')),gross=validSales.reduce((sum,x)=>sum+Number(x.valorBrutoCentavos||0),0),open=accounts.reduce((sum,x)=>sum+Math.max(0,-Number(x.saldoContaCentavos??(Number(x.saldoCreditoCentavos||0)-Number(x.dividaCentavos||0)))),0),blocked=accounts.filter(x=>x.bloqueioManual||x.bloqueioSaldoSemanal||x.bloqueadoPorLimite).length,pendingUniform=fardas.filter(x=>!['entregue','cancelado'].includes(String(x.statusAtendimento||''))).length;
  const stockAlerts=(state.products||[]).filter(p=>p.ativo&&!p.combo&&typeof productControlV120==='function'&&productControlV120(p)==='unitario').filter(p=>{try{const i=productAvailabilityV120(p);return i.configured===false||i.available<=3}catch(_){return false}}).length;
  el.innerHTML=pageHeader('Resumo','Modo de contingência: indicadores completos recalculados diretamente na base.',state.user?.perfil!=='cantina'?`<button class="btn btn-primary" onclick="navigate('vendas');setTimeout(()=>startSaleWizardV120?.(),120)">+ Iniciar venda</button>`:'')+`<div class="alert warn" style="margin-bottom:14px">O resumo incremental não estava disponível. A consulta completa foi liberada para preservar o funcionamento e a integridade.</div><div class="grid g4"><div class="kpi clickable" onclick="renderInsightV110('sales')"><div class="kpi-label">Vendas hoje</div><div class="kpi-value">${fmt(gross)}</div><div class="kpi-sub">${validSales.length} operações válidas${sales.length-validSales.length?` · ${sales.length-validSales.length} cancelada(s)`:''}</div><span class="kpi-arrow">›</span></div><div class="kpi orange clickable" onclick="renderInsightV110('debts')"><div class="kpi-label">Valores em aberto</div><div class="kpi-value">${fmt(open)}</div><div class="kpi-sub">${accounts.filter(x=>Number(x.dividaCentavos||0)>0||Number(x.saldoContaCentavos||0)<0).length} contas familiares</div><span class="kpi-arrow">›</span></div><div class="kpi red clickable" onclick="renderInsightV110('blocked')"><div class="kpi-label">Contas bloqueadas</div><div class="kpi-value">${blocked}</div><div class="kpi-sub">Limite, semanal ou bloqueio manual</div><span class="kpi-arrow">›</span></div><div class="kpi green clickable" onclick="renderProdutos('estoque')"><div class="kpi-label">Atenção no estoque</div><div class="kpi-value">${stockAlerts}</div><div class="kpi-sub">Baixo, zerado ou não configurado</div><span class="kpi-arrow">›</span></div></div><div class="grid g2" style="margin-top:14px"><div class="card clickable" onclick="renderInsightV110('deliveries')"><div class="card-head"><div class="card-title">Entregas de hoje</div><span class="badge b-blue">ver detalhes</span></div><div class="card-body"><div class="kpi-value">${occ.filter(x=>x.status==='programado').length}</div><span class="muted">programadas</span> · <strong>${occ.filter(x=>x.status==='entregue').length}</strong> entregues · <strong>${occ.filter(x=>['ausente','aluno_ausente'].includes(x.status)).length}</strong> ausências</div></div><div class="card clickable" onclick="navigate('pedidos');setTimeout(()=>setOrdersCategoryV166?.('fardamento'),50)"><div class="card-head"><div class="card-title">Fardas pendentes</div><span class="badge b-blue">ver pedidos</span></div><div class="card-body"><div class="kpi-value">${pendingUniform}</div><span class="muted">pedidos ainda não finalizados</span></div></div></div>`;
 }catch(e){console.warn('dashboard-contingencia-v221',e);el.innerHTML=pageHeader('Resumo','Não foi possível calcular os indicadores.')+`<div class="alert danger">${typeof esc==='function'?esc(e.message||'Falha de leitura'):(e.message||'Falha de leitura')}. <button class="btn btn-light" onclick="renderDashboard()">Tentar novamente</button></div>`}
};

/* Navegação preguiçosa: só baixa alunos ao entrar em áreas que usam busca/vínculo. */
const baseNavigateV218=window.navigate;
window.navigate=navigate=function(page){
 if(state.user&&STUDENT_PAGES.has(page)&&!(state.students||[]).length){
   const host=$('#mainContent');if(host)host.innerHTML=pageHeader('Carregando','Preparando os cadastros necessários...')+'<div class="empty">Carregando alunos...</div>';
   ensureStudentsLoadedV218().then(()=>baseNavigateV218(page)).catch(e=>appMessage(e.message||'Não foi possível carregar os alunos.'));return;
 }
 return baseNavigateV218(page);
};

/* Diagnóstico local simples para suporte: não é cobrança, apenas contagem estimada de cargas pesadas nesta aba. */
window.PIAGET_READ_BUDGET_V218={version:VERSION,studentCacheTtlMs:STUDENT_TTL,coreCacheTtlMs:CORE_TTL,accountCacheTtlMs:ACCOUNT_TTL,dashboardCacheTtlMs:DASHBOARD_TTL,maxStudentsQuery:500,maxRecentOperationalRows:150};
})();
