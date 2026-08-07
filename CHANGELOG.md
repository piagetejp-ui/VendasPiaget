# Changelog — 1.6.0-rc2.7.6

## Segurança Firestore sem alterar a experiência do usuário

- Mantido o login visível do Meu Piaget: CPF + senha; primeiro acesso CPF + matrícula.
- Sessão familiar migrada de token persistido no `localStorage` para cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Compatibilidade de migração: uma sessão antiga RC2.7.5 salva no navegador pode ser convertida uma única vez para o novo cookie.
- Backend passa a gerar Firebase Custom Token técnico após validar a sessão familiar.
- Frontend usa `signInWithCustomToken()` somente como ponte para as Firestore Security Rules; não existe cadastro manual de responsáveis no Firebase Auth.
- Claims técnicas limitadas a `role`, `responsavelId`, `sessionId` e alunos vinculados.
- Rules novas negam acesso anônimo e limitam famílias a seus próprios dados operacionais.
- Hashes/salts de senha, sessões, tokens de ativação/reset, responsáveis de outras famílias e auditoria não são legíveis pelo portal.
- Autorização/limite da conta familiar deixam de ser gravados diretamente pelo navegador e passam pela API, que valida sessão, teto familiar e recalcula bloqueio por limite.
- Dados do comprador continuam editáveis apenas para aluno pertencente à família.
- Marcação de notificação como lida continua permitida somente nas notificações pertencentes à família.
- Consultas do detalhe de pedidos do responsável foram ajustadas para respeitar o modelo "Rules não são filtros".

## Equipe

- Login interno continua Firebase e-mail/senha.
- Antes de carregar o Firestore, o backend valida o ID Token e o perfil em `usuarios_acesso`.
- Criado espelho `usuarios_auth/{uid}` exclusivamente pelo backend para as Rules.
- Edição/ativação/bloqueio de usuário interno passa pela API de segurança para manter `usuarios_acesso` e `usuarios_auth` sincronizados.

## Proteções adicionais

- Rate limit persistente por origem para login, primeiro acesso, solicitação de reset e redefinição.
- Revogação server-side das sessões familiares após reset de senha.
- Cookie de sessão não é acessível ao JavaScript.
- `/api` permanece com 10 funções físicas no plano Vercel Hobby.
- Núcleo do caixa físico preservado funcionalmente em relação à RC2.7.5.

## Implantação

- Adicionado `firestore.rules`.
- Adicionado `FIRESTORE-RULES-PARA-COLAR.txt`.
- Adicionado `GUIA-ATIVACAO-SEGURANCA-RC2.7.6.md`.
- As Rules devem ser publicadas manualmente **depois** do deploy e smoke test da RC2.7.6.
