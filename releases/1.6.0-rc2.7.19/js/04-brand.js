
/* =========================================================
   Escola Piaget — V1.2.2
   Escopo propositalmente restrito:
   1) uso correto do símbolo simples na interface;
   2) contraste por fundo;
   3) relatório da conta sem QR Code, com link e instruções.
   ========================================================= */
const V122_VERSION='1.2.2-dev';
const BRAND_V122={
  light:'assets/logo-piaget-icon-v152.png',
  dark:'assets/logo-piaget-icon-white-orange-v152.png',
  orange:'assets/logo-piaget-icon-blue-white-v152.png',
  black:'assets/logo-piaget-icon-white-v152.png',
  full:BRAND_V120.full
};

function applyBrandingV122(){
  /* Topbar em fundo claro: símbolo azul + laranja, com Escola Piaget digitado ao lado. */
  const logo=document.querySelector('.brand-logo');
  if(logo)logo.innerHTML=`<img src="${BRAND_V122.light}" alt="Símbolo Escola Piaget">`;
  const brandTitle=document.querySelector('.brand h1');if(brandTitle)brandTitle.textContent='Escola Piaget';
  const brandSub=document.querySelector('.brand small');if(brandSub)brandSub.textContent='Vendas, cantina e atendimento';

  /* Tela de acesso: substitui a assinatura completa pequena por símbolo simples grande + texto do próprio sistema. */
  const roleBrand=document.querySelector('#roleScreen .role-brand');
  if(roleBrand)roleBrand.innerHTML=`<div class="role-brand-v122"><img src="${BRAND_V122.light}" alt="Símbolo Escola Piaget"><div class="role-brand-v122-copy"><strong>Escola Piaget</strong><span>Vendas, cantina e atendimento</span></div></div>`;

  /* Telas de setup usam somente o símbolo simples. */
  document.querySelectorAll('.setup-brand-v120 img').forEach(img=>{img.src=BRAND_V122.light;img.alt='Símbolo Escola Piaget'});

  /* Card do aluno está em fundo azul: usa a variação branca + laranja, sem caixa branco. */
  const parentHero=document.querySelector('#parentScreen .parent-hero');
  if(parentHero){const img=parentHero.querySelector('img');if(img){img.src=BRAND_V122.dark;img.className='v122-parent-icon';img.alt='Símbolo Escola Piaget'}}

  /* Pequenos estados em fundo claro. */
  document.querySelectorAll('.v121-empty-brand img').forEach(img=>{img.src=BRAND_V122.light;img.alt='Símbolo Escola Piaget'});
}
/* inicialização herdada consolidada pela V1.5.0-dev2 */

/* O Meu Piaget é renderizado dinamicamente; reaplica a marca após cada renderização. */

/* Documento de conta: sem QR Code. O acesso passa a ser explicado e o link ganha destaque. */
window.generateReport=async function(id){
  const a=state.students.find(x=>x.id===id),acc=await getAccount(id),snap=await db.collection('movimentos_conta').where('alunoId','==',id).limit(300).get(),rows=openDebtRowsForReportV110(snap.docs.map(d=>d.data())),link=parentUrl(a);
  state.currentReportV110={type:'student',student:a,account:acc,rows,link};
  $('#reportHost').classList.remove('hidden');
  $('#reportHost').innerHTML=`<div id="reportSheet" class="wa-report wa-report-v122"><div class="wa-head-v122"><div class="wa-brand-v122"><img src="${BRAND_V122.full}" alt="Escola Piaget"><div class="wa-report-title-v122"><strong>Demonstrativo de valores em aberto</strong><span>Relatório de valores em aberto</span></div></div></div><div class="wa-student"><strong>${esc(a.nome)}</strong><div>${esc(a.turma)} · Matrícula ${esc(a.matricula)}</div><div class="muted">Emitido em ${new Date().toLocaleString('pt-BR')}</div></div><table class="wa-table"><thead><tr><th>Data</th><th>Itens</th><th style="text-align:right">Em aberto</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.data)}</td><td>${esc(r.itens)}</td><td style="text-align:right;font-weight:800">${fmt(r.valorCentavos)}</td></tr>`).join('')||'<tr><td colspan="3">Sem consumos em aberto detalhados.</td></tr>'}</tbody></table><div class="wa-total"><span>Total em aberto</span><strong>${fmt(acc.dividaCentavos)}</strong></div><div class="wa-access-v122"><h3>Como consultar a conta do aluno</h3><ol><li>Toque ou copie o link abaixo.</li><li>Abra o endereço no navegador do celular.</li><li>Na página do aluno, confira os lançamentos, o saldo e as opções disponíveis.</li></ol><span class="wa-access-link-v122">${esc(link)}</span><div class="wa-access-note-v122">Guarde este link para consultar novamente a conta deste aluno. Limite autorizado: ${fmt(acc.limiteFiadoCentavos)} · Compra sem saldo: ${acc.autorizadoSemSaldo?'Liberada':'Bloqueada'}.</div></div></div>`;
  openModal('Demonstrativo de valores em aberto',`<div class="alert">O relatório agora destaca o link de acesso à conta e traz instruções de consulta. O QR Code foi removido.</div><div class="actions" style="margin-top:14px"><button class="btn btn-primary" onclick="downloadReportPdf('${esc(a.matricula)}')">Baixar PDF A4</button><button class="btn btn-orange" onclick="downloadReportPng('${esc(a.matricula)}')">Baixar imagem</button><button class="btn btn-light" onclick="copyParentLink('${id}')">Copiar link</button></div>`)
};

window.downloadReportPdf=async function(mat){
  const r=state.currentReportV110;if(!r||r.type!=='student')return;
  const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),blue=[44,56,150],orange=[255,152,31],link=r.link;
  let y=await drawPdfBrandHeaderV121(pdf,'Demonstrativo de valores em aberto','Relatório de valores em aberto');
  pdf.setTextColor(20,24,40);pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.text(r.student.nome,15,y+4);
  pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.text(`${r.student.turma} · Matrícula ${r.student.matricula}`,15,y+10);
  pdf.setTextColor(100);pdf.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`,15,y+16);y+=26;
  const drawHead=()=>{pdf.setFillColor(238,240,248);pdf.rect(15,y,180,8,'F');pdf.setTextColor(70);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text('DATA',17,y+5.2);pdf.text('ITENS',49,y+5.2);pdf.text('EM ABERTO',172,y+5.2);y+=9};
  drawHead();pdf.setFont('helvetica','normal');pdf.setTextColor(25);
  for(const row of r.rows){
    const lines=pdf.splitTextToSize(row.itens,112),h=Math.max(8,lines.length*4.4+3);
    if(y+h>258){pdf.addPage();y=await drawPdfContinuationHeaderV121(pdf,'Demonstrativo de valores em aberto');drawHead()}
    pdf.setDrawColor(225);pdf.line(15,y+h,195,y+h);pdf.setFontSize(9);pdf.text(row.data,17,y+5);pdf.text(lines,49,y+5);pdf.setFont('helvetica','bold');pdf.text(fmt(row.valorCentavos).replace(/\u00a0/g,' '),193,y+5,{align:'right'});pdf.setFont('helvetica','normal');y+=h
  }
  if(y>225){pdf.addPage();y=await drawPdfContinuationHeaderV121(pdf,'Demonstrativo de valores em aberto')}
  pdf.setFillColor(...blue);pdf.roundedRect(15,y+4,180,18,3,3,'F');pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text('TOTAL EM ABERTO',20,y+15);pdf.setFontSize(17);pdf.text(fmt(r.account.dividaCentavos).replace(/\u00a0/g,' '),190,y+16,{align:'right'});y+=31;
  pdf.setTextColor(25);pdf.setFontSize(9);pdf.setFont('helvetica','normal');pdf.text(`Limite autorizado: ${fmt(r.account.limiteFiadoCentavos).replace(/\u00a0/g,' ')} · Compra sem saldo: ${r.account.autorizadoSemSaldo?'Liberada':'Bloqueada'}`,15,y);y+=9;

  const instructions=['1. Toque no link abaixo ou copie o endereço.','2. Abra o endereço no navegador do celular.','3. Confira os lançamentos, o saldo e as opções disponíveis na página do aluno.'];
  const boxY=y;pdf.setFillColor(247,248,254);pdf.setDrawColor(225,228,244);pdf.roundedRect(15,boxY,180,42,3,3,'FD');pdf.setFillColor(...orange);pdf.rect(15,boxY,3.5,42,'F');
  pdf.setTextColor(...blue);pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text('COMO CONSULTAR A CONTA DO ALUNO',22,boxY+8);
  pdf.setTextColor(70,76,94);pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);let iy=boxY+14;for(const line of instructions){pdf.text(line,22,iy);iy+=5}
  pdf.setTextColor(...blue);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.textWithLink('ABRIR CONTA DO ALUNO',22,boxY+34,{url:link});
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(82,88,108);pdf.text(pdf.splitTextToSize(link,105),82,boxY+33);
  pdf.save(`demonstrativo-valores-em-aberto-${mat}.pdf`)
};

/* atualização de versão herdada removida pela V1.5.0-dev2 */

/* RC2.7.11 — demonstrativo financeiro familiar padronizado. */
(()=>{
'use strict';
const nV181=v=>{const x=Number(v||0);return Number.isFinite(x)?Math.round(x):0};
const familyStudentsV181=a=>window.PiagetFamilySharedV172?.staffFamilyStudents?.(a)||[a].filter(Boolean);
async function familyMovesV181(students){
  const seen=new Map(),jobs=[];
  for(const a of students||[]){
    jobs.push(db.collection('movimentos_conta').where('alunoId','==',a.id).limit(300).get().catch(()=>({docs:[]})));
    jobs.push(db.collection('movimentos_conta').where('alunosIds','array-contains',a.id).limit(300).get().catch(()=>({docs:[]})));
  }
  for(const snap of await Promise.all(jobs))for(const d of snap.docs||[])seen.set(d.id,{id:d.id,...d.data()});
  const raw=[...seen.values()];
  return typeof window.consolidateFamilyMovementsV173==='function'?window.consolidateFamilyMovementsV173(raw):raw;
}
function impactV181(m={}){
  if(Number.isFinite(Number(m.impactoSaldoCentavos)))return Number(m.impactoSaldoCentavos);
  if(Number.isFinite(Number(m.saldoDepoisCentavos))&&Number.isFinite(Number(m.saldoAntesCentavos)))return Number(m.saldoDepoisCentavos)-Number(m.saldoAntesCentavos);
  let v=nV181(m.valorCentavos);if(v<0)return v;
  if(['compra','consumo','saida','compra_farda','venda_conta'].includes(String(m.tipo||'')))return-Math.abs(v);
  return v;
}
function chargePartsV181(m,charge){
  const items=(m.itens||[]).map(x=>{const qty=Math.max(1,nV181(x.quantidade||1)),raw=nV181(x.totalCentavos||x.subtotalCentavos||x.valorTotalCentavos||x.valorCentavos||(nV181(x.precoUnitarioCentavos||x.precoCentavos)*qty));return{alunoId:x.alunoId||m.alunoId||null,descricao:x.nome||x.descricao||'',valor:Math.max(0,raw),item:x}}).filter(x=>x.valor>0),sum=items.reduce((s,x)=>s+x.valor,0);
  if(!items.length||sum<=0)return[{movement:m,open:charge,alunoId:m.alunoId||null,descricao:''}];
  let left=charge;return items.map((x,i)=>{const amount=i===items.length-1?left:Math.min(left,Math.round(charge*x.valor/sum));left-=amount;return{movement:m,open:amount,alunoId:x.alunoId,descricao:x.descricao,item:x.item}}).filter(x=>x.open>0);
}
function openLinesV181(moves,accountOpen,students){
  const chronological=[...(moves||[])].sort((a,b)=>String(a.criadoEm||'').localeCompare(String(b.criadoEm||''))),queue=[];let pool=0;
  for(const m of chronological){const effect=impactV181(m);if(effect>0){let left=effect;for(const q of queue){if(q.open<=0)continue;const use=Math.min(left,q.open);q.open-=use;left-=use;if(left<=0)break}pool+=left}else if(effect<0){let charge=Math.abs(effect),use=Math.min(pool,charge);pool-=use;charge-=use;if(charge>0)queue.push(...chargePartsV181(m,charge))}}
  const byId=id=>(students||[]).find(a=>String(a.id)===String(id));
  let rows=queue.filter(q=>q.open>0).map(q=>{const m=q.movement,a=byId(q.alunoId||m.alunoId),desc=q.descricao||(m.descricao||String(m.subtipo||m.tipo||'Pendência').replaceAll('_',' '));return{alunoId:q.alunoId||m.alunoId||null,alunoNome:a?.nome||m.alunoNome||'Aluno',turma:a?.turma||m.turma||'',data:m.dataChave?humanDate(`${m.dataChave}T12:00:00`):humanDate(m.criadoEm),itens:`${a?.nome||m.alunoNome||'Aluno'} — ${desc}`,valorCentavos:q.open}});
  const sum=rows.reduce((s,x)=>s+nV181(x.valorCentavos),0),diff=nV181(accountOpen)-sum;
  if(diff>0)rows.push({alunoId:null,alunoNome:'Conta familiar',turma:'',data:'—',itens:'Conta familiar — Saldo anterior / ajuste da conta',valorCentavos:diff});
  if(diff<0){let reduce=Math.abs(diff);for(let i=rows.length-1;i>=0&&reduce>0;i--){const use=Math.min(reduce,rows[i].valorCentavos);rows[i].valorCentavos-=use;reduce-=use}rows=rows.filter(x=>x.valorCentavos>0)}
  return rows;
}
window.generateReport=async function(id){
  const a=(state.students||[]).find(x=>String(x.id)===String(id));if(!a)return appMessage('Aluno não encontrado.');
  const students=familyStudentsV181(a),primary=students[0]||a,acc=await getAccount(primary.id),net=Number(acc.saldoContaCentavos??(nV181(acc.saldoCreditoCentavos)-nV181(acc.dividaCentavos))),open=Math.max(0,-net),moves=await familyMovesV181(students),rows=openLinesV181(moves,open,students),link=typeof familyPublicUrlV178==='function'?familyPublicUrlV178('/'):'https://meupiaget.com.br/';
  const responsible=primary.responsavelFinanceiro||'Responsável cadastrado',familyLabel=`Família de ${responsible}`,studentText=students.map(x=>`${x.nome} (${x.turma||'-'})`).join(' · ');
  state.currentReportV110={type:'family',student:primary,students,account:acc,net,rows,link,responsible,familyLabel};
  $('#reportHost').classList.remove('hidden');
  $('#reportHost').innerHTML=`<div id="reportSheet" class="wa-report wa-report-v122"><div class="wa-head-v122"><div class="wa-brand-v122"><img src="${BRAND_V122.full}" alt="Escola Piaget"><div class="wa-report-title-v122"><strong>Demonstrativo de valores em aberto</strong><span>Conta financeira da família</span></div></div></div><div class="wa-student"><strong>${esc(familyLabel)}</strong><div>${esc(studentText||primary.nome)}</div><div class="muted">Emitido em ${new Date().toLocaleString('pt-BR')}</div></div><table class="wa-table"><thead><tr><th>Data</th><th>Descrição</th><th style="text-align:right">Em aberto</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.data)}</td><td>${esc(r.itens)}</td><td style="text-align:right;font-weight:800">${fmt(r.valorCentavos)}</td></tr>`).join('')||'<tr><td colspan="3">Sem valores em aberto detalhados.</td></tr>'}</tbody></table><div class="wa-total"><span>Total em aberto</span><strong>${fmt(open)}</strong></div><div class="wa-access-v122"><h3>Consultar e regularizar</h3><p>Confira os lançamentos, o saldo e as opções de regularização no Meu Piaget.</p><span class="wa-access-link-v122">${esc(link)}</span></div></div>`;
  openModal('Demonstrativo de valores em aberto',`<div class="alert">Documento financeiro da família, com as pendências agrupadas por aluno quando houver mais de um vínculo.</div><div class="actions" style="margin-top:14px"><button class="btn btn-primary" onclick="downloadReportPdf('${esc(primary.matricula||primary.id)}')">Baixar PDF A4</button><button class="btn btn-orange" onclick="downloadReportPng('${esc(primary.matricula||primary.id)}')">Baixar imagem</button><button class="btn btn-light" onclick="navigator.clipboard.writeText('${String(link).replace(/'/g,"\\'")}');toast('Link copiado.')">Copiar link</button></div>`);
};
window.downloadReportPdf=async function(mat){
  const r=state.currentReportV110;if(!r||!['family','student'].includes(r.type))return;const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),blue=[44,56,150],link=r.link;let y=await drawPdfBrandHeaderV121(pdf,'Demonstrativo de valores em aberto','Conta financeira da família');
  const familyLabel=r.familyLabel||`Família de ${r.student?.responsavelFinanceiro||'Responsável cadastrado'}`,students=r.students||[r.student].filter(Boolean),studentText=students.map(x=>`${x.nome} (${x.turma||'-'} · ${x.matricula||'-'})`).join(' · '),open=Math.max(0,-Number(r.net??(Number(r.account?.saldoContaCentavos??(nV181(r.account?.saldoCreditoCentavos)-nV181(r.account?.dividaCentavos))))));
  pdf.setTextColor(28,34,55);pdf.setFont('helvetica','bold');pdf.setFontSize(11.5);pdf.text(pdf.splitTextToSize(familyLabel,150),15,y+3);pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);pdf.setTextColor(92,99,120);const names=pdf.splitTextToSize(studentText,180);pdf.text(names,15,y+10);y+=Math.max(24,names.length*4.2+15);
  const drawHead=()=>{pdf.setFillColor(238,240,248);pdf.rect(15,y,180,8,'F');pdf.setTextColor(70);pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.text('DATA',17,y+5.2);pdf.text('DESCRIÇÃO',47,y+5.2);pdf.text('EM ABERTO',193,y+5.2,{align:'right'});y+=9};drawHead();
  pdf.setFont('helvetica','normal');for(const row of r.rows||[]){const lines=pdf.splitTextToSize(row.itens||'Pendência',118),h=Math.max(8,lines.length*4+3);if(y+h>260){pdf.addPage();y=await drawPdfContinuationHeaderV121(pdf,'Demonstrativo de valores em aberto');drawHead()}pdf.setTextColor(45);pdf.setFontSize(8.3);pdf.text(row.data||'—',17,y+5);pdf.text(lines,47,y+5);pdf.setFont('helvetica','bold');pdf.setTextColor(28,34,55);pdf.text(fmt(row.valorCentavos).replace(/\u00a0/g,' '),193,y+5,{align:'right'});pdf.setFont('helvetica','normal');pdf.setDrawColor(232);pdf.line(15,y+h,195,y+h);y+=h}
  if(y>226){pdf.addPage();y=await drawPdfContinuationHeaderV121(pdf,'Demonstrativo de valores em aberto')}
  pdf.setFillColor(...blue);pdf.roundedRect(15,y+4,180,18,3,3,'F');pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.text('TOTAL EM ABERTO',20,y+15);pdf.setFontSize(16);pdf.text(fmt(open).replace(/\u00a0/g,' '),190,y+16,{align:'right'});y+=31;
  pdf.setTextColor(44,56,150);pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.text('Consultar e regularizar',15,y);y+=6;pdf.setTextColor(65,70,88);pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);pdf.text(pdf.splitTextToSize('Confira os lançamentos, o saldo e as opções de regularização no Meu Piaget.',175),15,y);y+=11;pdf.setTextColor(44,56,150);pdf.setFont('helvetica','bold');pdf.textWithLink('ABRIR MEU PIAGET',15,y,{url:link});pdf.setFont('helvetica','normal');pdf.setTextColor(92,99,120);pdf.setFontSize(7.2);pdf.text(pdf.splitTextToSize(link,130),55,y);
  pdf.save(`demonstrativo-valores-em-aberto-${mat}.pdf`);
};
window.downloadReportPng=async function(mat){const node=$('#reportSheet');if(!node)return;await document.fonts?.ready;const canvas=await html2canvas(node,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});const a=document.createElement('a');a.download=`demonstrativo-valores-em-aberto-${mat}.png`;a.href=canvas.toDataURL('image/png');a.click()};
})();
