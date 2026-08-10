# Changelog — 1.6.0-rc2.7.15

## Hotfix — autenticação consolidada da equipe + Meu Piaget

Esta release corrige a regressão em que o hotfix familiar da RC2.7.13 fazia Gestão/Secretaria voltarem a receber `Missing or insufficient permissions`.

### Equipe

- Restaura a lógica do hotfix de equipe que já havia funcionado no piloto.
- `staffMirrorExists()` volta a depender apenas de sessão Firebase válida + `usuarios_auth/{uid}`; não depende de `!isFamily()`.
- Claims opcionais são lidos com `request.auth.token.get(..., valorPadrao)`, evitando que tokens internos sem claims familiares quebrem a avaliação das Rules.
- Mantém `usuarios_auth/{uid}` como caminho principal.
- Mantém, durante o piloto, o fallback dos perfis internos conhecidos `lucas`, `daniele`, `evanda` e `ruan`, validados por UID ou e-mail contra `usuarios_acesso`.

### Família

- Preserva integralmente o hotfix da RC2.7.13.
- `familias_auth/{sessionId}` continua sendo criado pelo backend antes do Custom Token.
- O responsável continua restrito aos próprios alunos/conta/registros.
- Logout/revogação continuam inativando o espelho familiar.
- O `family_auth_probe` continua validando claims e espelho antes das leituras do portal.

### Separação de trilhos

- A autorização da equipe e a autorização da família são independentes.
- Nenhuma das duas autenticações é definida como “não ser a outra”.
- O `match /{document=**}` continua concedendo acesso global somente quando `staffActive()` é verdadeiro.
- As permissões específicas do Meu Piaget continuam limitadas por `familyActive()`, vínculos de alunos e família.

## Compatibilidade preservada

- Marco Zero por data da RC2.7.12 preservado: corte em 10/08/2026 00:00 — America/Fortaleza.
- Dados de 10/08/2026 em diante continuam protegidos como implantação piloto.
- Logo simples nos PDFs preservada.
- Checkout/InfinitePay, Caixa, carrinho multi-aluno, domínio e roteamento não foram redesenhados.
- O pacote não publica Firestore Rules nem executa deploy automaticamente.
- O Marco Zero continua manual.
- Pacote de implantação enxuto: somente a release ativa permanece dentro de `releases/`.

---

## Histórico resumido

### RC2.7.13 — hotfix do Meu Piaget
- Criou `familias_auth/{sessionId}` e o handshake familiar seguro com Custom Token.

### RC2.7.12 — Marco Zero por data + logo simples nos PDFs
- Marco Zero passou de reset global para corte por data.
- Registros até 09/08/2026 são arquivados; registros de 10/08/2026 em diante são preservados.
- Contas familiares são reconstruídas pelas movimentações pós-corte, sem zeragem indiscriminada.
- Cabeçalhos dos PDFs passaram a usar `logo-piaget-icon-v152.png`.

### RC2.7.11 — relatórios, PDFs e refinamentos
- Relatórios de Vendas, Cobranças, Caixa, Pedidos, Movimentações e Contas.
- Documentos individuais padronizados.
- Status financeiro Regular/Pendente.
- Persistência do aviso do caixa na tela de Vendas.

### RC2.7.10 — hotfix de cobrança direta
- Corrigido Gerar cobrança / Regularizar saldo na Gestão e no Meu Piaget.
