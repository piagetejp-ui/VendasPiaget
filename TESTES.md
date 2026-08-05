# Roteiro de testes — 1.6.0-rc2.3.2-lanches-multiplos-produtos

## Responsável — uma data

1. Entre no portal do responsável.
2. Abra a programação de lanches e selecione **Um dia**.
3. Adicione salgado, suco e biscoito na mesma data.
4. Altere as quantidades e remova apenas um dos produtos.
5. Revise o pedido.
6. Confirme que os três produtos aparecem agrupados na mesma entrega e que o total está correto.

## Responsável — semana ou mês

1. Monte uma composição com mais de um produto em um dos dias.
2. Marque os outros dias desejados.
3. Use **Aplicar esta composição aos dias marcados**.
4. Altere somente um dos dias depois da cópia.
5. Revise e confirme que cada data preservou sua própria composição.

## Secretaria — venda presencial

1. Inicie uma venda presencial e selecione um aluno.
2. Adicione uma programação com vários produtos na mesma data.
3. Volte ao carrinho e acrescente outro item, como farda ou mensalidade.
4. Conclua com pagamento combinado.
5. Confira o histórico, o detalhamento da venda e a agenda da Cantina.

## Secretaria — venda online

1. Monte uma venda online com programação de lanches e outro item.
2. Gere o link e conclua o pagamento pelo fluxo do responsável.
3. Confirme que a agenda da Cantina recebeu uma ocorrência por data com todos os produtos.

## Edição

1. Adicione uma programação com vários produtos ao carrinho da Secretaria.
2. Clique em **Editar**.
3. Confirme que todos os dias e produtos são restaurados.
4. Faça uma alteração e volte ao carrinho.

## Validações

- um dia marcado sem produtos não deve ser considerado entrega;
- produtos repetidos na mesma data devem ser consolidados;
- mais de 10 unidades do mesmo produto na mesma data devem ser bloqueadas;
- combos devem continuar consumindo seus componentes;
- a disponibilidade de salgados deve considerar a soma de todos os produtos e combos do dia;
- o operador da Cantina deve visualizar todos os itens da ocorrência.
