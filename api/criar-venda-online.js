const crypto=require('crypto');
const {verifyStaff}=require('../server/_family-utils');
const {initFirebase,json,parseBody,nowIso,normalizeFamilySecretaryMixedSale,getAccount}=require('../server/_utils');
function cents(v){const n=Number(v||0);return Number.isFinite(n)?Math.round(n):0}
function accountNet(a={}){return cents(a.saldoContaCentavos ?? (cents(a.saldoCreditoCentavos)-cents(a.dividaCentavos)))}
function baseUrl(req){try{return new URL(String(process.env.PUBLIC_FAMILY_BASE_URL||'https://meupiaget.com.br')).origin}catch(_){return 'https://meupiaget.com.br'}}
function tokenHash(t){return crypto.createHash('sha256').update(String(t||'')).digest('hex')}
function id(){return `VOL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  try{
    const db=initFirebase(),b=parseBody(req);
    await verifyStaff(db,req,['admin','gestao','secretaria']);
    const studentSnap=await db.collection('alunos').doc(String(b.alunoId||'')).get();
    if(!studentSnap.exists)return json(res,404,{ok:false,error:'Aluno não encontrado.'});
    const student={id:studentSnap.id,...studentSnap.data()},acc=await getAccount(db,student.id),net=accountNet(acc),op=String(b.operacao||'venda_catalogo'),use=b.usarSaldo===true;
    let total=cents(b.totalCentavos),items=Array.isArray(b.itens)?b.itens:[];
    if(['venda_catalogo','venda_imediata'].includes(op)){
      const cfgSnap=await db.collection('configuracoes').doc('sistema').get(),cfg=cfgSnap.exists?cfgSnap.data():{},normalized=await normalizeFamilySecretaryMixedSale(db,items,'online',student,cfg);
      total=normalized.total;
      items=normalized.lines;b.alunosIds=normalized.alunosIds||[student.id];
    }
    if(['adicionar_credito','regularizar_debito'].includes(op))total=cents(b.valorCentavos||total);
    if(op==='regularizar_debito')total=Math.max(0,-net);
    if(total<=0)return json(res,400,{ok:false,error:op==='regularizar_debito'?'O aluno não possui saldo em aberto.':'Informe um valor válido.'});
    const accountOnly=['adicionar_credito','regularizar_debito'].includes(op),credit=accountOnly?0:(use?Math.min(Math.max(0,net),total):0),debt=accountOnly?0:Math.max(0,-net),external=accountOnly?total:Math.max(0,total-credit+debt);
    if(external<=0)return json(res,409,{ok:false,sem_link:true,error:'Esta operação está totalmente coberta pelo saldo e deve ser confirmada internamente.'});
    const token=crypto.randomBytes(24).toString('base64url'),linkId=id(),created=nowIso(),expires=new Date(Date.now()+24*60*60*1000).toISOString(),url=`${baseUrl(req)}/pagamento.html?id=${encodeURIComponent(linkId)}&token=${encodeURIComponent(token)}`;
    const doc={id:linkId,tokenHash:tokenHash(token),urlInterna:url,status:'link_gerado',alunoId:student.id,alunoNome:student.nome,matricula:student.matricula||null,turma:student.turma||null,operacao:op,itens:items,alunosIds:Array.isArray(b.alunosIds)&&b.alunosIds.length?b.alunosIds:[student.id],pedido:b.pedido||null,usarSaldo:use,totalCentavos:total,valorExternoEstimadoCentavos:external,saldoNoMomentoCentavos:net,criadoPorId:String(b.criadoPorId||''),criadoPorNome:String(b.criadoPorNome||'Secretaria'),criadoPorPerfil:String(b.criadoPorPerfil||'secretaria'),criadoEm:created,atualizadoEm:created,expiraEm:expires,validadeHoras:24,versao:'1.6.0-rc2.7.15'};
    await db.collection('vendas_online_links').doc(linkId).set(doc);
    return json(res,200,{ok:true,id:linkId,url,expira_em:expires,total_centavos:total,valor_externo_estimado_centavos:external});
  }catch(e){console.error('criar-venda-online',e);return json(res,e.status||500,{ok:false,error:e.message||'Não foi possível gerar o link.'})}
};
