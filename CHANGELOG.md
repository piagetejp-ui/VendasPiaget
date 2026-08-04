# Changelog — 1.5.0-rc1.1-portal-responsavel-hotfix

- Implementada a função `discardCheckout`, que estava exportada mas ausente e impedia o carregamento das APIs.
- Adicionado teste de carregamento real dos módulos serverless, além da validação de sintaxe.
- Corrigido o fluxo de confirmação de pedido integralmente pago pelo saldo.
- Restaurado o checkout para pedidos com pagamento externo integral ou parcial.
- Reforçado o cancelamento de entregas antigas com cálculo alternativo de valor e quantidade de salgados.
- Ampliada a lista de estados encerrados da programação.
- Substituído o cartão de saldo clicável pelo link discreto **Ver extrato**.
