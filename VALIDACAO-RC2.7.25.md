# Validação — RC2.7.25

Base: `1.6.0-rc2.7.24` enviada pelo usuário em 11/08/2026.

## Objetivo desta release

Corrigir o bloqueio de deploy da Vercel Hobby, que aceita no máximo 12 funções serverless por implantação, sem reescrever a lógica operacional da RC2.7.24. A base tinha 14 arquivos em `/api`; a RC2.7.25 publica 10.

## Consolidação aplicada

Cinco endpoints foram movidos de `/api` para `handlers/` sem alteração de conteúdo e são atendidos por uma única função `/api/operacoes`:

- `/api/cancelar-venda-presencial`
- `/api/configuracao-operacional`
- `/api/gerenciar-programacao-lanche`
- `/api/registrar-operacao-presencial`
- `/api/resumo-operacional`

As URLs antigas continuam válidas por `rewrites` no `vercel.json`, portanto o frontend não precisou ser alterado para consumir novas URLs.

## Preservações verificadas

- Firestore Rules: byte a byte iguais à base recebida.
- Handlers movidos: byte a byte iguais aos arquivos originais da RC2.7.24.
- Frontend RC2.7.25: lógica idêntica à RC2.7.24; apenas o identificador de versão mudou.
- Núcleo InfinitePay/webhook: não consolidado e não alterado nesta release.
- Marco Zero: não alterado e não deve ser repetido.
- Correção de Cancelar / Estornar da RC2.7.24 preservada, incluindo reconhecimento do status `confirmada`.

## Validação local/estática executada

- 54 arquivos JavaScript aprovados em `node --check`.
- `vercel.json`, `version.json`, `package.json` e `BUILD-REPORT.json` parseados como JSON válido.
- 5 handlers movidos comparados byte a byte com a base original.
- Firestore Rules comparadas byte a byte com a base original.
- 92 referências locais de HTML para assets/release conferidas; 0 ausentes.
- 17 URLs `/api/...` usadas pelo frontend conferidas; todas resolvem para função física ou rewrite.
- 48 `require()` relativos dos módulos de servidor conferidos; 0 caminhos ausentes.
- Dispatcher `/api/operacoes` testado com mock para os 5 módulos e para rota inexistente.
- Contagem física final de funções em `/api`: **10**.

## O que NÃO foi testado localmente

- Firebase/Firestore real.
- InfinitePay real.
- Deploy real na Vercel.
- Execução real de cancelamento/reembolso em dados de produção.

Esses itens dependem do deploy e devem ser cobertos pelo smoke test.
