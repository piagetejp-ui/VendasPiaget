# Changelog — 1.6.0-rc2.5-experiencia-auditoria

## Experiência de venda e carrinho

- Modal de montagem da venda da Secretaria reorganizado em duas áreas no desktop: catálogo à esquerda e carrinho persistente à direita.
- Layout responsivo volta a uma coluna em telas menores.
- Programação de lanches no carrinho agora detalha as datas, produtos e quantidades.
- A ação da programação usada dentro da venda passou de “Revisar pedido” para “Adicionar ao carrinho”.
- Programador de lanches do responsável recebeu resumo persistente durante a montagem, preservando a revisão final quando realmente existe uma etapa de confirmação.

## Caixa e auditoria gerencial

- Nova visão gerencial hierárquica: ano → mês → dia → sessões → períodos de responsabilidade → movimentações.
- Cada sessão do caixa pode ser aberta e auditada.
- Exibição histórica de saldo inicial, entradas, saídas, saldo esperado, saldo contado e saldo final.
- Separação gerencial entre despesas reais, transferências de numerário, sangrias e retiradas de sócio.
- Nova tela de saída do caixa explicita se a operação impacta ou não as despesas da escola.
- Histórico usa rótulos amigáveis para estados antigos/migrados.
- Pendências de divergência continuam disponíveis para decisão da Gestão.

## Notificações e navegação

- Matriz central de destinatários por tipo de evento.
- Gestão deixa de enxergar automaticamente notificações destinadas exclusivamente a outros perfis.
- Responsável recebe apenas notificações explicitamente relacionadas ao seu aluno/conta.
- Notificações novas podem carregar aluno, turma, origem/canal e IDs relacionados.
- “Resolver” aparece apenas em notificações acionáveis.
- “Marcar como lida” persiste no Firestore e atualiza a interface/contador.
- Notificações podem ser detalhadas e abrir entidades relacionadas.
- Nomes de alunos em históricos de vendas/cobranças passam a funcionar como atalhos para a conta administrativa.

## Preservado

- Caixa físico único da Secretaria.
- Abertura, fechamento, conferência e assunção.
- Períodos de responsabilidade e divergências.
- Regra de dinheiro vinculada ao responsável atual do caixa.
- Pix, cartão e saldo independentes da abertura do caixa.
- Conta corrente única do aluno.
- Checkout InfinitePay, venda online e portal do responsável.
