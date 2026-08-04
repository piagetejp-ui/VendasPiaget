# Validação técnica — 1.6.0-rc2.2-visoes-operacionais

- Base: V1.6.0 RC2.1.
- Novo módulo isolado: `15-operational-views.js`.
- As APIs financeiras e o checkout não tiveram sua lógica operacional redesenhada.
- As novas visões leem as coleções já existentes: `contas_alunos`, `pagamentos_checkout`, `vendas_online_links`, `vendas`, `movimentos_conta`, `pedidos`, `pedidos_farda` e `ocorrencias_entrega`.
- O histórico de vendas evita duplicar a venda online quando `vendas_online_links.vendaId` aponta para o registro de `vendas`.
- Pedidos e movimentos preservam os valores históricos gravados; o catálogo continua definindo apenas novas operações.
- A confirmação final depende do deploy e dos dados reais do Firestore.
