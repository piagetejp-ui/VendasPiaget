# Escola Piaget — Sistema de Vendas V1.5.0-dev1

Base utilizada: **V1.4.3 — Checkout + Auditoria**.

> **Importante:** este pacote contém apenas os arquivos alterados nesta entrega. Ao aplicar sobre o projeto atual, mantenha a pasta `assets/` e os demais arquivos estáticos já existentes no projeto da V1.4.3.

Esta entrega implementa o primeiro ciclo funcional de pedidos antecipados da cantina:

1. o responsável escolhe um dia, uma semana ou um mês;
2. monta a programação de lanches por data;
3. o sistema valida e reserva o estoque crítico de salgados por **5 minutos**;
4. o saldo positivo da conta do aluno é considerado primeiro;
5. a InfinitePay cobra somente o valor necessário para que pagamento e compra não deixem a conta negativa;
6. após a confirmação, cada data gera uma obrigação própria na Agenda da Cantina;
7. o operador registra Entregue, Aluno ausente ou Não entregue;
8. ausência/não entrega devolve o valor para a conta corrente e libera o salgado daquele dia.

## Estrutura do pacote

```txt
index.html
obrigado.html
package.json
api/
  _utils.js
  criar-checkout.js
  verificar-pagamento.js
  webhook-infinitepay.js
```

## Variáveis de ambiente na Vercel

```txt
INFINITEPAY_HANDLE=piaget
PUBLIC_BASE_URL=https://vendas-piaget.vercel.app
FIREBASE_PROJECT_ID=vendaspiaget
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

## URLs do checkout

```txt
Redirect:
https://vendas-piaget.vercel.app/obrigado.html

Webhook:
https://vendas-piaget.vercel.app/api/webhook-infinitepay
```

## Novas estruturas no Firestore

### `pedidos`
Pedido principal da cantina, incluindo modalidade, datas, itens, total, pagamento, reserva e situação operacional.

### `ocorrencias_entrega`
Uma obrigação de entrega por pedido e por data. É a fonte da Agenda da Cantina.

### `disponibilidade_salgados`
Mantém capacidade planejada, vendas, consumos, pedidos confirmados e reservas temporárias por data.

### `solicitacoes_correcao_pedido`
Solicitações do operador para corrigir uma obrigação já finalizada.

### `fechamentos_cantina`
Registro de encerramento operacional de cada data.

## Conta corrente nos pedidos

O pedido passa pela conta corrente do aluno.

```txt
saldo final = saldo anterior + pagamento externo - valor dos lanches
```

- saldo positivo pode pagar todo ou parte do pedido;
- saldo negativo aumenta o valor necessário no checkout;
- se a diferença for menor que o mínimo operacional, o checkout cobra o mínimo e o excedente permanece como crédito;
- o pedido online não é confirmado se o resultado deixaria saldo negativo;
- se o pagamento chegar após a reserva e já não houver estoque, o valor recebido fica na conta do aluno e o pedido vai para revisão.

## Agenda da Cantina

A agenda permite:

- escolher uma data pelo calendário;
- avançar ou voltar dias;
- filtrar Todos, Manhã ou Tarde;
- ver pendências de datas anteriores;
- registrar Entregue;
- registrar Aluno ausente;
- registrar Não entregue com motivo;
- solicitar correção de uma baixa finalizada;
- encerrar uma data somente quando não houver pendências.

## Teste recomendado

1. Publicar o pacote na Vercel mantendo as variáveis atuais.
2. Entrar no portal do responsável.
3. Abrir **Montar a semana**.
4. Selecionar um lanche completo em cinco dias.
5. Revisar o total e continuar.
6. Conferir a reserva de cinco minutos.
7. Pagar pela InfinitePay ou testar um pedido integralmente coberto pelo saldo.
8. Voltar pela `obrigado.html`.
9. Entrar com o perfil Cantina.
10. Abrir **Agenda da cantina** e conferir as obrigações por data.
11. Marcar uma como Entregue e outra como Aluno ausente.
12. Conferir o crédito da ausência e a disponibilidade diária do salgado.

## Limite desta entrega

Esta versão é a primeira etapa da V1.5.0. A venda presencial completa da secretaria, com pagamento exato, troco devolvido ou troco mantido como crédito, e a reorganização definitiva de Catálogo/Produtos entre Cantina e Fardas permanecem para a próxima etapa.
