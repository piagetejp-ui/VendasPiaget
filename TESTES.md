# Roteiro de testes — 1.6.0-rc2.3.1-cartao-liquido-bruto-hotfix

## Cartão simples

1. Abra uma venda presencial de R$ 100,00.
2. Adicione a forma **Cartão**.
3. Confirme que o primeiro campo está identificado como **Valor líquido recebido pela escola** e começa em R$ 100,00.
4. Informe R$ 104,00 em **Valor bruto cobrado no cartão**.
5. Confirme o resumo: líquido R$ 100,00, bruto R$ 104,00 e taxa R$ 4,00.
6. Adicione o pagamento e finalize a venda.

## Pagamento combinado

Venda de R$ 150,00:

- Pix: R$ 50,00;
- cartão líquido: R$ 100,00;
- cartão bruto: R$ 104,00.

O total registrado para quitar a venda deve ser R$ 150,00, e não R$ 154,00.

## Validações

- Bruto menor que líquido deve ser bloqueado.
- Bruto igual ao líquido deve gerar taxa zero.
- O histórico e o detalhe da venda devem mostrar líquido, bruto e taxa.
- Dinheiro, Pix, saldo, lanches programados e venda online devem continuar funcionando.
