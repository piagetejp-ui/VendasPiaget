# Validação técnica — 1.5.0-rc1-portal-responsavel

- Sintaxe Node validada em todos os JavaScript.
- Nova API `/api/confirmar-pedido-saldo` não chama a InfinitePay.
- Confirmação com saldo possui tentativa idempotente e reaproveita o mesmo pedido em caso de nova tentativa.
- Remarcação/cancelamento lê documentos antes das gravações da transação.
- Notificações passam a aceitar destinatário por aluno.
- Campos de senha são aprimorados por MutationObserver.
- Release física, version.json, service worker e cabeçalhos foram atualizados.

A validação real de Firestore, estoque e InfinitePay depende do deploy.
