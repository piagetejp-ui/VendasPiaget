# Sistema de Vendas Escola Piaget — 1.6.0-rc2.7.6

**Candidata:** RC2.7.6 — Segurança Firestore / autenticação familiar técnica

Esta versão foi construída sobre a RC2.7.5 e tem um objetivo deliberadamente restrito: **fechar o acesso anônimo ao Firestore sem redesenhar a experiência já validada da Equipe Piaget e do Meu Piaget**.

## O que NÃO muda para o responsável

- primeiro acesso continua sendo CPF + matrícula;
- depois do primeiro acesso, CPF + senha criada pelo responsável;
- recuperação de senha continua sendo liberada pela Secretaria por link temporário;
- telas, carrinho familiar, filtros, pedidos, movimentações, notificações, saldo, limite e checkout mantêm o fluxo atual;
- o responsável não precisa criar e-mail, conta Firebase ou fazer qualquer etapa nova.

## O que muda por baixo do capô

1. O servidor valida o CPF/senha da forma já existente (hash `scrypt`, nunca senha em texto puro).
2. A sessão principal da família passa a ficar em cookie `HttpOnly`, `Secure` e `SameSite=Lax`.
3. Depois de validar a nossa sessão, o servidor emite um **Firebase Custom Token técnico**. O navegador usa esse token somente para que as Firestore Security Rules reconheçam qual família está acessando o banco.
4. Não existe cadastro manual dos responsáveis no Firebase Authentication. A identidade técnica `familia_*` nasce automaticamente quando aquela família entra pela primeira vez.
5. As Rules verificam, em cada acesso familiar, a família, os alunos vinculados, a sessão ativa e o prazo da sessão.
6. Documentos de senha/hash, solicitações de reset, sessões, auditoria e cadastros de outros responsáveis não são liberados ao navegador do responsável.
7. Alterações financeiras sensíveis continuam server-side. Até autorização/limite da família agora são recalculados pela API; o responsável só lê a conta financeira diretamente.

## Equipe Piaget

A equipe continua usando Firebase Authentication por e-mail/senha. Antes de liberar o Firestore no navegador, o backend valida o ID Token contra `usuarios_acesso` e cria/atualiza um espelho server-only em `usuarios_auth/{uid}`. Usuários inativos deixam de satisfazer as Rules.

Nesta candidata, funcionários internos ativos continuam com acesso Firestore amplo para preservar Secretaria, Gestão e Cantina já existentes. A restrição técnica por cargo pode ser aprofundada depois que o fluxo da Cantina estiver integralmente auditado, sem misturar essa mudança com a abertura do piloto externo.

## Proteções adicionais

- throttling server-side para login, primeiro acesso e redefinição de senha;
- sessão familiar revogável e com expiração;
- logout encerra a sessão no servidor;
- troca/reset de senha revoga sessões anteriores;
- APIs sensíveis da equipe validam Firebase ID Token;
- APIs sensíveis do responsável validam cookie/sessão e o vínculo do aluno com a família;
- checkout e confirmação de pagamento continuam validados server-side;
- nenhum CPF completo é embarcado na base estática do frontend.

## ATENÇÃO — ordem correta de ativação

**Não publique `firestore.rules` antes de subir e testar o código RC2.7.6.**

1. publique o ZIP RC2.7.6 na Vercel/GitHub;
2. com as regras antigas ainda ativas, teste um login da Equipe e um login do Meu Piaget;
3. só então copie `firestore.rules` para Firebase Console → Firestore Database → Rules e clique em **Publicar**;
4. repita a bateria de segurança/regressão descrita em `GUIA-ATIVACAO-SEGURANCA-RC2.7.6.md`.

O arquivo de regras não é aplicado pela Vercel automaticamente.

## Marco Zero

O Marco Zero continua manual e **não é executado no deploy**.
