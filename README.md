# Sistema de Vendas Escola Piaget — 1.5.0-rc1-portal-responsavel

Candidata a final do portal do responsável.

## Destaques

- Pedido integralmente coberto pelo saldo é confirmado por endpoint próprio, sem chamar a InfinitePay.
- Saldo parcial e saldo preservado seguem para a InfinitePay apenas pelo valor correto.
- Cabeçalho do responsável limpo, com sino e saída.
- Saldo clicável, extrato com comprovantes e visualização de senha global.
- Programações ativas podem ser abertas; entregas futuras podem ser remarcadas ou canceladas.
- Cancelamento futuro libera o estoque e devolve o valor para a conta.

## Publicação

Publique todo o conteúdo do diretório. A release física e o service worker usam `1.5.0-rc1-portal-responsavel` para impedir mistura com arquivos antigos.
