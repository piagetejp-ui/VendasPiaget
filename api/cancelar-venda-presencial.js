const { initFirebase, json, parseBody, cancelInPersonSale } = require('../server/_utils');
const { verifyStaff } = require('../server/_family-utils');

module.exports = async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Método não permitido.'});
  try{
    const db=initFirebase();
    const actor=await verifyStaff(db,req,['admin','gestao','secretaria']);
    const body=parseBody(req);
    const result=await cancelInPersonSale(db,{...body,criadoPorId:actor.id||actor.authUid,criadoPorNome:actor.nome||actor.email||'Equipe Piaget',criadoPorPerfil:actor.perfil});
    return json(res,200,result);
  }catch(error){
    console.error('cancelar-venda-presencial:',error);
    return json(res,error.status||500,{ok:false,error:error.message||'Não foi possível cancelar a venda presencial.',details:error.details||null});
  }
};
