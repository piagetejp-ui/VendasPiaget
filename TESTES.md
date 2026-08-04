# Roteiro de testes — 1.6.0-rc2.3-lanches-pagamento-combinado

## 1. Carrinho misto presencial
1. Inicie uma venda presencial.
2. Selecione um aluno.
3. Adicione uma farda e uma mensalidade.
4. Clique em **Programar lanches**, escolha uma data futura e adicione ao carrinho.
5. Confirme que os três grupos permanecem no mesmo carrinho.

## 2. Programação semanal e mensal
- Repita usando Semana e Mês.
- Edite uma programação já inserida no carrinho.
- Remova uma programação sem apagar os demais itens.

## 3. Pagamento combinado
- Abra o caixa da Secretaria antes de usar dinheiro.
- Use parte do saldo do aluno.
- Adicione dinheiro, Pix e cartão até fechar exatamente o restante.
- No cartão, informe bruto de R$ 100,00 e líquido de R$ 96,80; confira taxa de R$ 3,20.
- Confirme que não é possível avançar faltando ou sobrando valor.
- Em dinheiro, confira o valor entregue, o troco e o valor líquido lançado no caixa.

## 4. Agenda da Cantina
- Finalize a venda.
- Abra Entregas e confirme que as datas programadas aparecem como pendentes.
- Confirme que a Secretaria não marcou nenhum lanche como entregue.

## 5. Venda online mista
- Monte farda + mensalidade + lanches programados.
- Gere o link, preencha dados do comprador e conclua na InfinitePay.
- Após confirmação, verifique venda, conta do aluno, pedidos e agenda da Cantina.

## 6. Regularização
- Em um aluno com saldo negativo, use Regularizar saldo.
- Confirme que não é criada nova ocorrência de lanche.

## 7. Regressão
- Portal do responsável, checkout próprio, comprovantes, fardamento, catálogo, notificações e histórico de vendas.
