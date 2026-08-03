# Roteiro de teste — V1.5.0-dev5.2.1-financial-hotfix

## 1. Recuperação do Armando

Depois do deploy, abra o sistema e aguarde até 20 segundos.

Confira o aluno Armando, matrícula `220622`:

- entrada InfinitePay: **+ R$ 23,00**;
- compra de farda: **− R$ 42,00**;
- saldo esperado: **R$ 0,00**, caso não existam movimentações posteriores;
- pedido de farda: pago;
- atendimento: reservado em estoque ou aguardando produção;
- comprovante interno disponível.

Atualize ou abra o sistema novamente. Os movimentos não podem se repetir.

## 2. Novo Pix com saldo

Faça uma compra pequena com crédito positivo e marque **Usar saldo**.

Confirme:

- checkout somente pela diferença;
- uma entrada externa;
- uma compra pelo valor integral;
- saldo final correto;
- pedido confirmado;
- comprovante disponível.

## 3. Novo Pix sem usar saldo

Com crédito positivo, deixe **Usar saldo** desligado.

Confirme:

- checkout pelo valor integral;
- crédito anterior preservado;
- entrada e compra registradas separadamente.

## 4. Atualização repetida

Na página de retorno e em Pagamentos pendentes, toque várias vezes em **Atualizar pagamento/status**.

Confirme que não surgem:

- pagamentos duplicados;
- compras duplicadas;
- reserva duplicada de estoque;
- alteração repetida do saldo.

## 5. Valor divergente

Este teste está coberto automaticamente no pacote: se a InfinitePay informar valor diferente do checkout, o sistema não altera conta, pedido ou estoque e mantém o pagamento para revisão técnica.
