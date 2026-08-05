# Sistema de Vendas Escola Piaget — 1.6.0-rc2.3.2

Hotfix construído sobre a RC2.3.1. Preserva o portal do responsável, a venda online, o carrinho misto, o pagamento combinado e o checkout InfinitePay já validados.

## Alteração principal

A programação de lanches da Secretaria e do responsável agora permite vários produtos na mesma data.

Exemplo:

- 1 salgado;
- 1 suco;
- 2 biscoitos;
- 1 combo.

Cada dia funciona como um pequeno carrinho. É possível adicionar, remover e alterar itens, além de copiar a composição de um dia para os demais dias marcados.

## Regras mantidas

- a Secretaria agenda e cobra, mas não confirma a entrega;
- a Cantina recebe uma ocorrência por aluno e data, contendo todos os itens daquele dia;
- combos continuam expandindo seus componentes;
- a capacidade diária de salgados continua sendo validada;
- a venda presencial e a venda online usam o mesmo planejador;
- cada produto pode ter quantidade de 1 a 10 por dia.
