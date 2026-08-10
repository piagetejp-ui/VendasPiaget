# Sistema de Vendas Escola Piaget — 1.6.0-rc2.7.13

**Candidata:** RC2.7.13 — hotfix de autenticação familiar + Marco Zero por data

Base direta: RC2.7.12. Esta candidata corrige o handshake entre o login do responsável e as Firestore Rules sem redesenhar os fluxos de checkout, InfinitePay, Caixa, carrinho multi-aluno ou a arquitetura financeira familiar.

## 1. Hotfix do Meu Piaget

O fluxo esperado passa a ser:

1. responsável informa CPF + senha;
2. backend valida `responsaveis_financeiros` e `responsaveis_acesso`;
3. backend cria `sessoes_meu_piaget/{sessionId}`;
4. backend cria/atualiza `familias_auth/{sessionId}` para aquela sessão;
5. backend emite Firebase Custom Token com `role=responsavel`, `responsavelId`, `sessionId` e `alunosIds`;
6. navegador faz `signInWithCustomToken`;
7. navegador confere os claims e chama `family_auth_probe`;
8. somente após o probe o portal inicia leituras diretas permitidas pelo Firestore.

### Espelho `familias_auth`

O UID Firebase continua estável por família. Cada sessão recebe seu próprio documento espelho, identificado pelo `sessionId`. O documento registra:

- `firebaseUid`;
- `responsavelId`;
- `sessionId`;
- `alunosIds`;
- `ativo`;
- `expiraEm`;
- `expiraEmMs`;
- `atualizadoEm`.

As Firestore Rules usam esse espelho para autorizar a família. Logout e revogação de sessões marcam o espelho como inativo.

### Publicação obrigatória do hotfix

**Backend/frontend e Firestore Rules devem ser atualizados para a RC2.7.13.** O pacote contém:

- `firestore.rules`;
- `FIRESTORE-RULES-PARA-COLAR.txt`.

O pacote não publica as Rules automaticamente.

## 2. Marco Zero por data — preservado da RC2.7.12

A data operacional de corte permanece:

- **até 09/08/2026:** dados de desenvolvimento/testes antigos;
- **a partir de 10/08/2026 00:00 (America/Fortaleza):** dados da implantação piloto, preservados.

No Firestore, o início é registrado como `2026-08-10T03:00:00.000Z`.

O Marco Zero continua fazendo backup, arquivando apenas registros anteriores ao corte classificados com segurança e reconstruindo as contas familiares pelas movimentações pós-corte. Registros sem data confiável são preservados.

**Não execute o Marco Zero antes de validar novamente o login do responsável após publicar a RC2.7.13 + Rules.**

## 3. PDFs

Os cabeçalhos documentais continuam usando somente:

`/assets/logo-piaget-icon-v152.png`

A versão horizontal com “Escola Piaget” não é usada nos cabeçalhos dos PDFs ajustados.

## 4. Regras preservadas

- `meupiaget.com.br` continua sendo o portal dos responsáveis.
- O domínio técnico da Vercel continua sendo o portal da equipe.
- Checkout e retorno InfinitePay não foram redesenhados.
- Dinheiro continua exigindo caixa aberto e responsabilidade atual; Pix, cartão e saldo não dependem de caixa aberto.
- Conta financeira continua familiar, com operações atribuídas ao aluno específico.
- Status financeiro continua **Regular/Pendente**, com bloqueio como condição separada.
- O Marco Zero continua sendo ação manual e única.
