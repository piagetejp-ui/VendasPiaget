
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

/* O portal do responsável é renderizado dinamicamente; reaplica a marca após cada renderização. */

/* Documento de conta: sem QR Code. O acesso passa a ser explicado e o link ganha destaque. */
window.generateReport=async function(id){
  const a=state.students.find(x=>x.id===id),acc=await getAccount(id),snap=await db.collection('movimentos_conta').where('alunoId','==',id).get(),rows=openDebtRowsForReportV110(snap.docs.map(d=>d.data())),link=parentUrl(a);
  state.currentReportV110={type:'student',student:a,account:acc,rows,link};
  $('#reportHost').classList.remove('hidden');
  $('#reportHost').innerHTML=`<div id="reportSheet" class="wa-report wa-report-v122"><div class="wa-head-v122"><div class="wa-brand-v122"><img src="${BRAND_V122.full}" alt="Escola Piaget"><div class="wa-report-title-v122"><strong>Conta da Cantina</strong><span>Relatório de valores em aberto</span></div></div></div><div class="wa-student"><strong>${esc(a.nome)}</strong><div>${esc(a.turma)} · Matrícula ${esc(a.matricula)}</div><div class="muted">Emitido em ${new Date().toLocaleString('pt-BR')}</div></div><table class="wa-table"><thead><tr><th>Data</th><th>Itens</th><th style="text-align:right">Em aberto</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.data)}</td><td>${esc(r.itens)}</td><td style="text-align:right;font-weight:800">${fmt(r.valorCentavos)}</td></tr>`).join('')||'<tr><td colspan="3">Sem consumos em aberto detalhados.</td></tr>'}</tbody></table><div class="wa-total"><span>Total em aberto</span><strong>${fmt(acc.dividaCentavos)}</strong></div><div class="wa-access-v122"><h3>Como consultar a conta do aluno</h3><ol><li>Toque ou copie o link abaixo.</li><li>Abra o endereço no navegador do celular.</li><li>Na página do aluno, confira os lançamentos, o saldo e as opções disponíveis.</li></ol><span class="wa-access-link-v122">${esc(link)}</span><div class="wa-access-note-v122">Guarde este link para consultar novamente a conta deste aluno. Limite autorizado: ${fmt(acc.limiteFiadoCentavos)} · Compra sem saldo: ${acc.autorizadoSemSaldo?'Liberada':'Bloqueada'}.</div></div></div>`;
  openModal('Relatório da conta',`<div class="alert">O relatório agora destaca o link de acesso à conta e traz instruções de consulta. O QR Code foi removido.</div><div class="actions" style="margin-top:14px"><button class="btn btn-primary" onclick="downloadReportPdf('${esc(a.matricula)}')">Baixar PDF A4</button><button class="btn btn-orange" onclick="downloadReportPng('${esc(a.matricula)}')">Baixar imagem</button><button class="btn btn-light" onclick="copyParentLink('${id}')">Copiar link</button></div>`)
};

window.downloadReportPdf=async function(mat){
  const r=state.currentReportV110;if(!r||r.type!=='student')return;
  const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),blue=[44,56,150],orange=[255,152,31],link=r.link;
  let y=await drawPdfBrandHeaderV121(pdf,'Conta da Cantina','Relatório de valores em aberto');
  pdf.setTextColor(20,24,40);pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.text(r.student.nome,15,y+4);
  pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.text(`${r.student.turma} · Matrícula ${r.student.matricula}`,15,y+10);
  pdf.setTextColor(100);pdf.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`,15,y+16);y+=26;
  const drawHead=()=>{pdf.setFillColor(238,240,248);pdf.rect(15,y,180,8,'F');pdf.setTextColor(70);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text('DATA',17,y+5.2);pdf.text('ITENS',49,y+5.2);pdf.text('EM ABERTO',172,y+5.2);y+=9};
  drawHead();pdf.setFont('helvetica','normal');pdf.setTextColor(25);
  for(const row of r.rows){
    const lines=pdf.splitTextToSize(row.itens,112),h=Math.max(8,lines.length*4.4+3);
    if(y+h>258){pdf.addPage();y=await drawPdfContinuationHeaderV121(pdf,'Conta da Cantina');drawHead()}
    pdf.setDrawColor(225);pdf.line(15,y+h,195,y+h);pdf.setFontSize(9);pdf.text(row.data,17,y+5);pdf.text(lines,49,y+5);pdf.setFont('helvetica','bold');pdf.text(fmt(row.valorCentavos).replace(/\u00a0/g,' '),193,y+5,{align:'right'});pdf.setFont('helvetica','normal');y+=h
  }
  if(y>225){pdf.addPage();y=await drawPdfContinuationHeaderV121(pdf,'Conta da Cantina')}
  pdf.setFillColor(...blue);pdf.roundedRect(15,y+4,180,18,3,3,'F');pdf.setTextColor(255);pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text('TOTAL EM ABERTO',20,y+15);pdf.setFontSize(17);pdf.text(fmt(r.account.dividaCentavos).replace(/\u00a0/g,' '),190,y+16,{align:'right'});y+=31;
  pdf.setTextColor(25);pdf.setFontSize(9);pdf.setFont('helvetica','normal');pdf.text(`Limite autorizado: ${fmt(r.account.limiteFiadoCentavos).replace(/\u00a0/g,' ')} · Compra sem saldo: ${r.account.autorizadoSemSaldo?'Liberada':'Bloqueada'}`,15,y);y+=9;

  const instructions=['1. Toque no link abaixo ou copie o endereço.','2. Abra o endereço no navegador do celular.','3. Confira os lançamentos, o saldo e as opções disponíveis na página do aluno.'];
  const boxY=y;pdf.setFillColor(247,248,254);pdf.setDrawColor(225,228,244);pdf.roundedRect(15,boxY,180,42,3,3,'FD');pdf.setFillColor(...orange);pdf.rect(15,boxY,3.5,42,'F');
  pdf.setTextColor(...blue);pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text('COMO CONSULTAR A CONTA DO ALUNO',22,boxY+8);
  pdf.setTextColor(70,76,94);pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);let iy=boxY+14;for(const line of instructions){pdf.text(line,22,iy);iy+=5}
  pdf.setTextColor(...blue);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.textWithLink('ABRIR CONTA DO ALUNO',22,boxY+34,{url:link});
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(82,88,108);pdf.text(pdf.splitTextToSize(link,105),82,boxY+33);
  pdf.save(`conta-cantina-${mat}.pdf`)
};

/* atualização de versão herdada removida pela V1.5.0-dev2 */
