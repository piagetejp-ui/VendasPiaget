# Validação técnica — V1.5.0-dev5.2.2-pending-receipts

## Resultados locais

- Todos os módulos JavaScript e APIs passaram em `node --check`.
- O JavaScript embutido em `obrigado.html` passou na verificação de sintaxe.
- Todos os caminhos físicos de CSS, JavaScript e imagens referenciados pelo `index.html` existem.
- `version.json`, `index.html`, `sw.js` e a pasta física da release usam a mesma versão.
- O botão **Descartar cobrança** e o endpoint `/api/descartar-cobranca` estão conectados.
- Teste com Firestore simulado confirmou:
  - descarte preserva o registro e cancela o pedido pendente;
  - tentativa de checkout é invalidada para não reabrir o link antigo;
  - pagamento tardio vira crédito na conta sem repetir o pedido;
  - repetição da confirmação não duplica movimento nem saldo;
  - cobrança paga não pode ser descartada;
  - a pendência histórica do Armando é encerrada sem alterar o saldo;
  - eventual confirmação tardia do teste do Armando não gera novo lançamento.
- A página de retorno contém um único botão **Comprovante**, com as três opções condensadas.
- O CSS possui chaves balanceadas e o ZIP foi verificado após a compactação.

## Limite da validação

Os testes locais não substituem a validação real com Firestore, webhook e checkout InfinitePay no deploy da Vercel.
