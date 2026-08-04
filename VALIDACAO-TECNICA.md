# Validação técnica — RC1.5

- Sintaxe validada em todos os módulos JavaScript e APIs.
- Novo fluxo público usa token aleatório armazenado apenas como hash.
- Link interno tem validade de 24 horas.
- Checkout da InfinitePay só é criado depois da confirmação dos dados do comprador.
- Pagamentos usam o mesmo webhook e motor idempotente já validado.
- Venda online genérica grava venda, pagamento, compra, conta do aluno, estoque e pedidos de farda.
- Programação de lanches reutiliza o motor existente de pedidos e reservas.
- Cancelamento e renovação encerram o checkout anterior no sistema.

A integração real ainda deve ser validada após o deploy com Firestore e InfinitePay.
