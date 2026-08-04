# Testes — 1.5.0-rc1.4-status-hotfix

1. Pedido da cantina pago e com entrega futura: deve mostrar **Confirmado · aguarda entrega**.
2. Notificação do responsável: deve mostrar **Pedido de cantina confirmado** e informar que aguarda entrega.
3. Cantina com uma entrega concluída e outra futura: deve mostrar **Em andamento**.
4. Todas as entregas concluídas: deve mostrar **Concluído**.
5. Entrega com devolução: deve mostrar **Concluído com devoluções** quando o pedido terminar.
6. Farda com pagamento não concluído e atendimento cancelado: deve mostrar **Pagamento não concluído**, nunca **Entregue**.
7. Farda paga em produção: deve mostrar **Em produção** ou o estado operacional correspondente.
8. Farda entregue: somente então deve mostrar **Entregue**.
9. Ver pedido pela notificação e diretamente em Meus pedidos.
10. Confirmar que checkout e remarcação da RC1.3 continuam funcionando.
