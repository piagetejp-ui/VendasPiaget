const { initFirebase, json, recoverKnownFinancialMigrations } = require('./_utils');

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido.'});
  try{
    const db=initFirebase();
    const result=await recoverKnownFinancialMigrations(db);
    return json(res,200,result);
  }catch(error){
    console.error('sincronizar-financeiro:',error);
    // A manutenção é silenciosa; falhas serão tentadas novamente em uma próxima abertura.
    return json(res,200,{ok:false,pending:true,error:error.message||'Sincronização financeira pendente.'});
  }
};
