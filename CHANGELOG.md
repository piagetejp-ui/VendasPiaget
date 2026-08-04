# Changelog — 1.6.0-rc2.3.1-cartao-liquido-bruto-hotfix

- Corrige a ordem e a semântica dos campos do cartão.
- O primeiro valor agora é o **líquido recebido pela escola** e é o que quita a venda.
- O segundo valor é o **bruto cobrado no cartão**, que pode incluir a taxa repassada.
- A taxa é calculada automaticamente como `bruto − líquido`.
- Impede bruto menor que líquido.
- Ajusta resumo, histórico e detalhes para exibir líquido, bruto e taxa com clareza.
- Mantém inalterados o portal do responsável, a venda online e o checkout InfinitePay.
