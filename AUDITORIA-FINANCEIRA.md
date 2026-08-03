# Auditoria financeira

## Falha original

O pagamento era localizado, mas o pedido de farda tentava realizar uma leitura de estoque depois de iniciar gravações na mesma transação do Firestore.

## Correção estrutural

1. O sistema armazena a evidência da InfinitePay.
2. Consulta oficialmente o pagamento.
3. Confere aprovação, pedido e valor.
4. Lê checkout, trava da transação, pagamento existente, pedido, conta e estoque.
5. Somente depois inicia as gravações.
6. Entrada, compra, pedido, estoque, pagamento e checkout são confirmados atomicamente.

## Idempotência

- pagamento: documento identificado pelo `order_nsu`;
- transação: documento identificado pelo `transaction_nsu`;
- movimentos: `<order_nsu>__entrada` e `<order_nsu>__compra`;
- pedido: `statusAplicacao = aplicado`;
- migração do Armando: marcador `armando-farda-20260731`.
