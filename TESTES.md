# Roteiro de testes — 1.6.0-rc2.5-experiencia-auditoria

## 1. Regressão do caixa físico

1. Abrir o caixa como operador autorizado.
2. Registrar entrada manual.
3. Registrar saída classificada como despesa.
4. Registrar saída “Transferência para conta da escola” e confirmar que ela reduz a gaveta, mas aparece separada das despesas reais.
5. Trocar o responsável usando **Conferir e assumir**.
6. Fazer venda presencial com dinheiro.
7. Fechar o caixa e conferir saldo esperado, contado e divergência.

## 2. Gestão e histórico do caixa

1. Entrar como Gestão/Admin e abrir **Caixas**.
2. Alternar entre Ano, Mês e Dia.
3. No mês, abrir um dia com caixa registrado.
4. No dia, abrir uma sessão.
5. Conferir períodos de responsabilidade e movimentações.
6. Confirmar entradas, saídas, despesas, transferências, sangrias e retiradas separadamente.
7. Abrir uma divergência pendente e confirmar que a decisão gerencial continua funcionando.
8. Com o caixa fechado, confirmar que a página ainda exibe saldo físico histórico/de referência.

## 3. Venda da Secretaria

1. Iniciar venda presencial e selecionar aluno.
2. Confirmar catálogo à esquerda e carrinho visível à direita no desktop.
3. Adicionar item simples e alterar quantidade.
4. Programar lanche em uma ou mais datas com vários produtos.
5. Confirmar que a ação é **Adicionar ao carrinho**.
6. Confirmar que o carrinho mostra cada data e sua composição.
7. Editar a programação e continuar a venda.
8. Repetir com venda online.

## 4. Portal do responsável

1. Abrir programação de lanches no computador e no celular.
2. Montar vários produtos em uma data e em várias datas.
3. Confirmar que o resumo fica acessível durante a montagem.
4. Confirmar que a etapa final continua sendo uma revisão real antes do pagamento.
5. Testar compra com saldo parcial e checkout InfinitePay.

## 5. Notificações

Testar separadamente com Responsável, Cantina, Secretaria e Gestão:

- Responsável: somente eventos do próprio aluno.
- Cantina: eventos ligados à operação da Cantina.
- Secretaria: eventos operacionais pertinentes.
- Gestão: supervisão e pendências gerenciais, sem furar a matriz de destinatários.

Também verificar:

1. aluno, turma e origem quando pertinentes;
2. **Marcar como lida** altera visual, contador e persiste após recarregar;
3. notificação informativa não mostra **Resolver**;
4. pendência real mostra **Resolver**;
5. **Detalhar** e atalhos abrem aluno, pedido, venda, entrega ou caixa relacionados.

## 6. Regressão geral

- Portal do responsável e mobile.
- Checkout InfinitePay.
- Venda presencial e online.
- Pagamento combinado.
- Cartão: líquido, bruto e taxa.
- Programação de lanche com múltiplos produtos por data.
- Entrega pela Cantina.
- Conta e movimentações do aluno.
