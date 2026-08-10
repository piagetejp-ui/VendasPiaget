# Sistema de Vendas Escola Piaget — 1.6.0-rc2.7.16

**Release:** RC2.7.16 — Marco Zero por origem da operação

Base direta: RC2.7.15. Esta release altera somente o mecanismo de implantação/Marco Zero e a semântica dos novos lançamentos retroativos. A autenticação já validada da Secretaria, Gestão e Meu Piaget foi preservada.

## 1. Marco Zero

Corte oficial: **10/08/2026 00:00 — America/Fortaleza** (`2026-08-10T03:00:00.000Z`).

A classificação agora usa a **origem da operação**, não a simples existência de uma data pós-corte.

- programação criada em 08/08 para entrega em 12/08 → teste antigo, arquivar;
- venda criada em 10/08 → implantação, preservar;
- lanche consumido em 05/08 e lançado retroativamente pela Secretaria em 10/08 → retroativo real, preservar.

Consulte `MARCO-ZERO-RC2.7.16.md` para a regra completa.

## 2. Reconciliações

Após arquivar os testes, o Marco Zero:

- reconstrói as contas familiares pelos movimentos reais preservados;
- inclui lançamentos retroativos reais na reconstrução;
- reconcilia capacidade/reservas de salgados;
- reconcilia reservas e compromisso de produção de farda;
- não altera a quantidade física de estoque.

## 3. Autenticação preservada

**Não há alteração de Firestore Rules nesta release.** As regras são as mesmas da RC2.7.15 que já estão publicadas e funcionando.

Não é necessário substituir as Rules para implantar a RC2.7.16.

## 4. Publicação

O pacote continua enxuto: dentro de `releases/` existe somente:

`releases/1.6.0-rc2.7.16/`

Antes de executar o Marco Zero, publique a aplicação, abra a revisão do corte e confira as três listas: implantação a preservar, retroativos reais a preservar e testes a arquivar.
