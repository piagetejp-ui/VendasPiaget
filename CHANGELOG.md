# Changelog — 1.5.0-dev5.2.2-pending-receipts

## Alterações

- Responsável pode **Descartar cobrança** na lista de pagamentos pendentes.
- O registro não é apagado: data, responsável, motivo e status anterior ficam preservados para auditoria.
- Pedidos de cantina descartados liberam a reserva; pedidos de farda pendentes são cancelados.
- Se uma cobrança descartada for paga posteriormente, o valor entra como crédito na conta do aluno e o pedido não é repetido.
- Cobranças já pagas ou com pagamento localizado não podem ser descartadas.
- A página de retorno passa a mostrar um único botão **Comprovante**, abrindo as opções InfinitePay, Piaget imagem e Piaget PDF.
- A tentativa histórica do Armando é encerrada silenciosamente sem novo lançamento, pois o valor do teste foi devolvido externamente.
- Fluxo financeiro, logo e layout mobile da dev5.2.1 foram preservados.
