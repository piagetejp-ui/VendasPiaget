# Changelog — Sistema de Vendas Escola Piaget

## V1.5.0-dev1 — Pedidos da cantina e agenda operacional

### Portal do responsável

- Criadas entradas para pedido avulso, programação semanal e programação mensal.
- Adicionado planejador por data, permitindo alterar produto e quantidade em cada dia.
- Adicionado resumo de saldo, total dos lanches, pagamento estimado e saldo projetado.
- Adicionada listagem de pedidos recentes no portal.

### Reserva e checkout

- Checkout passou a aceitar `pedido_cantina` e o alias legado `pedido`.
- Reserva temporária de salgados definida em 5 minutos, configurável entre 1 e 10 minutos.
- Validação de capacidade realizada por data antes de gerar o checkout.
- Saldo positivo é usado antes do pagamento externo.
- Saldo negativo é incorporado ao valor necessário para regularizar a conta e pagar o pedido.
- Pedidos integralmente cobertos pelo saldo são confirmados sem abrir InfinitePay.
- Pagamento confirmado após expiração tenta revalidar o estoque.
- Se não houver saldo/estoque no momento da confirmação, o pagamento entra como crédito e o pedido segue para revisão.

### Conta corrente

- Pagamento do pedido gera movimento positivo na conta.
- Compra programada gera movimento negativo separado, vinculado ao mesmo pedido.
- Saldo final é salvo em `saldoContaCentavos`, com compatibilidade para `saldoCreditoCentavos` e `dividaCentavos`.

### Agenda da Cantina

- Substituída a visão simples de pedidos do dia por agenda navegável por data.
- Adicionados filtros Todos, Manhã e Tarde.
- Adicionado alerta de pendências anteriores.
- Adicionado resumo de salgados planejados, confirmados e disponíveis.
- Estados operacionais: Pendente, Entregue, Aluno ausente e Não entregue.
- Ausência ou não entrega devolve o valor para a conta e libera o salgado.
- Adicionada solicitação de correção para obrigações já finalizadas.
- Adicionado encerramento da data, bloqueado enquanto houver pendências.

### Comprovante

- `obrigado.html` passou a mostrar o identificador do pedido da cantina e o total dos lanches quando aplicável.

### Versão

- `package.json` atualizado para `1.5.0-dev1`.
- Auditoria e configuração passam a registrar `1.5.0-dev1`.
