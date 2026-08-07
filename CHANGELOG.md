# Changelog — 1.6.0-rc2.5.1-fardamento-variacoes

## Fardamento unificado

- Fardamento passa a ter um único produto canônico: **Camisa de farda**.
- Estrutura: produto → grupo/modelo → tamanho → estoque por variação.
- Grupos: Infantil/Juvenil (modelo único), Adulto Feminino (Baby Look) e Adulto Masculino.
- Tamanhos adultos usam `XGG` internamente e exibem **EXGG** na interface.
- O cadastro administrativo edita preço e estoque físico de cada variação no mesmo modal.
- Estoque reservado e disponível são exibidos por tamanho.
- O Catálogo impede a criação de um segundo produto de fardamento e redireciona para a Camisa de farda.
- O portal do responsável usa os mesmos grupos e estoques; tamanhos zerados ficam visíveis, porém indisponíveis.
- Venda presencial e venda online da Secretaria validam o estoque da variação e reservam a quantidade vendida.
- O backend revalida o estoque antes da confirmação, evitando venda de quantidade superior ao disponível.
- Migração reaproveita estoque já configurado para a mesma variação e usa como base os quantitativos fornecidos em 07/08/2026 para variações ainda não configuradas.

## Estoque-base informado

- Infantil/Juvenil: 04=6, 06=9, 08=0, 10=1, 12=1, 14=0.
- Feminino/Baby Look: P=2, M=2, G=0, GG=0, EXGG=1.
- Masculino: P=1, M=6, G=4, GG=0, EXGG=2.

## Preservado

- Todo o escopo da RC2.5 de experiência, auditoria, notificações e histórico gerencial.
- Núcleo do caixa físico validado anteriormente.

---

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
