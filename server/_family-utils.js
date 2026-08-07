const crypto=require('crypto');
const {admin}=require('./_utils');

const CPF_HASH_PREFIX='piaget-cpf-v1:';
const FAMILY_SESSION_HOURS=24;

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

async function findResponsibleByCpf(db,cpf){const h=cpfHash(cpf);if(!h)return null;const s=await db.collection('responsaveis_financeiros').where('cpfHash','==',h).limit(1).get();if(!s.docs.length)return null;return{id:s.docs[0].id,...s.docs[0].data()}}
async function studentsForResponsible(db,responsavelId){const s=await db.collection('alunos').where('responsavelFinanceiroId','==',responsavelId).get();return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.ativo!==false).sort((a,b)=>Number(a.ordemTurma||999)-Number(b.ordemTurma||999)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'))}
function publicStudent(a={}){return{id:a.id,matricula:a.matricula||'',nome:a.nome||'',turma:a.turma||'',turmaId:a.turmaId||'',turno:a.turno||'',anoLetivo:a.anoLetivo||null,responsavelFinanceiro:a.responsavelFinanceiro||'',responsavelFinanceiroId:a.responsavelFinanceiroId||null,contaFinanceiraId:a.contaFinanceiraId||a.responsavelFinanceiroId||null}}
async function familyPayload(db,responsavel){const alunos=await studentsForResponsible(db,responsavel.id);const accSnap=await db.collection('contas_responsaveis').doc(responsavel.id).get();const acc=accSnap.exists?accSnap.data():{};return{responsavelId:responsavel.id,alunos:alunos.map(publicStudent),conta:{responsavelId:responsavel.id,saldoContaCentavos:Number(acc.saldoContaCentavos??(Number(acc.saldoCreditoCentavos||0)-Number(acc.dividaCentavos||0))),saldoCreditoCentavos:Number(acc.saldoCreditoCentavos||0),dividaCentavos:Number(acc.dividaCentavos||0),autorizadoSemSaldo:Boolean(acc.autorizadoSemSaldo),limiteFiadoCentavos:Number(acc.limiteFiadoCentavos||0),limiteMaximoFamiliaCentavos:Number(acc.limiteMaximoFamiliaCentavos||0),bloqueioManual:Boolean(acc.bloqueioManual),bloqueadoPorLimite:Boolean(acc.bloqueadoPorLimite),bloqueioSaldoSemanal:Boolean(acc.bloqueioSaldoSemanal)}}}

async function createFamilySession(db,responsavelId){const token=randomToken(32),ref=db.collection('sessoes_meu_piaget').doc(),now=new Date(),expires=new Date(now.getTime()+FAMILY_SESSION_HOURS*3600000);await ref.set({id:ref.id,responsavelId,tokenHash:tokenHash(token),status:'ativa',criadoEm:now.toISOString(),expiraEm:expires.toISOString(),ultimoUsoEm:now.toISOString()});return{token,sessionId:ref.id,expiraEm:expires.toISOString()}}
async function validateFamilySession(db,token){if(!token)return null;const h=tokenHash(token);const s=await db.collection('sessoes_meu_piaget').where('tokenHash','==',h).limit(1).get();if(!s.docs.length)return null;const row={id:s.docs[0].id,...s.docs[0].data()};if(row.status!=='ativa'||!row.expiraEm||new Date(row.expiraEm)<=new Date())return null;await s.docs[0].ref.set({ultimoUsoEm:nowIso()},{merge:true}).catch(()=>{});return row}

function familySessionTokenFromReq(req){return String(req?.headers?.['x-piaget-family-session']||req?.headers?.['X-Piaget-Family-Session']||'').trim()}
async function verifyFamilyForStudent(db,req,alunoId){
 const token=familySessionTokenFromReq(req),session=await validateFamilySession(db,token);
 if(!session)throw Object.assign(new Error('Sua sessão do Meu Piaget expirou. Entre novamente.'),{status:401});
 const id=String(alunoId||'').trim();if(!id)throw Object.assign(new Error('Aluno não identificado.'),{status:400});
 const snap=await db.collection('alunos').doc(id).get();if(!snap.exists)throw Object.assign(new Error('Aluno não encontrado.'),{status:404});
 const student={id:snap.id,...snap.data()},rid=String(student.responsavelFinanceiroId||student.contaFinanceiraId||'');
 if(!rid||rid!==String(session.responsavelId||''))throw Object.assign(new Error('Este aluno não está vinculado ao seu acesso.'),{status:403});
 return{session,student,responsavelId:session.responsavelId};
}

async function verifyStaff(db,req,allowed=['admin','gestao']){const header=String(req.headers.authorization||'');const token=header.startsWith('Bearer ')?header.slice(7):'';if(!token)throw Object.assign(new Error('Acesso da equipe não identificado.'),{status:401});let decoded;try{decoded=await admin.auth().verifyIdToken(token)}catch(_){throw Object.assign(new Error('Sua sessão da equipe expirou. Entre novamente.'),{status:401})}let profile=null;const byUid=await db.collection('usuarios_acesso').where('authUid','==',decoded.uid).limit(1).get();if(byUid.docs.length)profile={id:byUid.docs[0].id,...byUid.docs[0].data()};if(!profile&&decoded.email){const byEmail=await db.collection('usuarios_acesso').where('email','==',String(decoded.email).toLowerCase()).limit(1).get();if(byEmail.docs.length)profile={id:byEmail.docs[0].id,...byEmail.docs[0].data()}}if(!profile||profile.ativo===false||!allowed.includes(profile.perfil))throw Object.assign(new Error('Seu perfil não possui permissão para esta operação.'),{status:403});return profile}

module.exports={normalizeCpf,normalizeMatricula,validCpf,cpfHash,tokenHash,randomToken,passwordOk,makePassword,verifyPassword,findResponsibleByCpf,studentsForResponsible,publicStudent,familyPayload,createFamilySession,validateFamilySession,familySessionTokenFromReq,verifyFamilyForStudent,verifyStaff};
