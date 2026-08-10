# Marco Zero — RC2.7.16

## Corte oficial

- Data de corte: **10/08/2026 00:00 — America/Fortaleza**.
- Timestamp canônico: `2026-08-10T03:00:00.000Z`.
- O Marco Zero é manual e só pode ser executado uma vez pelo fluxo de implantação.

## Critério: origem da operação

A RC2.7.16 não classifica mais um documento como real só porque alguma data futura aparece nele.

### Operação normal

A origem é a data em que a operação raiz foi criada no sistema. Campos de entrega, competência, vencimento, `dataChave`, `dataOperacao` e `atualizadoEm` não mudam a origem.

Exemplo: programação criada em 08/08 para entrega em 12/08 continua sendo **teste pré-implantação** e será arquivada.

### Lançamento retroativo real

No fluxo **Lançar pendência anterior**, `dataOperacao` representa quando o fato aconteceu; `registradoEm`/`criadoEm` representa quando a Secretaria incorporou esse fato real ao sistema.

Exemplo: lanche consumido em 05/08 e registrado por Evanda em 10/08 é **retroativo real** e será preservado.

Os novos lançamentos passam a gravar explicitamente `retroativo: true`, `origem: secretaria_lancamento_manual`, `dataOperacao`, `registradoEm` e `criadoEm` com semântica separada.

## Herança da operação raiz

Documentos filhos vinculados a lançamento manual, checkout/link, venda ou pedido herdam a classificação da origem raiz. Isso evita que uma entrega futura proteja um pedido de teste e evita que um retroativo real seja apagado por ter data operacional antiga.

## Reconciliações após o corte

Depois de criar o backup e arquivar os testes:

1. contas familiares são reconstruídas apenas com movimentos reais preservados, incluindo retroativos reais;
2. `disponibilidade_salgados` é reconciliada para remover reservas e quantidades confirmadas originadas por programações de teste;
3. reservas e compromissos de produção de farda são reconstruídos a partir dos pedidos preservados;
4. **quantidade física de estoque não é alterada pelo Marco Zero**.

## Revisão antes da execução

A tela de revisão mostra separadamente:

- **Implantação — preservar**;
- **Retroativos reais — preservar**;
- **Testes anteriores — arquivar**;
- saldo atual e saldo reconstruído;
- quantidade de movimentos reais e retroativos considerados;
- estimativa das reconciliações de salgados e fardamento;
- resumo por coleção.

Registros sem origem confiável são preservados por segurança e não entram automaticamente na reconstrução financeira.

## Autenticação

A RC2.7.16 não altera Firestore Rules nem os fluxos de autenticação da Gestão, Secretaria ou Meu Piaget. As Rules são exatamente as mesmas da RC2.7.15 que foram validadas na implantação.
