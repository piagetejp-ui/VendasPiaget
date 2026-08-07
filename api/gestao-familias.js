const {initFirebase,json,parseBody,nowIso}=require('./_utils');
const {verifyStaff,randomToken,tokenHash,normalizeCpf,validCpf,cpfHash}=require('./_family-utils');

function familyBaseUrl(req){const raw=String(process.env.PUBLIC_FAMILY_BASE_URL||process.env.PUBLIC_BASE_URL||`https://${req.headers.host}`);try{const u=new URL(raw);const path=u.pathname&&u.pathname!=='/'?u.pathname.replace(/\/$/,''):'/meu-piaget.html';return `${u.origin}${path}`}catch(_){return `https://${req.headers.host}/meu-piaget.html`}}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});const db=initFirebase(),b=parseBody(req);try{const staff=await verifyStaff(db,req,['admin','gestao','secretaria']);const acao=String(b.acao||'');
  if(acao==='gerar_reset'){
   const responsavelId=String(b.responsavelId||'');if(!responsavelId)return json(res,400,{error:'Responsável não identificado.'});const rs=await db.collection('responsaveis_financeiros').doc(responsavelId).get();if(!rs.exists)return json(res,404,{error:'Responsável não encontrado.'});const token=randomToken(24),ref=db.collection('reset_senha_responsavel').doc(),exp=new Date(Date.now()+2*3600000).toISOString(),now=nowIso();await ref.set({id:ref.id,responsavelId,tokenHash:tokenHash(token),status:'ativo',usoUnico:true,criadoPorId:staff.id,criadoPorNome:staff.nome,criadoEm:now,expiraEm:exp});const base=familyBaseUrl(req),sep=base.includes('?')?'&':'?',url=`${base}${sep}resetFamilia=${encodeURIComponent(ref.id)}&resetToken=${encodeURIComponent(token)}`;return json(res,200,{ok:true,url,expiraEm:exp});
  }
  if(acao==='bloquear_acesso'){
   const responsavelId=String(b.responsavelId||'');await db.collection('responsaveis_acesso').doc(responsavelId).set({ativo:false,bloqueadoPorId:staff.id,bloqueadoPorNome:staff.nome,bloqueadoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});return json(res,200,{ok:true});
  }
  if(acao==='corrigir_cpf'){
   if(!['admin','gestao'].includes(staff.perfil))return json(res,403,{error:'Somente a Gestão pode corrigir o CPF.'});const responsavelId=String(b.responsavelId||''),cpf=normalizeCpf(b.cpf);if(!validCpf(cpf))return json(res,400,{error:'Informe um CPF válido.'});const h=cpfHash(cpf),dup=await db.collection('responsaveis_financeiros').where('cpfHash','==',h).limit(1).get();if(dup.docs.length&&dup.docs[0].id!==responsavelId)return json(res,409,{error:'Este CPF já está vinculado a outro responsável.'});await db.collection('responsaveis_financeiros').doc(responsavelId).set({cpfHash:h,cpfFinal:cpf.slice(-4),cpfValido:true,cpfCorrigidoPorId:staff.id,cpfCorrigidoPorNome:staff.nome,cpfCorrigidoEm:nowIso(),atualizadoEm:nowIso()},{merge:true});return json(res,200,{ok:true});
  }
  return json(res,400,{error:'Ação inválida.'});
 }catch(e){console.error('gestao-familias',e);return json(res,e.status||500,{error:e.message||'Não foi possível concluir a operação.'})}
};
