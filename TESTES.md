# Roteiro de testes — V1.5.0-dev4-clean

1. Entrar como Ruan em um celular e abrir Menu, Atendimento, Agenda, Caixa e Consulta.
2. Comprar farda com crédito disponível e a opção de usar saldo desativada: o saldo anterior deve permanecer.
3. Repetir ativando o saldo: apenas a diferença deve ir para a InfinitePay.
4. Fazer pedido semanal de cantina com saldo desativado e ativado.
5. Na secretaria, conferir que Nova venda inicia com uso do saldo desativado.
6. Testar aluno com saldo negativo: o pagamento mínimo deve incluir dívida e compra.
7. Durante uma geração lenta, clicar apenas uma vez; atualizar o portal e abrir Pagamentos pendentes.
8. Confirmar que um checkout com URL tem botão Continuar pagamento.
9. Confirmar que `preparando_link` não oferece link inexistente.
10. Confirmar que pedido de cantina expirado não oferece retomada e permite refazer o pedido.
11. Validar nome, telefone e e-mail preenchidos no checkout InfinitePay.
12. Confirmar webhook, obrigado.html, comprovante e saldo após pagamento.
