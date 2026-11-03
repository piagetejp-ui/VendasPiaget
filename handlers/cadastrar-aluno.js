/* Cadastro rápido de aluno novo (ex: matrícula recém-emitida, ainda sem o registro completo
   vindo da base oficial). Cria o aluno de verdade na hora, com o que já se sabe - nunca uma
   venda "solta" sem aluno. Quando a base oficial chegar depois, o mesmo registro (achado pela
   matrícula) é só atualizado/completado, nunca duplicado: o histórico de vendas já criado
   continua ligado ao mesmo aluno, sem precisar religar nada. */
const { initFirebase, json, parseBody, nowIso, audit } = require('../server/_utils');
const { verifyStaff, normalizeMatricula, normalizeCpf, validCpf, cpfHash } = require('../server/_family-utils');

function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Método não permitido.' });
  try {
    const db = initFirebase();
    const staff = await verifyStaff(db, req, ['admin', 'gestao', 'secretaria']);
    const b = parseBody(req);
    const nome = String(b.nome || '').trim();
    const matricula = normalizeMatricula(b.matricula);
    const turma = String(b.turma || '').trim();
    const turno = String(b.turno || '').trim();
    const anoLetivo = b.anoLetivo ? Number(b.anoLetivo) : null;
    const responsavelNome = String(b.responsavelNome || '').trim();
    const responsavelTelefone = String(b.responsavelTelefone || '').trim();
    const responsavelCpfRaw = String(b.responsavelCpf || '').trim();

    if (nome.length < 3) return json(res, 400, { ok: false, error: 'Informe o nome do aluno.' });
    if (!matricula) return json(res, 400, { ok: false, error: 'Informe a matrícula do aluno.' });

    const dup = await db.collection('alunos').where('matricula', '==', matricula).limit(1).get();
    if (dup.docs.length) return json(res, 409, { ok: false, error: `Já existe um aluno cadastrado com a matrícula ${matricula}.` });

    const now = nowIso();
    let responsavelFinanceiroId = null;

    if (responsavelCpfRaw) {
      const cpf = normalizeCpf(responsavelCpfRaw);
      if (!validCpf(cpf)) return json(res, 400, { ok: false, error: 'CPF do responsável inválido.' });
      const h = cpfHash(cpf);
      const existente = await db.collection('responsaveis_financeiros').where('cpfHash', '==', h).limit(1).get();
      if (existente.docs.length) {
        responsavelFinanceiroId = existente.docs[0].id;
        const atual = existente.docs[0].data() || {};
        await existente.docs[0].ref.set({ quantidadeAlunosAtivos: Number(atual.quantidadeAlunosAtivos || 0) + 1, atualizadoEm: now }, { merge: true });
      } else {
        if (responsavelNome.length < 3) return json(res, 400, { ok: false, error: 'Informe o nome do responsável para vincular ao CPF.' });
        const ref = db.collection('responsaveis_financeiros').doc();
        await ref.set({
          id: ref.id, nome: responsavelNome, telefone: responsavelTelefone || '', email: '',
          cpfHash: h, cpfFinal: cpf.slice(-4), cpfValido: true, quantidadeAlunosAtivos: 1,
          origem: 'cadastro_manual_secretaria', criadoPorId: staff.id, criadoPorNome: staff.nome,
          criadoEm: now, atualizadoEm: now
        });
        responsavelFinanceiroId = ref.id;
      }
    }

    const alunoRef = db.collection('alunos').doc();
    const alunoData = {
      id: alunoRef.id,
      nome, matricula,
      turma: turma || null, turmaId: turma ? slug(turma) : null, turno: turno || null,
      anoLetivo: anoLetivo || null, ordemTurma: 999, ativo: true,
      responsavelFinanceiro: responsavelFinanceiroId ? responsavelNome : (responsavelNome || null),
      responsavelFinanceiroId: responsavelFinanceiroId || null,
      contaFinanceiraId: responsavelFinanceiroId || null,
      telefoneResponsavel: responsavelTelefone || null, celularResponsavel: responsavelTelefone || null,
      origem: 'cadastro_manual_secretaria',
      criadoPorId: staff.id, criadoPorNome: staff.nome, criadoPorPerfil: staff.perfil,
      criadoEm: now, atualizadoEm: now
    };
    await alunoRef.set(alunoData);

    await audit(db, 'aluno_cadastrado_manualmente', {
      alunoId: alunoRef.id, alunoNome: nome, matricula, turma: turma || null,
      responsavelFinanceiroId: responsavelFinanceiroId || null,
      usuarioId: staff.id, usuarioNome: staff.nome, usuarioPerfil: staff.perfil,
      descricaoHumana: `${staff.nome} cadastrou manualmente o aluno ${nome} (matrícula ${matricula}), ainda sem os dados completos da base oficial.`
    });

    return json(res, 200, { ok: true, aluno: alunoData });
  } catch (e) {
    console.error('cadastrar-aluno', e);
    return json(res, e.status || 500, { ok: false, error: e.message || 'Não foi possível cadastrar o aluno agora.' });
  }
};
