# Roteiro de testes — 1.6.0-rc2.6-pedidos-fardamento

## Ordem recomendada

1. **Regressão do caixa:** abrir, assumir, movimentar, vender em dinheiro e fechar; confirmar que o comportamento permanece igual ao testado anteriormente.
2. **Fardamento administrativo:** abrir Catálogo → Camisa de farda; conferir que não há preço geral; editar preços individuais; selecionar vários tamanhos e aplicar preço em lote; salvar e reabrir.
3. **Fardamento com estoque:** comprar uma variação disponível pelo portal e pela Secretaria; conferir preço, reserva, pedido e baixa após entrega.
4. **Fardamento sem estoque:** comprar uma variação zerada; confirmar que a compra não é bloqueada, que o pedido entra em produção e que a variação registra produção mínima de 5 quando necessário.
5. **Recebimento de produção:** receber o lote; confirmar que pedidos já comprometidos viram reserva do aluno e somente a sobra fica disponível.
6. **Cancelamento parcial:** criar um pedido com parte reservada e parte aguardando produção, cancelar e conferir que apenas a reserva/compromisso do aluno é liberado, mantendo o lote do fornecedor como produção disponível.
7. **Pedidos unificados:** navegar por Todos, Cantina, Fardamento, Eventos, Serviços e cobranças, Mensalidades e Negociações; testar os cards de filtro e a busca digitando continuamente.
8. **Cantina pela Secretaria:** abrir um pedido e registrar Entregue; em outro registrar Aluno ausente; em outro registrar Não entrega/estorno; conferir autoria, saldo e notificação do responsável.
9. **Eventos/serviços:** realizar venda de um item operacional; confirmar que aparece em Pedidos com Pagamento e Atendimento separados; alterar atendimento e conferir o portal do responsável.
10. **Notificações:** conferir nome, turma e origem; testar Marcar como lida; confirmar que Resolver só aparece em pendências reais; testar nos perfis Gestão, Secretaria, Cantina e Responsável.
11. **Cards e atalhos:** testar cards do Resumo, Cobranças, Pedidos, Notificações e Gestão do Caixa e confirmar que abrem/filtram os dados correspondentes.
12. **Mobile/responsável:** repetir compra de farda, consulta a pedidos e notificações em tela estreita.

## Pontos de atenção

- Registros antigos podem não possuir todos os campos de turma/origem ou classificação adicionados nas versões recentes; quando possível, a interface recupera esses dados do cadastro do aluno.
- Não considerar esta release validada até concluir os testes no ambiente real após publicação.
