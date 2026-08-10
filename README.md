# Sistema de Vendas Escola Piaget — 1.6.0-rc2.7.14

**Candidata:** RC2.7.14 — autenticação consolidada da equipe + Meu Piaget

Base direta: RC2.7.13. Esta candidata combina o hotfix familiar da RC2.7.13 com a lógica de equipe do hotfix piloto que já havia sido validado, sem redesenhar checkout, InfinitePay, Caixa, carrinho multi-aluno ou a arquitetura financeira familiar.

## 1. Autenticação consolidada

### Equipe

Fluxo esperado:

1. usuário entra pelo Firebase Authentication com e-mail + senha;
2. frontend envia o ID Token para `staff_bootstrap`;
3. backend valida o perfil em `usuarios_acesso`;
4. backend cria/atualiza `usuarios_auth/{uid}`;
5. Firestore Rules reconhecem a equipe por `usuarios_auth/{uid}`;
6. durante o piloto permanece o fallback dos perfis `lucas`, `daniele`, `evanda` e `ruan`, validado pelo UID ou pelo e-mail autenticado.

A avaliação da equipe não depende de claims familiares. Claims opcionais usam `request.auth.token.get(..., padrão)`.

### Meu Piaget

Fluxo esperado:

1. responsável informa CPF + senha;
2. backend valida `responsaveis_financeiros` e `responsaveis_acesso`;
3. backend cria `sessoes_meu_piaget/{sessionId}`;
4. backend cria/atualiza `familias_auth/{sessionId}`;
5. backend emite Firebase Custom Token com `role=responsavel`, `responsavelId`, `sessionId` e `alunosIds`;
6. navegador faz `signInWithCustomToken`;
7. navegador confere os claims e chama `family_auth_probe`;
8. somente após o probe o portal inicia as leituras diretas permitidas pelo Firestore.

As permissões familiares continuam restritas à própria família e aos alunos vinculados.

### Publicação obrigatória

**Aplicação e Firestore Rules precisam ser atualizadas juntas para a RC2.7.14.** O pacote contém:

- `firestore.rules`;
- `FIRESTORE-RULES-PARA-COLAR.txt`;
- `FIRESTORE-RULES-RC2.7.14-AUTENTICACAO-CONSOLIDADA.txt`.

O pacote não publica as Rules automaticamente.

## 2. Teste mínimo antes do Marco Zero

Após publicar aplicação + Rules, validar na mesma implantação:

- Gestão: login e carregamento do Resumo;
- Secretaria: login e abertura de Vendas;
- Meu Piaget: CPF + senha e carregamento da família.

Somente depois dos três acessos funcionarem na mesma versão, revisar o Marco Zero.

## 3. Marco Zero por data — preservado

A data operacional de corte permanece:

- **até 09/08/2026:** dados de desenvolvimento/testes antigos;
- **a partir de 10/08/2026 00:00 (America/Fortaleza):** dados da implantação piloto, preservados.

No Firestore, o início é registrado como `2026-08-10T03:00:00.000Z`.

O Marco Zero continua manual. Ele faz backup, arquiva apenas registros anteriores ao corte classificados com segurança e reconstrói as contas familiares pelas movimentações pós-corte. Registros sem data confiável são preservados.

## 4. PDFs

Os cabeçalhos documentais continuam usando somente:

`/assets/logo-piaget-icon-v152.png`

## 5. Pacote enxuto para GitHub

Dentro de `releases/` existe somente a release ativa:

`releases/1.6.0-rc2.7.14/`

As releases anteriores não são incluídas no pacote de implantação, evitando o limite de quantidade de arquivos da interface do GitHub.
