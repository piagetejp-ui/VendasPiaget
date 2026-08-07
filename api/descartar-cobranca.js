const { initFirebase, json, parseBody, discardCheckout } = require('../server/_utils');
const {verifyFamilyForStudent}=require('../server/_family-utils');

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  try{
    const db=initFirebase(),body=parseBody(req);
    await verifyFamilyForStudent(db,req,body.alunoId);
    const result=await discardCheckout(db,body);
    return json(res,200,result);
  }catch(error){
    console.error('descartar-cobranca:',error);
    return json(res,error.status||500,{ok:false,error:error.message||'Erro ao descartar cobrança.',code:error.code||null});
  }
};
