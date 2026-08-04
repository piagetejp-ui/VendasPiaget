# Sistema de Vendas Escola Piaget — 1.6.0-rc2.3.1-cartao-liquido-bruto-hotfix

Hotfix construído sobre a RC2.3. Mantém o carrinho misto, os lanches programados, o portal do responsável e o checkout já validados.

## Correção principal

No pagamento presencial por cartão:

- **Valor líquido recebido** é o valor que quita a venda e entra na soma das formas de pagamento.
- **Valor bruto cobrado** é o valor passado na maquininha, já com o acréscimo da taxa.
- **Taxa da maquininha = bruto cobrado − líquido recebido**.

Exemplo: venda de R$ 100,00, líquido de R$ 100,00 e bruto cobrado de R$ 104,00 gera taxa de R$ 4,00.
