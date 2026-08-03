# Changelog

## V1.5.0-dev5.2.1-financial-hotfix — 03/08/2026

Base: V1.5.0-dev5.2-logo-sharp.

### Financeiro

- Unificação da confirmação do checkout.
- `payment_check` usando `handle`, `order_nsu`, `transaction_nsu` e `slug`.
- Validação estrita de pagamento aprovado.
- Conferência de `amount` contra o valor esperado.
- Identificadores armazenados antes do processamento operacional.
- Movimentos de conta determinísticos por pedido.
- Trava única por NSU da transação.
- Leitura completa antes das gravações nas transações do Firestore.
- Webhook preservado e reprocessável.
- Reutilização dos identificadores salvos no botão Atualizar status.

### Recuperação histórica

- Migração silenciosa e idempotente do pagamento de farda do Armando.
- Nenhuma tela nova adicionada.

### Preservado

- Logo oficial em alta definição.
- Rebuild mobile e ajustes para iPhone.
- Atualização automática por release físico.
- Uso opcional do saldo.
