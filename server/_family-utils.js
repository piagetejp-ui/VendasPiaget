const crypto=require('crypto');
const {admin}=require('./_utils');

const CPF_HASH_PREFIX='piaget-cpf-v1:';
const FAMILY_SESSION_HOURS=24;
const FAMILY_COOKIE='piaget_family_session';

function nowIso(){return new Date().toISOString()}
function normalizeCpf(v){return String(v||'').replace(/\D/g,'').slice(0,11)}
function normalizeMatricula(v){return String(v||'').replace(/\D/g,'')}
function validCpf(cpf){const d=normalizeCpf(cpf);if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;for(let pos=9;pos<=10;pos++){let sum=0;for(let i=0;i<pos;i++)sum+=Number(d[i])*(pos+1-i);let digit=(sum*10)%11;if(digit===10)digit=0;if(Number(d[pos])!==digit)return false}return true}
function cpfHash(cpf){const d=normalizeCpf(cpf);return validCpf(d)?crypto.createHash('sha256').update(CPF_HASH_PREFIX+d).digest('hex'):''}
function tokenHash(token){return crypto.createHash('sha256').update(String(token||'')).digest('hex')}
function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url')}
function passwordOk(password){const p=String(password||'');return p.length>=6&&p.length<=128}
function scryptAsync(password,salt){return new Promise((resolve,reject)=>crypto.scrypt(String(password),String(salt),64,(err,key)=>err?reject(err):resolve(key.toString('hex'))))}
async function makePassword(password){if(!passwordOk(password))throw Object.assign(new Error('A senha precisa ter pelo menos 6 caracteres.'),{status:400});const salt=crypto.randomBytes(16).toString('hex');return{salt,hash:await scryptAsync(password,salt),algoritmo:'scrypt-v1'}}
async function verifyPassword(password,access){if(!access?.senhaHash||!access?.salt)return false;const got=await scryptAsync(password,access.salt);const a=Buffer.from(got,'hex'),b=Buffer.from(String(access.senhaHash),'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function parseCookies(req){const out={};for(const part of String(req?.headers?.cookie||'').split(';')){const i=part.indexOf('=');if(i<1)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();try{out[k]=decodeURIComponent(v)}catch(_){out[k]=v}}return out}
function familySessionTokenFromReq(req){return String(req?.headers?.['x-piaget-family-session']||req?.headers?.['X-Piaget-Family-Session']||parseCookies(req)[FAMILY_COOKIE]||'').trim()}
function familyCookieHeader(token,{clear=false,secure=true}={}){const parts=[`${FAMILY_COOKIE}=${clear?'':encodeURIComponent(String(token||''))}`,'Path=/','HttpOnly','SameSite=Lax'];if(secure)parts.push('Secure');parts.push(clear?'Max-Age=0':`Max-Age=${FAMILY_SESSION_HOURS*3600}`);return parts.join('; ')}

function clientIp(req){
  const forwarded=String(req?.headers?.['x-forwarded-for']||'').split(',')[0].trim();
  return forwarded||String(req?.headers?.['x-real-ip']||req?.socket?.remoteAddress||'unknown').trim()||'unknown';
}
async function enforceAccessRateLimit(db,req,scope,{limit=25,windowMinutes=10}={}){
  const ip=clientIp(req),key=crypto.createHash('sha256').update(`piaget-rate-v1:${scope}:${ip}`).digest('hex'),ref=db.collection('seguranca_rate_limit').doc(key),now=Date.now(),windowMs=Math.max(1,Number(windowMinutes||10))*60000;
  let blocked=false,retryAfter=0;
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),d=snap.exists?(snap.data()||{}):{},start=Number(d.janelaInicioMs||0),same=start>0&&now-start<windowMs,count=same?Number(d.contagem||0):0;
    if(count>=limit){blocked=true;retryAfter=Math.max(1,Math.ceil((windowMs-(now-start))/1000));return}
    tx.set(ref,{scope,ipHash:crypto.createHash('sha256').update(`piaget-ip-v1:${ip}`).digest('hex'),janelaInicioMs:same?start:now,contagem:count+1,ultimaTentativaEm:nowIso(),atualizadoEm:nowIso()},{merge:true});
  });
  if(blocked)throw Object.assign(new Error('Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'),{status:429,retryAfter});
}

async function findResponsibleByCpf(db,cpf){const h=cpfHash(cpf);if(!h)return null;const s=await db.collection('responsaveis_financeiros').where('cpfHash','==',h).limit(1).get();if(!s.docs.length)return null;return{id:s.docs[0].id,...s.docs[0].data()}}
async function studentsForResponsible(db,responsavelId){const s=await db.collection('alunos').where('responsavelFinanceiroId','==',responsavelId).get();return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.ativo!==false).sort((a,b)=>Number(a.ordemTurma||999)-Number(b.ordemTurma||999)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'))}
function publicStudent(a={}){return{id:a.id,matricula:a.matricula||'',nome:a.nome||'',turma:a.turma||'',turmaId:a.turmaId||'',turno:a.turno||'',anoLetivo:a.anoLetivo||null,responsavelFinanceiro:a.responsavelFinanceiro||'',responsavelFinanceiroId:a.responsavelFinanceiroId||null,contaFinanceiraId:a.contaFinanceiraId||a.responsavelFinanceiroId||null}}
async function familyPayload(db,responsavel){const alunos=await studentsForResponsible(db,responsavel.id);const accSnap=await db.collection('contas_responsaveis').doc(responsavel.id).get();const acc=accSnap.exists?accSnap.data():{};return{responsavelId:responsavel.id,alunos:alunos.map(publicStudent),conta:{responsavelId:responsavel.id,saldoContaCentavos:Number(acc.saldoContaCentavos??(Number(acc.saldoCreditoCentavos||0)-Number(acc.dividaCentavos||0))),saldoCreditoCentavos:Number(acc.saldoCreditoCentavos||0),dividaCentavos:Number(acc.dividaCentavos||0),autorizadoSemSaldo:Boolean(acc.autorizadoSemSaldo),limiteFiadoCentavos:Number(acc.limiteFiadoCentavos||0),limiteMaximoFamiliaCentavos:Number(acc.limiteMaximoFamiliaCentavos||0),bloqueioManual:Boolean(acc.bloqueioManual),bloqueadoPorLimite:Boolean(acc.bloqueadoPorLimite),bloqueioSaldoSemanal:Boolean(acc.bloqueioSaldoSemanal)}}}

async function createFamilySession(db,responsavelId){const token=randomToken(32),ref=db.collection('sessoes_meu_piaget').doc(),now=new Date(),expires=new Date(now.getTime()+FAMILY_SESSION_HOURS*3600000);await ref.set({id:ref.id,responsavelId,tokenHash:tokenHash(token),status:'ativa',criadoEm:now.toISOString(),expiraEm:expires.toISOString(),expiraEmTs:admin.firestore.Timestamp.fromDate(expires),ultimoUsoEm:now.toISOString()});return{token,sessionId:ref.id,expiraEm:expires.toISOString()}}
async function validateFamilySession(db,token){if(!token)return null;const h=tokenHash(token);const s=await db.collection('sessoes_meu_piaget').where('tokenHash','==',h).limit(1).get();if(!s.docs.length)return null;const row={id:s.docs[0].id,...s.docs[0].data()};if(row.status!=='ativa'||!row.expiraEm||new Date(row.expiraEm)<=new Date())return null;const access=await db.collection('responsaveis_acesso').doc(String(row.responsavelId||'')).get().catch(()=>null);if(!access?.exists||access.data()?.ativo===false)return null;const patch={};if(!row.expiraEmTs){patch.expiraEmTs=admin.firestore.Timestamp.fromDate(new Date(row.expiraEm));row.expiraEmTs=patch.expiraEmTs}const last=row.ultimoUsoEm?new Date(row.ultimoUsoEm).getTime():0;if(!last||Date.now()-last>5*60*1000)patch.ultimoUsoEm=nowIso();if(Object.keys(patch).length)await s.docs[0].ref.set(patch,{merge:true}).catch(()=>{});return row}
async function revokeFamilySessions(db,responsavelId,{exceptId=''}={}){if(!responsavelId)return 0;const snap=await db.collection('sessoes_meu_piaget').where('responsavelId','==',String(responsavelId)).get().catch(()=>({docs:[]}));const active=snap.docs.filter(d=>d.id!==String(exceptId||'')&&d.data()?.status==='ativa');if(!active.length)return 0;const batch=db.batch(),now=nowIso();for(const d of active)batch.set(d.ref,{status:'encerrada',encerradoEm:now,motivoEncerramento:'seguranca_acesso',atualizadoEm:now},{merge:true});await batch.commit();return active.length}
async function familyFirebaseToken(db,session){if(!session?.responsavelId||!session?.id)throw new Error('Sessão familiar inválida.');const uid=`familia_${String(session.responsavelId).replace(/[^A-Za-z0-9:_-]/g,'_')}`.slice(0,128),students=await studentsForResponsible(db,session.responsavelId),alunosIds=students.map(a=>String(a.id)).slice(0,12);return admin.auth().createCustomToken(uid,{role:'responsavel',responsavelId:String(session.responsavelId),sessionId:String(session.id),alunosIds})}
async function verifyFamilyForStudent(db,req,alunoId){const token=familySessionTokenFromReq(req),session=await validateFamilySession(db,token);if(!session)throw Object.assign(new Error('Sua sessão do Meu Piaget expirou. Entre novamente.'),{status:401});const id=String(alunoId||'').trim();if(!id)throw Object.assign(new Error('Aluno não identificado.'),{status:400});const snap=await db.collection('alunos').doc(id).get();if(!snap.exists)throw Object.assign(new Error('Aluno não encontrado.'),{status:404});const student={id:snap.id,...snap.data()},rid=String(student.responsavelFinanceiroId||student.contaFinanceiraId||'');if(!rid||rid!==String(session.responsavelId||''))throw Object.assign(new Error('Este aluno não está vinculado ao seu acesso.'),{status:403});return{session,student,responsavelId:session.responsavelId}}

async function verifyFamilyFirebaseForStudent(db,req,alunoId){
  const header=String(req?.headers?.authorization||'');
  const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token)throw Object.assign(new Error('Acesso familiar seguro não identificado.'),{status:401});
  let decoded;
  try{decoded=await admin.auth().verifyIdToken(token)}catch(_){throw Object.assign(new Error('Sua sessão do Meu Piaget expirou. Entre novamente.'),{status:401})}
  if(String(decoded.role||'')!=='responsavel'||!decoded.responsavelId||!decoded.sessionId)throw Object.assign(new Error('Este acesso não corresponde a uma conta familiar.'),{status:403});
  const sessionSnap=await db.collection('sessoes_meu_piaget').doc(String(decoded.sessionId)).get();
  if(!sessionSnap.exists)throw Object.assign(new Error('Sua sessão do Meu Piaget expirou. Entre novamente.'),{status:401});
  const session={id:sessionSnap.id,...(sessionSnap.data()||{})};
  if(session.status!=='ativa'||String(session.responsavelId||'')!==String(decoded.responsavelId||'')||!session.expiraEm||new Date(session.expiraEm)<=new Date())throw Object.assign(new Error('Sua sessão do Meu Piaget expirou. Entre novamente.'),{status:401});
  const access=await db.collection('responsaveis_acesso').doc(String(decoded.responsavelId)).get().catch(()=>null);
  if(!access?.exists||access.data()?.ativo===false)throw Object.assign(new Error('Este acesso está bloqueado. Procure a Secretaria.'),{status:403});
  const id=String(alunoId||'').trim();if(!id)throw Object.assign(new Error('Aluno não identificado.'),{status:400});
  const snap=await db.collection('alunos').doc(id).get();if(!snap.exists)throw Object.assign(new Error('Aluno não encontrado.'),{status:404});
  const student={id:snap.id,...snap.data()},rid=String(student.responsavelFinanceiroId||student.contaFinanceiraId||'');
  if(!rid||rid!==String(decoded.responsavelId))throw Object.assign(new Error('Este aluno não está vinculado ao seu acesso.'),{status:403});
  return{session,student,responsavelId:String(decoded.responsavelId),firebaseUid:decoded.uid};
}
async function verifyCheckoutPrincipal(db,req,alunoId){
  const header=String(req?.headers?.authorization||''),hasBearer=header.startsWith('Bearer ');
  if(hasBearer){
    let decoded=null;try{decoded=await admin.auth().verifyIdToken(header.slice(7).trim())}catch(_){}
    if(decoded&&String(decoded.role||'')==='responsavel')return{kind:'responsavel',...(await verifyFamilyFirebaseForStudent(db,req,alunoId))};
    return{kind:'staff',profile:await verifyStaff(db,req,['admin','gestao','secretaria','cantina'])};
  }
  return{kind:'responsavel',...(await verifyFamilyForStudent(db,req,alunoId))};
}
async function verifyStaff(db,req,allowed=['admin','gestao']){const header=String(req.headers.authorization||'');const token=header.startsWith('Bearer ')?header.slice(7):'';if(!token)throw Object.assign(new Error('Acesso da equipe não identificado.'),{status:401});let decoded;try{decoded=await admin.auth().verifyIdToken(token)}catch(_){throw Object.assign(new Error('Sua sessão da equipe expirou. Entre novamente.'),{status:401})}let profile=null;const byUid=await db.collection('usuarios_acesso').where('authUid','==',decoded.uid).limit(1).get();if(byUid.docs.length)profile={id:byUid.docs[0].id,...byUid.docs[0].data()};if(!profile&&decoded.email){const byEmail=await db.collection('usuarios_acesso').where('email','==',String(decoded.email).toLowerCase()).limit(1).get();if(byEmail.docs.length)profile={id:byEmail.docs[0].id,...byEmail.docs[0].data()}}if(!profile||profile.ativo===false||!allowed.includes(profile.perfil))throw Object.assign(new Error('Seu perfil não possui permissão para esta operação.'),{status:403});return{...profile,authUid:decoded.uid,authEmail:String(decoded.email||'').toLowerCase()}}

module.exports={normalizeCpf,normalizeMatricula,validCpf,cpfHash,tokenHash,randomToken,passwordOk,makePassword,verifyPassword,findResponsibleByCpf,studentsForResponsible,publicStudent,familyPayload,createFamilySession,validateFamilySession,revokeFamilySessions,familySessionTokenFromReq,familyCookieHeader,familyFirebaseToken,verifyFamilyForStudent,verifyFamilyFirebaseForStudent,verifyCheckoutPrincipal,verifyStaff,enforceAccessRateLimit,FAMILY_COOKIE};
