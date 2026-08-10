/* Escola Piaget — RC2.7.20
   Escala/Firestore: blocos sob demanda, dashboard materializado, auditoria paginada e telemetria não bloqueante.
   IMPORTANTE: metas de leitura são critérios de engenharia. Não existe hard cap em runtime. */
(function(){
'use strict';
const VERSION='1.6.0-rc2.7.20';
const STAFF_COMMERCE_TTL=5*60*1000,FAMILY_COMMERCE_TTL=10*60*1000,DASHBOARD_TTL=45*1000,AUDIT_PAGE=50;
const STAFF_COMMERCE_PAGES=new Set(['atendimento','vendas','produtos','config']);
const DIAG_KEY='vp_read_diag_v220';
function now(){return Date.now()}
function recordRead(name,count,meta={}){try{const rows=JSON.parse(sessionStorage.getItem(DIAG_KEY)||'[]');rows.push({at:new Date().toISOString(),name,count:Number(count||0),...meta});while(rows.length>80)rows.shift();sessionStorage.setItem(DIAG_KEY,JSON.stringify(rows))}catch(_){} }
window.PIAGET_READ_BUDGET_V220={version:VERSION,noRuntimeCap:true,targets:{loginHome:30,operationalScreen:50,dashboard:50,detailInitial:50},diagnostics:()=>{try{return JSON.parse(sessionStorage.getItem(DIAG_KEY)||'[]')}catch(_){return[]}}};

async function staffToken(){const u=typeof authObjV130==='function'?authObjV130()?.currentUser:null;if(!u)throw new Error('Entre novamente no acesso da equipe.');return u.getIdToken()}
async function staffApi(data){const token=await staffToken(),r=await fetch('/api/resumo-operacional',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(data)}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Não foi possível atualizar os indicadores.');return j}

/* ---------- Núcleo leve da equipe ---------- */
const fullLoadCore=window.loadCore;
async function loadLightCore(){
 const [cfg,day]=await Promise.all([db.collection('configuracoes').doc('sistema').get(),db.collection('disponibilidade_salgados').doc(dateKey()).get().catch(()=>({exists:false,data:()=>({})}))]);
 state.config=cfg.exists?cfg.data():(state.config||{});state.dailyCapacity=day.exists?day.data():{dataChave:dateKey(),quantidadePlanejada:Number(state.config?.quantidadePadraoSalgados||30),reservas:{}};
 state.products=state.products||[];state.inventory=state.inventory||[];state.uniformModels=state.uniformModels||[];state.catalogCategories=state.catalogCategories||[];state.catalogItems=state.catalogItems||[];
 recordRead('staff_core_light',2,{page:state.currentPage||'boot'});
}
async function ensureStaffCommerce(force=false){
 if(!state.user)return;
 if(!force&&state.v220StaffCommerceLoaded&&now()-Number(state.v220StaffCommerceLoadedAt||0)<STAFF_COMMERCE_TTL)return;
 await fullLoadCore(true);
 const [cats,items]=await Promise.all([db.collection('catalogo_categorias').limit(150).get().catch(()=>({docs:[]})),db.collection('catalogo_itens').limit(400).get().catch(()=>({docs:[]}))]);
 state.catalogCategories=cats.docs.map(d=>({id:d.id,...d.data()}));state.catalogItems=items.docs.map(d=>({id:d.id,...d.data()}));state.v220StaffCommerceLoaded=true;state.v220StaffCommerceLoadedAt=now();recordRead('staff_commerce_block',(state.products||[]).length+(state.inventory||[]).length+(state.uniformModels||[]).length+cats.docs.length+items.docs.length,{force});
}
window.ensureStaffCommerceV220=ensureStaffCommerce;
window.loadCore=loadCore=async function loadCoreV220(force=false){
 if(force||STAFF_COMMERCE_PAGES.has(String(state.currentPage||'')))return ensureStaffCommerce(true);
 return loadLightCore();
};

/* ---------- Dashboard: resumo familiar incremental + somente dados operacionais do dia ---------- */
const dashboardFallback=window.renderDashboard;
async function renderDashboardV220(){
 const host=$('#mainContent');if(!host)return;host.innerHTML=pageHeader('Resumo','Atualizando os indicadores da operação...')+'<div class="empty">Carregando resumo...</div>';
 try{
  const day=dateKey();let d=state.v220Dashboard;
  if(!d||d.date!==day||now()-Number(d._at||0)>DASHBOARD_TTL){d=await staffApi({acao:'dashboard',dataChave:day});d._at=now();state.v220Dashboard=d;recordRead('dashboard',d.diagnostics?.estimatedDocumentReads||0,{accountReads:d.diagnostics?.accountReads||0,changedAccounts:d.accounts?.contasAlteradas||0})}
  const a=d.accounts||{},s=d.sales||{},o=d.deliveries||{},u=d.uniforms||{},stock=d.stock||{},diag=d.diagnostics||{},fresh=a.atualizadoEm?humanDate(a.atualizadoEm):'agora';
  host.innerHTML=pageHeader('Resumo','Indicadores completos com consulta incremental das contas.',state.user?.perfil!=='cantina'?`<button class="btn btn-primary" onclick="navigate('vendas');setTimeout(()=>startSaleWizardV120?.(),120)">+ Iniciar venda</button>`:'')+
  `<div class="grid g4"><div class="kpi clickable" onclick="renderInsightV110('sales')"><div class="kpi-label">Vendas hoje</div><div class="kpi-value">${fmt(s.valorCentavos||0)}</div><div class="kpi-sub">${Number(s.quantidade||0)} operações</div><span class="kpi-arrow">›</span></div><div class="kpi orange clickable" onclick="renderInsightV110('debts')"><div class="kpi-label">Valores em aberto</div><div class="kpi-value">${fmt(a.saldoEmAbertoCentavos||0)}</div><div class="kpi-sub">${Number(a.familiasPendentes||0)} contas familiares</div><span class="kpi-arrow">›</span></div><div class="kpi red clickable" onclick="renderInsightV110('blocked')"><div class="kpi-label">Contas bloqueadas</div><div class="kpi-value">${Number(a.familiasBloqueadas||0)}</div><div class="kpi-sub">indicador consolidado</div><span class="kpi-arrow">›</span></div><div class="kpi green clickable" onclick="navigate('produtos')"><div class="kpi-label">Atenção no estoque</div><div class="kpi-value">${Number(stock.atencao||0)}</div><div class="kpi-sub">baixo, zerado ou não configurado</div><span class="kpi-arrow">›</span></div></div>`+
  `<div class="grid g2" style="margin-top:14px"><div class="card clickable" onclick="renderInsightV110('deliveries')"><div class="card-head"><div class="card-title">Entregas de hoje</div><span class="badge b-blue">ver detalhes</span></div><div class="card-body"><div class="kpi-value">${Number(o.programadas||0)}</div><span class="muted">programadas</span> · <strong>${Number(o.entregues||0)}</strong> entregues · <strong>${Number(o.ausencias||0)}</strong> ausências</div></div><div class="card clickable" onclick="navigate('pedidos');setTimeout(()=>setOrdersCategoryV166?.('fardamento'),50)"><div class="card-head"><div class="card-title">Fardas pendentes</div><span class="badge b-blue">ver pedidos</span></div><div class="card-body"><div class="kpi-value">${Number(u.pendentes||0)}</div><span class="muted">pedidos ainda não finalizados</span></div></div></div>`+
  `<div class="alert" style="margin-top:14px"><strong>Resumo atualizado ${esc(fresh)}.</strong> ${Number(a.contasAlteradas||0)?`${Number(a.contasAlteradas)} conta(s) alterada(s) foram reconciliadas; as demais não precisaram ser relidas.`:'Nenhuma conta familiar mudou desde a última consolidação.'}<br><span class="muted">Diagnóstico desta carga: ~${Number(diag.estimatedDocumentReads||0)} documento(s) lido(s). Esta métrica é informativa e nunca bloqueia a operação.</span>${['admin','gestao'].includes(state.user?.perfil)?` <button class="btn btn-light" style="margin-left:8px" onclick="rebuildDashboardAccountsV220()">Reconciliar indicadores</button>`:''}</div>`;
 }catch(e){console.warn('dashboard-v220',e);recordRead('dashboard_fallback',0,{error:e.message});return dashboardFallback()}
}
window.rebuildDashboardAccountsV220=async function(){try{if(!await appConfirm('A reconciliação completa fará uma leitura deliberada das contas familiares para reconstruir os indicadores. Use apenas se houver suspeita de divergência.',{title:'Reconciliar indicadores?',confirmLabel:'Reconciliar',cancelLabel:'Cancelar'}))return;await staffApi({acao:'reconstruir_contas'});state.v220Dashboard=null;toast('Indicadores reconciliados.');renderDashboardV220()}catch(e){appMessage(e.message)}};
window.renderDashboard=renderDashboard=renderDashboardV220;

/* ---------- Navegação em blocos ---------- */
const baseNavigate=window.navigate;
window.navigate=navigate=function(page){
 if(state.user&&STAFF_COMMERCE_PAGES.has(page)&&!state.v220StaffCommerceLoaded){const host=$('#mainContent');if(host)host.innerHTML=pageHeader('Carregando','Preparando somente os dados necessários para esta área...')+'<div class="empty">Carregando os blocos desta tela...</div>';const jobs=[ensureStaffCommerce()];if(page==='atendimento'&&typeof ensureStudentsLoadedV218==='function'&&!(state.students||[]).length)jobs.push(ensureStudentsLoadedV218());Promise.all(jobs).then(()=>baseNavigate(page)).catch(e=>appMessage(e.message||'Não foi possível carregar esta área.'));return}
 return baseNavigate(page);
};

/* ---------- Meu Piaget: catálogo/estoque somente ao iniciar uma compra ---------- */
const FAMILY_CACHE_KEY='vp_family_commerce_v220';
function readFamilyCommerceCache(){try{const x=JSON.parse(sessionStorage.getItem(FAMILY_CACHE_KEY)||'null');if(!x||now()-Number(x.at||0)>FAMILY_COMMERCE_TTL)return null;return x}catch(_){return null}}
function saveFamilyCommerceCache(){try{sessionStorage.setItem(FAMILY_CACHE_KEY,JSON.stringify({at:now(),products:state.products||[],inventory:state.inventory||[],uniformModels:state.uniformModels||[],catalogCategories:state.catalogCategories||[],catalogItems:state.catalogItems||[]}))}catch(_){} }
async function ensureFamilyCommerceV220(force=false){
 if(!state.parentFamily&&!state.parentStudent)return;
 if(!force&&state.v220FamilyCommerceLoaded)return;
 if(!force){const c=readFamilyCommerceCache();if(c){state.products=c.products||[];state.inventory=c.inventory||[];state.uniformModels=c.uniformModels||[];state.catalogCategories=c.catalogCategories||[];state.catalogItems=c.catalogItems||[];state.v220FamilyCommerceLoaded=true;recordRead('family_commerce_cache',0);return}}
 const [ps,ss,ms,cs,is]=await Promise.all([db.collection('produtos').limit(200).get().catch(()=>({docs:[]})),db.collection('estoques').limit(500).get().catch(()=>({docs:[]})),db.collection('modelos_farda').limit(100).get().catch(()=>({docs:[]})),db.collection('catalogo_categorias').limit(100).get().catch(()=>({docs:[]})),db.collection('catalogo_itens').limit(300).get().catch(()=>({docs:[]}))]);
 state.products=ps.docs.map(d=>({id:d.id,...d.data()}));state.inventory=ss.docs.map(d=>({id:d.id,...d.data()}));state.uniformModels=ms.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.ativo!==false);state.catalogCategories=cs.docs.map(d=>({id:d.id,...d.data()}));state.catalogItems=is.docs.map(d=>({id:d.id,...d.data()}));state.v220FamilyCommerceLoaded=true;saveFamilyCommerceCache();recordRead('family_commerce_block',ps.docs.length+ss.docs.length+ms.docs.length+cs.docs.length+is.docs.length);
}
window.ensureFamilyCommerceV220=ensureFamilyCommerceV220;

/* Busca de alunos só quando o usuário realmente inicia uma venda. A tela de histórico usa os nomes já gravados nas operações. */
for(const name of ['startUnifiedSaleV160','startSaleWizardV120']){
 const base=window[name];
 if(typeof base==='function')window[name]=async function(...args){try{if(typeof ensureStudentsLoadedV218==='function')await ensureStudentsLoadedV218();return base.apply(this,args)}catch(e){appMessage(e.message||'Não foi possível carregar os alunos para iniciar a venda.')}};
}
for(const name of ['openParentOrderV151','openParentUniformV151']){const base=window[name];if(typeof base==='function')window[name]=async function(...args){try{await ensureFamilyCommerceV220();return base.apply(this,args)}catch(e){appMessage(e.message||'Não foi possível carregar os itens disponíveis.')}}}

/* ---------- Auditoria: persistência ilimitada; leitura em páginas de 50 ---------- */
function periodStartV220(period){const d=new Date();if(period==='hoje'){d.setHours(0,0,0,0);return d.toISOString()}if(period==='7d'){d.setDate(d.getDate()-7);return d.toISOString()}if(period==='30d'){d.setDate(d.getDate()-30);return d.toISOString()}return null}
function auditRowHtmlV220(r){const h=r._human;return `<div class="v166-audit-row" data-category="${esc(h.category||'')}" data-severity="${esc(h.severity||'info')}" data-search="${esc(normalizeSearch(`${h.title} ${h.desc} ${r.usuarioNome||''} ${r.dados?.alunoNome||''} ${r.responsavelId||''}`))}">${auditCardHtmlV134(r)}</div>`}
async function fetchAuditPageV220(reset=false){
 if(reset){state.v220AuditRows=[];state.v220AuditCursor=null;state.v220AuditDone=false}
 if(state.v220AuditDone)return;
 let q=db.collection('historico_auditoria').orderBy('criadoEm','desc'),start=periodStartV220(state.v220AuditPeriod||'30d');if(start)q=q.where('criadoEm','>=',start);if(state.v220AuditCursor)q=q.startAfter(state.v220AuditCursor);q=q.limit(AUDIT_PAGE);
 const snap=await q.get();const rows=snap.docs.map(d=>({id:d.id,...d.data()})).map(r=>({...r,_human:auditDescriptorV134(r.acao||r.acaoTecnica,r.dados||{},r)}));state.v220AuditRows=[...(state.v220AuditRows||[]),...rows];state.v220AuditCursor=snap.docs[snap.docs.length-1]||state.v220AuditCursor;state.v220AuditDone=snap.docs.length<AUDIT_PAGE;recordRead('audit_page',snap.docs.length,{period:state.v220AuditPeriod||'30d'});
}
function renderAuditBodyV220(){const rows=state.v220AuditRows||[],cats=[...new Set(rows.map(r=>r._human.category).filter(Boolean))].sort(),host=$('#mainContent');host.innerHTML=pageHeader('Auditoria','Histórico cumulativo: registros não são apagados automaticamente. A tela lê em páginas para preservar desempenho.')+`<div class="card"><div class="card-body"><div class="notif-filter-v134"><div class="fg"><label>Período</label><select id="auditPeriodV220" class="fi" onchange="setAuditPeriodV220(this.value)"><option value="hoje" ${state.v220AuditPeriod==='hoje'?'selected':''}>Hoje</option><option value="7d" ${state.v220AuditPeriod==='7d'?'selected':''}>7 dias</option><option value="30d" ${(!state.v220AuditPeriod||state.v220AuditPeriod==='30d')?'selected':''}>30 dias</option><option value="todos" ${state.v220AuditPeriod==='todos'?'selected':''}>Todo o histórico</option></select></div><div class="fg"><label>Categoria</label><select id="auditCatV134" class="fi" onchange="filterAuditV220()"><option value="">Todas</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div><div class="fg"><label>Severidade</label><select id="auditSevV134" class="fi" onchange="filterAuditV220()"><option value="">Todas</option><option value="success">Sucesso</option><option value="info">Informação</option><option value="warn">Atenção</option><option value="danger">Crítica</option></select></div><div class="fg" style="flex:1;min-width:220px"><label>Buscar nos registros carregados</label><input id="auditSearchV134" class="fi" oninput="filterAuditV220()" placeholder="Aluno, usuário, venda, responsável..."></div></div><div class="audit-list-v134" id="v220AuditList">${rows.map(auditRowHtmlV220).join('')||'<div class="empty">Sem registros neste período.</div>'}</div>${state.v220AuditDone?'':`<div style="text-align:center;margin-top:14px"><button class="btn btn-outline" onclick="loadMoreAuditV220()">Carregar mais 50</button></div>`}<div class="muted" style="margin-top:10px">${rows.length} registro(s) carregado(s) nesta consulta. O histórico armazenado pode ser maior.</div></div></div>`;filterAuditV220()}
async function renderAuditoriaV220(){state.v220AuditPeriod=state.v220AuditPeriod||'30d';try{await fetchAuditPageV220(true);renderAuditBodyV220()}catch(e){appMessage(e.message||'Não foi possível abrir a auditoria.')}}
window.loadMoreAuditV220=async function(){try{await fetchAuditPageV220(false);renderAuditBodyV220()}catch(e){appMessage(e.message)}};
window.setAuditPeriodV220=async function(v){state.v220AuditPeriod=v;await renderAuditoriaV220()};
window.filterAuditV220=function(){const q=normalizeSearch($('#auditSearchV134')?.value||''),cat=$('#auditCatV134')?.value||'',sev=$('#auditSevV134')?.value||'';document.querySelectorAll('.v166-audit-row').forEach(x=>x.style.display=(!cat||x.dataset.category===cat)&&(!sev||x.dataset.severity===sev)&&(!q||x.dataset.search.includes(q))?'':'none')};
window.renderAuditoria=renderAuditoria=renderAuditoriaV220;

/* Atualiza a navegação mais uma vez para garantir que o módulo Auditoria aponte para a versão paginada. */
const navigateAfterAudit=window.navigate;
window.navigate=navigate=function(page){if(page==='auditoria'){if(!state.user||(typeof canPageV130==='function'&&!canPageV130('auditoria')))return navigateAfterAudit(page);state.currentPage='auditoria';$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page==='auditoria'));return renderAuditoriaV220()}return navigateAfterAudit(page)};
})();
