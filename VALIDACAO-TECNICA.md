# Validação técnica — 1.6.0-rc2.7.16

## Escopo

RC2.7.16 foi derivada diretamente da RC2.7.15. Mudanças funcionais restritas a:

1. `server/handler-implantacao.js` — classificação por origem, herança da raiz, reconstrução financeira e reconciliações derivadas;
2. `20-family-implantation.js` — revisão visual do Marco Zero por origem;
3. `22-secretaria-finalization.js` — semântica explícita de novos lançamentos retroativos.

Firestore Rules e autenticação não foram alteradas funcionalmente.

## Casos locais exercitados

- programação criada em 08/08 com entrega futura em 12/08 → pré-corte;
- documento de entrega sem `criadoEm`, vinculado a pedido pré-corte → herda pré-corte;
- registro criado em 09/08 e apenas atualizado em 10/08 → pré-corte;
- lançamento retroativo com `dataOperacao` em 05/08 e `registradoEm` em 10/08 → retroativo real;
- movimento e pedido filhos de lançamento manual → preservados como retroativo real;
- checkout criado em 09/08 e venda/pagamento concluídos em 10/08 → herdam a origem pré-corte do checkout;
- reconstrução financeira soma operação de 10/08 + retroativo real e exclui movimento de teste de 09/08;
- capacidade de salgados remove reserva de pedido de teste e recalcula `pedidosConfirmados` apenas com ocorrências preservadas;
- reserva/compromisso de farda é recalculado a partir de pedidos preservados sem modificar quantidade física.

## Limites

Não houve conexão com o Firestore publicado nem execução real do Marco Zero. A revisão exibida no ambiente publicado continua sendo a última barreira antes da confirmação definitiva.

## Deploy

Nenhum deploy foi realizado durante a geração deste pacote.
