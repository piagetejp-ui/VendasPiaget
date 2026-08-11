const crypto=require('crypto');
const {initFirebase,json,nowIso,audit}=require('./_utils');
function hash(t){return crypto.createHash('sha256').update(String(t||'')).digest('hex')}
function eq(a,b){try{return crypto.timingSafeEqual(Buffer.from(String(a)),Buffer.from(String(b)))}catch{return false}}
module.exports=async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{ok:false,error:'Método não permitido.'});
  try{
    const db=initFirebase(),id=String(req.query?.id||''),token=String(req.query?.token||''),ref=db.collection('vendas_online_links').doc(id),snap=await ref.get();
    if(!snap.exists)return json(res,404,{ok:false,error:'Link não encontrado.'});
    const d=snap.data();
    if(!eq(d.tokenHash,hash(token)))return json(res,403,{ok:false,error:'Link inválido.'});
    const expired=new Date(d.expiraEm||0).getTime()<=Date.now();
    if(expired&&!['pago','pago_revisao'].includes(d.status)){
      if(d.status!=='vencido'){
        await ref.set({status:'vencido',atualizadoEm:nowIso()},{merge:true});
        await audit(db,'venda_online_link_vencido',{alunoId:d.alunoId,alunoNome:d.alunoNome,responsavelFinanceiroId:d.responsavelFinanceiroId||null,vendaId:d.vendaId||null,pagamentoId:d.orderNsu||null,entidades:[{tipo:'venda_online_link',id}],criadoPorId:'sistema',criadoPorNome:'Sistema',criadoPorPerfil:'sistema',descricaoHumana:`O link de venda online de ${d.alunoNome||'um aluno'} venceu.`});
      }
      return json(res,410,{ok:false,error:'Este link venceu. Solicite um novo link à Secretaria.'});
    }
    if(['cancelado','substituido'].includes(d.status))return json(res,410,{ok:false,error:'Este link não está mais ativo.'});
    const buyer=await db.collection('dados_pagamento_responsavel').doc(d.alunoId).get(),customer=buyer.exists?(buyer.data().customer||{}):{};
    let effectiveStatus=d.status;
    if(d.status==='link_gerado'){
      effectiveStatus='link_aberto';
      const openedAt=nowIso();
      await ref.set({status:'link_aberto',abertoEm:openedAt,atualizadoEm:openedAt},{merge:true});
      await audit(db,'venda_online_link_aberto',{alunoId:d.alunoId,alunoNome:d.alunoNome,responsavelFinanceiroId:d.responsavelFinanceiroId||null,vendaId:d.vendaId||null,pagamentoId:d.orderNsu||null,entidades:[{tipo:'venda_online_link',id}],criadoPorId:'responsavel_link',criadoPorNome:'Responsável',criadoPorPerfil:'responsavel',descricaoHumana:`O responsável abriu o link de venda online de ${d.alunoNome||'um aluno'}.`});
    }
    return json(res,200,{ok:true,venda:{id:d.id,status:effectiveStatus,alunoNome:d.alunoNome,matricula:d.matricula,turma:d.turma,alunosIds:Array.isArray(d.alunosIds)?d.alunosIds:[],operacao:d.operacao,itens:d.itens||[],pedido:d.pedido||null,totalCentavos:d.totalCentavos,valorExternoEstimadoCentavos:d.valorExternoEstimadoCentavos,usarSaldo:d.usarSaldo,expiraEm:d.expiraEm,orderNsu:d.orderNsu||null},customer});
  }catch(e){console.error('obter-venda-online',e);return json(res,500,{ok:false,error:'Não foi possível abrir o link.'})}
};
